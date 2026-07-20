/* =========================================================
   DoGFood — interactions
   1. Sticky nav state
   2. Mobile menu
   3. Scroll-reveal (IntersectionObserver)
   4. Ingredient bars fill on view
   5. 3D pouch tilt toward pointer (desktop, motion-safe)
   6. Smooth close of mobile menu on anchor click
   ========================================================= */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Sticky nav ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (window.scrollY > 24) {
      nav.classList.add("is-scrolled");
    } else {
      nav.classList.remove("is-scrolled");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 2. Mobile menu ---------- */
  var burger = document.getElementById("navBurger");
  var links = document.getElementById("navLinks");

  function closeMenu() {
    burger.classList.remove("is-open");
    links.classList.remove("is-open");
    nav.classList.remove("menu-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "เปิดเมนู");
  }

  burger.addEventListener("click", function () {
    var open = links.classList.toggle("is-open");
    burger.classList.toggle("is-open", open);
    nav.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "ปิดเมนู" : "เปิดเมนู");
  });

  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A") closeMenu();
  });

  /* ---------- 3 & 4. Scroll reveal + ingredient bars ---------- */
  var revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");

            // fill any ingredient bars inside the revealed element
            entry.target.querySelectorAll(".ing-bar__fill").forEach(function (bar) {
              bar.classList.add("is-filled");
            });

            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    // no observer support or reduced motion: show everything immediately
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    document.querySelectorAll(".ing-bar__fill").forEach(function (bar) {
      bar.classList.add("is-filled");
    });
  }

  /* ---------- 5. 3D pouch tilt ---------- */
  var stage = document.getElementById("pouchStage");
  var pouch = document.getElementById("pouch");
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (stage && pouch && canHover && !prefersReducedMotion) {
    var baseY = -14; // matches CSS resting rotation
    var baseX = 4;

    stage.addEventListener("pointermove", function (e) {
      var rect = stage.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 → 0.5
      var relY = (e.clientY - rect.top) / rect.height - 0.5;
      var rotY = baseY + relX * 22;
      var rotX = baseX - relY * 14;
      pouch.style.transform = "rotateY(" + rotY.toFixed(2) + "deg) rotateX(" + rotX.toFixed(2) + "deg)";
    });

    stage.addEventListener("pointerleave", function () {
      pouch.style.transform = "";
    });
  }

  /* ---------- 6. Keep only one FAQ open at a time ---------- */
  var faqItems = document.querySelectorAll(".faq__item");
  faqItems.forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (item.open) {
        faqItems.forEach(function (other) {
          if (other !== item) other.open = false;
        });
      }
    });
  });
})();
