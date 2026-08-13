// Progressive enhancement only: all three Community of Practice
// triggers are real <a href="community-of-practice.html"> elements.
// Without this script, clicking any of them just navigates there
// directly -- the standalone page is the entire no-JS fallback, nothing
// else is needed.
//
// With this script, that navigation is intercepted and the same
// content is shown instead as a non-modal reference panel, managed by
// the shared assets/js/content-panel.js (which enforces that Energy,
// Seed, Soil, Permacomputing, Permapublishing, Community of Practice,
// and any future static panel are mutually exclusive). Mirrors
// assets/js/permapublishing-dialog.js's registration exactly, with the
// same "→ COMMUNITIES OF PRACTICE" link inside the SOIL panel's own
// body as a third trigger -- registering it here is enough on its own
// to close Soil first, since ContentPanel.open() already closes
// whichever panel is currently active before opening this one.
(function () {
  var dialog = document.getElementById("community-dialog");
  var closeButton = dialog ? dialog.querySelector(".map-content-dialog-close") : null;
  var triggers = [
    document.getElementById("community-trigger-map"),
    document.getElementById("community-trigger-index"),
    document.getElementById("soil-community-link"),
  ].filter(Boolean);

  if (!window.ContentPanel) {
    return;
  }

  window.ContentPanel.register(dialog, closeButton, triggers);
})();
