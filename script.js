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

  // Backend base URL from the <meta name="oshi-api-base"> tag. When empty, the
  // forms run in offline mode: validate + confirm with no network call, so the
  // site works before the backend is deployed. See backend/README.md.
  var metaApi = document.querySelector('meta[name="oshi-api-base"]');
  var API_BASE = ((metaApi && metaApi.content) || "").trim().replace(/\/+$/, "");

  function setStatus(el, message, state) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("ok", "err");
    if (state) el.classList.add(state);
  }

  function validate(form, statusEl) {
    var fields = form.querySelectorAll("input[required], textarea[required]");
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (!field.value.trim()) {
        setStatus(statusEl, "Please fill in all fields.", "err");
        field.focus();
        return false;
      }
      if (field.type === "email" && !EMAIL_RE.test(field.value.trim())) {
        setStatus(statusEl, "Please enter a valid email address.", "err");
        field.focus();
        return false;
      }
    }
    return true;
  }

  function collectPayload(form) {
    var data = { type: form.getAttribute("data-signup-type") || "newsletter" };
    var els = form.querySelectorAll("input, textarea, select");
    for (var i = 0; i < els.length; i++) {
      if (els[i].name) data[els[i].name] = els[i].value;
    }
    return data;
  }

  function handleSubmit(form, statusEl, successMsg) {
    if (!validate(form, statusEl)) return;

    var payload = collectPayload(form);

    // Honeypot filled => bot. Confirm to avoid signalling, but send nothing.
    // Offline mode (no backend configured) => confirm without a network call.
    if (payload.website || !API_BASE) {
      setStatus(statusEl, successMsg, "ok");
      form.reset();
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    setStatus(statusEl, "Sending…", "ok");

    fetch(API_BASE + "/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        setStatus(statusEl, successMsg, "ok");
        form.reset();
      })
      .catch(function () {
        setStatus(statusEl, "Sorry — something went wrong. Please try again.", "err");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function wireForm(formId, statusId, successMsg) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      handleSubmit(form, document.getElementById(statusId), successMsg);
    });
  }

  wireForm(
    "newsletterForm", "newsletterStatus",
    "Thanks! You're on the list — watch your inbox for the next challenge."
  );
  wireForm(
    "challengeForm", "challengeStatus",
    "Challenge received — thank you! We'll be in touch to help scope it."
  );
  wireForm(
    "gridForm", "gridStatus",
    "You're on the volunteer list — thank you! We'll notify you when the client is ready for your platform."
  );
})();
