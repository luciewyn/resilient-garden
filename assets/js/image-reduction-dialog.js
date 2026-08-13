// Progressive enhancement only: both Image Reduction triggers are real
// <a href="beds/bed-01-image-reduction.html"> elements. Without this
// script, clicking either one just navigates there directly -- the
// standalone page is the entire no-JS fallback, nothing else is needed.
//
// With this script, that navigation is intercepted and the same
// content is shown instead as a non-modal reference panel, managed by
// the shared assets/js/content-panel.js (which enforces that Energy,
// Seed, Soil, Image Reduction, and any future static panel are
// mutually exclusive). Mirrors assets/js/soil-dialog.js's registration
// exactly.
(function () {
  var dialog = document.getElementById("image-reduction-dialog");
  var closeButton = dialog ? dialog.querySelector(".map-content-dialog-close") : null;
  var triggers = [
    document.getElementById("image-reduction-trigger-map"),
    document.getElementById("image-reduction-trigger-index"),
  ].filter(Boolean);

  if (!window.ContentPanel) {
    return;
  }

  window.ContentPanel.register(dialog, closeButton, triggers);
})();
