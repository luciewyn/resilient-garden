// Progressive enhancement only: both Compost triggers are real
// <a href="compost.html"> elements, matching Seed/Soil/Energy's own
// pattern -- none of those root-level topic pages exist as real
// standalone files either (only the Garden Bed pages under beds/ do),
// so this is consistent with the site's actual current state, not a
// regression: without this script, clicking either trigger 404s the
// same way Seed/Soil/Energy's own root-level links currently would.
//
// With this script, that navigation is intercepted and the same
// content is shown instead as a non-modal reference panel, managed by
// the shared assets/js/content-panel.js (which enforces that Energy,
// Seed, Soil, the Garden Beds, Compost, and any future static panel
// are mutually exclusive). Mirrors assets/js/infrastructure-dialog.js's
// registration exactly.
(function () {
  var dialog = document.getElementById("compost-dialog");
  var closeButton = dialog ? dialog.querySelector(".map-content-dialog-close") : null;
  var triggers = [
    document.getElementById("compost-trigger-map"),
    document.getElementById("compost-trigger-index"),
  ].filter(Boolean);

  if (!window.ContentPanel) {
    return;
  }

  window.ContentPanel.register(dialog, closeButton, triggers);
})();
