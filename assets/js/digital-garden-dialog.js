// Progressive enhancement only: all three Digital Garden triggers are
// real <a href="digital-garden.html"> elements. Without this script,
// clicking any of them just navigates there directly -- the standalone
// page is the entire no-JS fallback, nothing else is needed.
//
// With this script, that navigation is intercepted and the same
// content is shown instead as a non-modal reference panel, managed by
// the shared assets/js/content-panel.js (which enforces that Energy,
// Seed, Soil, Permacomputing, Permapublishing, Community of Practice,
// Screen Materiality, Digital Garden, and any future static panel are
// mutually exclusive). Mirrors the other dialog scripts' registration
// exactly, with the same "→ DIGITAL GARDEN" link inside the SOIL
// panel's own body (SOIL now lists five areas) as a third trigger --
// registering it here is enough on its own to close Soil first, since
// ContentPanel.open() already closes whichever panel is currently
// active before opening this one.
(function () {
  var dialog = document.getElementById("digital-garden-dialog");
  var closeButton = dialog ? dialog.querySelector(".map-content-dialog-close") : null;
  var triggers = [
    document.getElementById("digital-garden-trigger-map"),
    document.getElementById("digital-garden-trigger-index"),
    document.getElementById("soil-digital-garden-link"),
  ].filter(Boolean);

  if (!window.ContentPanel) {
    return;
  }

  window.ContentPanel.register(dialog, closeButton, triggers);
})();
