// Progressive enhancement only: all three Permacomputing triggers are
// real <a href="permacomputing.html"> elements. Without this script,
// clicking any of them just navigates there directly -- the standalone
// page is the entire no-JS fallback, nothing else is needed.
//
// With this script, that navigation is intercepted and the same
// content is shown instead as a non-modal reference panel, managed by
// the shared assets/js/content-panel.js (which enforces that Energy,
// Seed, Soil, Permacomputing, and any future static panel are mutually
// exclusive). Mirrors assets/js/soil-dialog.js's registration exactly,
// with one extra trigger: the "→ PERMACOMPUTING" link inside the SOIL
// panel's own body. Registering it here (rather than writing bespoke
// "close Soil first" code) is enough on its own -- ContentPanel.open()
// already closes whichever panel is currently active, Soil included,
// before opening this one.
(function () {
  var dialog = document.getElementById("permacomputing-dialog");
  var closeButton = dialog ? dialog.querySelector(".map-content-dialog-close") : null;
  var triggers = [
    document.getElementById("permacomputing-trigger-map"),
    document.getElementById("permacomputing-trigger-index"),
    document.getElementById("soil-permacomputing-link"),
  ].filter(Boolean);

  if (!window.ContentPanel) {
    return;
  }

  window.ContentPanel.register(dialog, closeButton, triggers);
})();
