// Progressive enhancement only: all three Screen Materiality triggers
// are real <a href="screen-materiality.html"> elements. Without this
// script, clicking any of them just navigates there directly -- the
// standalone page is the entire no-JS fallback, nothing else is
// needed.
//
// With this script, that navigation is intercepted and the same
// content is shown instead as a non-modal reference panel, managed by
// the shared assets/js/content-panel.js (which enforces that Energy,
// Seed, Soil, Permacomputing, Permapublishing, Community of Practice,
// Screen Materiality, and any future static panel are mutually
// exclusive). Mirrors assets/js/community-dialog.js's registration
// exactly, with the same "→ SCREEN MATERIALITY" link inside the SOIL
// panel's own body as a third trigger -- registering it here is enough
// on its own to close Soil first, since ContentPanel.open() already
// closes whichever panel is currently active before opening this one.
(function () {
  var dialog = document.getElementById("screen-materiality-dialog");
  var closeButton = dialog ? dialog.querySelector(".map-content-dialog-close") : null;
  var triggers = [
    document.getElementById("screen-materiality-trigger-map"),
    document.getElementById("screen-materiality-trigger-index"),
    document.getElementById("soil-screen-materiality-link"),
  ].filter(Boolean);

  if (!window.ContentPanel) {
    return;
  }

  window.ContentPanel.register(dialog, closeButton, triggers);
})();
