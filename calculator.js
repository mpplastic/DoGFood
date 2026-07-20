/* =========================================================
   DoGFood — portion calculator
   Method:
   RER (Resting Energy Requirement) = 70 × (weight kg)^0.75
   MER (daily need) = RER × life-stage factor, adjusted by
   neuter status and activity level.

   Preset mode : grams/day = MER ÷ kcal density of the kibble.
   Custom mode : recipe = meat 50% + rice 30% + veg 17% + oil 3%
                 (by cooked weight) — blended kcal density is
                 computed from the chosen ingredients, then the
                 daily total is split back into each component.
   ========================================================= */

(function () {
  "use strict";

  var form = document.getElementById("calcForm");
  if (!form) return;

  /* ---------- data ---------- */

  /* kibble formulas: kcal per gram + bag size */
  var FORMULAS = {
    chicken: { name: "สูตรไก่ & ข้าวกล้อง", kcalPerGram: 3.60, bagGrams: 1500 },
    salmon:  { name: "สูตรแซลมอน & มันหวาน", kcalPerGram: 3.70, bagGrams: 1500 },
    puppy:   { name: "Puppy สูตรเจริญเติบโต", kcalPerGram: 3.85, bagGrams: 1200 }
  };

  /* fresh ingredients: kcal per 100 g (cooked weight) */
  var INGREDIENTS = {
    meat: {
      chicken: { name: "ไก่", kcal100: 165 },
      pork:    { name: "หมู", kcal100: 242, caution: "หมูต้องต้มสุกเต็มที่เสมอ และเลือกส่วนไม่ติดมัน" },
      beef:    { name: "เนื้อวัว", kcal100: 250 },
      salmon:  { name: "ปลาแซลมอน", kcal100: 208, caution: "เลาะก้างปลาออกให้หมดก่อนให้น้อง" }
    },
    rice: {
      white:     { name: "ข้าวขาว", kcal100: 130 },
      brown:     { name: "ข้าวกล้อง", kcal100: 111 },
      riceberry: { name: "ข้าวไรซ์เบอร์รี่", kcal100: 118 }
    },
    veg: {
      pea:      { name: "ถั่วลันเตา", kcal100: 81 },
      pumpkin:  { name: "ฟักทอง", kcal100: 26 },
      tomato:   { name: "มะเขือเทศ", kcal100: 18, caution: "ให้เฉพาะมะเขือเทศสุกงอม เอาขั้ว ใบ และลำต้นออก (ส่วนเขียวเป็นพิษต่อสุนัข)" },
      corn:     { name: "ข้าวโพด", kcal100: 86, caution: "ให้เฉพาะเมล็ด ห้ามให้ทั้งฝักหรือซัง เพราะเสี่ยงอุดตันลำไส้" },
      carrot:   { name: "แครอท", kcal100: 35 },
      cucumber: { name: "แตงกวา", kcal100: 15 }
    },
    oil: {
      "salmon-oil": { name: "น้ำมันแซลมอน", kcal100: 902 },
      olive:        { name: "น้ำมันมะกอก", kcal100: 884 },
      soybean:      { name: "น้ำมันถั่วเหลือง", kcal100: 884 },
      palm:         { name: "น้ำมันปาล์ม", kcal100: 884, caution: "น้ำมันปาล์มมีไขมันอิ่มตัวสูง แนะนำสลับใช้น้ำมันแซลมอนหรือมะกอกเป็นหลัก" }
    }
  };

  /* recipe ratio by cooked weight */
  var RATIO = { meat: 0.50, rice: 0.30, veg: 0.17, oil: 0.03 };
  var CAT_LABEL = { meat: "เนื้อสัตว์", rice: "ข้าว", veg: "ผัก", oil: "น้ำมัน" };
  var CAT_ICON = { meat: "🍗", rice: "🍚", veg: "🥕", oil: "🫒" };

  /* life-stage base factors (× RER) and meals per day */
  var STAGES = {
    "puppy-young":  { factor: 3.0, meals: 4 },
    "puppy":        { factor: 2.0, meals: 3 },
    "puppy-giant":  { factor: 1.8, meals: 3 },
    "adult":        { factor: 1.6, meals: 2 },
    "senior":       { factor: 1.4, meals: 2 }
  };

  var ACTIVITY_ADJUST = { low: -0.2, normal: 0, high: 0.3 };

  /* ---------- elements ---------- */
  var weightInput = document.getElementById("weight");
  var weightError = document.getElementById("weightError");
  var neuterField = document.getElementById("neuterField");
  var presetField = document.getElementById("presetField");
  var customBuilder = document.getElementById("customBuilder");

  var resultEmpty = document.getElementById("resultEmpty");
  var resultBody = document.getElementById("resultBody");
  var bagFacts = document.getElementById("bagFacts");
  var recipeBreakdown = document.getElementById("recipeBreakdown");
  var recipeList = document.getElementById("recipeList");

  function getRadio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  /* ---------- form behavior ---------- */
  form.addEventListener("change", function (e) {
    if (e.target.name === "stage") {
      neuterField.hidden = e.target.value.indexOf("puppy") === 0;
    }
    if (e.target.name === "mode") {
      var custom = e.target.value === "custom";
      presetField.hidden = custom;
      customBuilder.hidden = !custom;
    }
  });

  function formatNumber(n) {
    return n.toLocaleString("th-TH");
  }
  function round5(n) {
    return Math.round(n / 5) * 5;
  }

  /* ---------- main calculation ---------- */
  function calculate() {
    var weight = parseFloat(weightInput.value);

    if (isNaN(weight) || weight < 0.5 || weight > 90) {
      weightError.hidden = false;
      weightInput.setAttribute("aria-invalid", "true");
      weightInput.focus();
      return;
    }
    weightError.hidden = true;
    weightInput.removeAttribute("aria-invalid");

    var stageKey = getRadio("stage");
    var stage = STAGES[stageKey];
    var isPuppy = stageKey.indexOf("puppy") === 0;
    var mode = getRadio("mode");
    var dogName = (document.getElementById("dogName").value || "").trim();

    /* --- energy --- */
    var rer = 70 * Math.pow(weight, 0.75);
    var factor = stage.factor;
    if (!isPuppy && getRadio("neuter") === "no") factor += 0.2;
    factor += ACTIVITY_ADJUST[getRadio("activity")];
    factor = Math.max(factor, 1.0);
    var mer = rer * factor; /* kcal/day */

    /* --- food density + name --- */
    var kcalPerGram, foodName, cautions = [];

    if (mode === "preset") {
      var formula = FORMULAS[getRadio("formula")];
      kcalPerGram = formula.kcalPerGram;
      foodName = formula.name;
    } else {
      var picks = {
        meat: INGREDIENTS.meat[getRadio("meat")],
        rice: INGREDIENTS.rice[getRadio("rice")],
        veg:  INGREDIENTS.veg[getRadio("veg")],
        oil:  INGREDIENTS.oil[getRadio("oil")]
      };
      var kcalPer100 = 0;
      Object.keys(RATIO).forEach(function (cat) {
        kcalPer100 += RATIO[cat] * picks[cat].kcal100;
        if (picks[cat].caution) cautions.push(picks[cat].caution);
      });
      kcalPerGram = kcalPer100 / 100;
      foodName = "สูตรปรุงเอง: " + picks.meat.name + " + " + picks.rice.name + " + " + picks.veg.name + " + " + picks.oil.name;
    }

    var gramsPerDay = Math.max(round5(mer / kcalPerGram), 20);
    var gramsPerMeal = Math.max(round5(gramsPerDay / stage.meals), 5);

    /* --- render: headline --- */
    document.getElementById("resultEyebrow").textContent = dogName
      ? "ปริมาณแนะนำต่อวันของน้อง" + dogName
      : "ปริมาณแนะนำต่อวัน";
    document.getElementById("resultGrams").textContent = formatNumber(gramsPerDay);
    document.getElementById("resultKcal").textContent = formatNumber(Math.round(mer));
    document.getElementById("resultFormulaName").textContent = foodName;

    /* --- render: meals --- */
    var mealsEl = document.getElementById("resultMeals");
    mealsEl.innerHTML = "";
    var labels = stage.meals === 4 ? ["เช้า", "กลางวัน", "เย็น", "ก่อนนอน"]
               : stage.meals === 3 ? ["เช้า", "กลางวัน", "เย็น"]
               : ["เช้า", "เย็น"];
    labels.forEach(function (label) {
      var div = document.createElement("div");
      div.className = "meal-chip";
      div.innerHTML = "<span>" + label + "</span><strong>" + formatNumber(gramsPerMeal) + " g</strong>";
      mealsEl.appendChild(div);
    });

    /* --- render: mode-specific block --- */
    if (mode === "preset") {
      var f = FORMULAS[getRadio("formula")];
      var bagDays = Math.max(Math.floor(f.bagGrams / gramsPerDay), 1);
      var bagsPerMonth = Math.ceil((gramsPerDay * 30) / f.bagGrams * 10) / 10;
      document.getElementById("resultBagDays").textContent = formatNumber(bagDays);
      document.getElementById("resultBagLabel").textContent =
        "ถุง " + (f.bagGrams / 1000) + " kg อยู่ได้ประมาณ (วัน)";
      document.getElementById("resultBagsMonth").textContent = bagsPerMonth.toLocaleString("th-TH");
      bagFacts.hidden = false;
      recipeBreakdown.hidden = true;
    } else {
      recipeList.innerHTML = "";
      Object.keys(RATIO).forEach(function (cat) {
        var grams = cat === "oil"
          ? Math.max(Math.round(gramsPerDay * RATIO[cat]), 1) /* oil: exact grams */
          : Math.max(round5(gramsPerDay * RATIO[cat]), 5);
        var pick = INGREDIENTS[cat][getRadio(cat)];
        var li = document.createElement("li");
        var extra = cat === "oil" ? " <small>(≈ " + Math.round(grams / 4.5 * 10) / 10 + " ช้อนชา)</small>" : "";
        li.innerHTML =
          '<span class="recipe-item__icon">' + CAT_ICON[cat] + "</span>" +
          '<span class="recipe-item__name">' + pick.name + ' <small>(' + CAT_LABEL[cat] + " " + Math.round(RATIO[cat] * 100) + "%)</small></span>" +
          '<strong class="recipe-item__grams">' + formatNumber(grams) + " g" + extra + "</strong>";
        recipeList.appendChild(li);
      });
      bagFacts.hidden = true;
      recipeBreakdown.hidden = false;
    }

    /* --- render: contextual note --- */
    var noteEl = document.getElementById("resultNote");
    var notes = [];

    /* giant-breed puppy: applies to both modes, safety-critical */
    if (stageKey === "puppy-giant") {
      notes.push("ลูกสุนัขพันธุ์ใหญ่/ยักษ์ต้อง<strong>ควบคุมไม่ให้โตเร็วเกินไป</strong> — การให้พลังงานหรือแคลเซียมมากเกินเสี่ยงต่อปัญหาข้อและกระดูก ตัวเลขนี้ตั้งไว้ต่ำกว่าลูกสุนัขทั่วไปโดยตั้งใจ และควรปรึกษาสัตวแพทย์ควบคู่ไปด้วย");
    }

    if (mode === "preset") {
      var formulaKey = getRadio("formula");
      if (isPuppy && formulaKey !== "puppy") {
        notes.push("น้องยังเป็นลูกสุนัขอยู่ แนะนำใช้ <strong>Puppy สูตรเจริญเติบโต</strong> ซึ่งมีพลังงานและ DHA เหมาะกับช่วงวัยมากกว่า");
      } else if (!isPuppy && formulaKey === "puppy") {
        notes.push("สูตร Puppy พลังงานสูงกว่าที่สุนัขโตต้องการ แนะนำเปลี่ยนเป็น <strong>สูตรไก่ & ข้าวกล้อง</strong> หรือ <strong>สูตรแซลมอน</strong>");
      } else if (stageKey === "senior") {
        notes.push("สำหรับน้องสูงวัย แนะนำแบ่งมื้อเล็ก ๆ และชั่งน้ำหนักตัวทุกเดือนเพื่อปรับปริมาณให้พอดี");
      } else {
        notes.push("ตัวเลขนี้เป็นจุดเริ่มต้นที่ดี — สังเกตรูปร่างน้องทุก 2 สัปดาห์ ถ้าเริ่มอ้วนหรือผอมไป ปรับเพิ่ม/ลดครั้งละ 10%");
      }
    } else {
      notes.push("อาหารปรุงเองต้อง<strong>สุกเต็มที่ ไม่ปรุงรส</strong> (ห้ามเกลือ น้ำตาล หัวหอม กระเทียม) และควรเสริมวิตามินรวมสำหรับสุนัขเพื่อให้สารอาหารครบถ้วนในระยะยาว");
      cautions.forEach(function (c) { notes.push(c); });
      if (isPuppy) {
        notes.push("ลูกสุนัขต้องการแคลเซียมและ DHA สูงเป็นพิเศษ แนะนำปรึกษาสัตวแพทย์ก่อนให้อาหารปรุงเองเป็นหลัก");
      }
    }

    /* always-on reminder — the real gauge is body condition, not the formula */
    notes.push("<strong>สำคัญ:</strong> ตัวเลขนี้อิงน้ำหนักตัวและเป็นค่าเริ่มต้น เมตาบอลิซึมของน้องแต่ละตัวต่างกันได้ถึง ±20% แม้สายพันธุ์เดียวกัน — ยึด<strong>รูปร่างตัวจริง (Body Condition Score)</strong> เป็นหลัก: คลำซี่โครงเจอแต่ไม่เห็นชัด และมีเอวคอดเมื่อมองจากด้านบน คือหุ่นในอุดมคติ");

    noteEl.innerHTML = notes.map(function (n) { return "<p>" + n + "</p>"; }).join("");

    resultEmpty.hidden = true;
    resultBody.hidden = false;

    if (window.innerWidth < 960) {
      resultBody.closest(".calc-result").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    calculate();
  });

  /* live re-calc after first result */
  form.addEventListener("change", function () {
    if (!resultBody.hidden) calculate();
  });
  weightInput.addEventListener("input", function () {
    if (!resultBody.hidden && weightInput.value) calculate();
  });
})();
