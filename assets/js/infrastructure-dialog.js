// Progressive enhancement only: both Infrastructure triggers are real
// <a href="beds/bed-03-thermal-traces.html"> elements. Without this
// script, clicking either one just navigates there directly -- the
// standalone page is the entire no-JS fallback, nothing else is needed.
//
// With this script, that navigation is intercepted and the same
// content is shown instead as a non-modal reference panel, managed by
// the shared assets/js/content-panel.js (which enforces that Energy,
// Seed, Soil, Image Reduction, Screen Traces, Infrastructure, and any
// future static panel are mutually exclusive). Mirrors
// assets/js/screen-traces-dialog.js's registration exactly.
(function () {
  var dialog = document.getElementById("infrastructure-dialog");
  var closeButton = dialog ? dialog.querySelector(".map-content-dialog-close") : null;
  var triggers = [
    document.getElementById("infrastructure-trigger-map"),
    document.getElementById("infrastructure-trigger-index"),
  ].filter(Boolean);

  if (!window.ContentPanel) {
    return;
  }

  window.ContentPanel.register(dialog, closeButton, triggers);
})();
