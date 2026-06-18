/* ===================================================================
   OSHI Arena — progressive enhancement
   - Sticky-header shadow on scroll
   - Mobile nav toggle
   - Smooth-close nav on link click
   - Client-side form validation + friendly status messaging

   Forms here are wired for an MVP: they validate and surface a
   confirmation. To go live, point `submitForm()` at a real endpoint
   (Formspree, Supabase, FastAPI, etc.) — see README "Forms".
   =================================================================== */
(function () {
  "use strict";

  /* ---- Current year in footer ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- Sticky header shadow ---- */
  var header = document.getElementById("siteHeader");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Mobile navigation ---- */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("primaryNav");

  function closeNav() {
    if (!nav || !toggle) return;
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeNav();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
  }

  /* ---- Forms ---- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setStatus(el, message, ok) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("ok", "err");
    el.classList.add(ok ? "ok" : "err");
  }

  /**
   * MVP submit handler. Validates required fields then shows a
   * confirmation. Replace the body with a fetch() to your endpoint
   * when wiring real delivery.
   */
  function submitForm(form, statusEl, successMsg) {
    var fields = form.querySelectorAll("input[required], textarea[required]");
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (!field.value.trim()) {
        setStatus(statusEl, "Please fill in all fields.", false);
        field.focus();
        return false;
      }
      if (field.type === "email" && !EMAIL_RE.test(field.value.trim())) {
        setStatus(statusEl, "Please enter a valid email address.", false);
        field.focus();
        return false;
      }
    }
    setStatus(statusEl, successMsg, true);
    form.reset();
    return true;
  }

  var newsletter = document.getElementById("newsletterForm");
  if (newsletter) {
    newsletter.addEventListener("submit", function (e) {
      e.preventDefault();
      submitForm(
        newsletter,
        document.getElementById("newsletterStatus"),
        "Thanks! You're on the list — watch your inbox for the next challenge."
      );
    });
  }

  var challenge = document.getElementById("challengeForm");
  if (challenge) {
    challenge.addEventListener("submit", function (e) {
      e.preventDefault();
      submitForm(
        challenge,
        document.getElementById("challengeStatus"),
        "Challenge received — thank you! We'll be in touch to help scope it."
      );
    });
  }
})();
