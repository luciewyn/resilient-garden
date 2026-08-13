// Progressive enhancement only: all Greenhouse triggers are real
// <a href="tools/greenhouse/index.html"> elements. Without this script,
// clicking any of them just navigates there directly -- the standalone
// tool page is the entire no-JS fallback, nothing else is needed.
//
// With this script, that navigation is intercepted and the same tool is
// shown instead inside a native <dialog> over the still-loaded map.
(function () {
  var dialog = document.getElementById("greenhouse-dialog");
  var iframe = dialog ? dialog.querySelector(".greenhouse-tool-frame") : null;
  var closeButton = dialog ? dialog.querySelector(".greenhouse-dialog-close") : null;
  var triggers = [
    document.getElementById("greenhouse-trigger-map"),
    document.getElementById("greenhouse-trigger-index"),
    // Image Reduction's "OPEN THE IMAGE TOOL IN THE GREENHOUSE" CTA
    // (assets/js/image-reduction-dialog.js's own panel) -- opening it
    // already closes the active content panel via the
    // window.ContentPanel.closeActive() call below, same as any other
    // trigger here.
    document.getElementById("image-reduction-greenhouse-cta"),
  ].filter(Boolean);

  if (!dialog || !iframe || !closeButton || !triggers.length) {
    return;
  }

  var iframeLoaded = false;
  var savedScrollY = 0;
  var lastTrigger = null;

  function openGreenhouse(triggerEl) {
    // Mirrors the same guard assets/js/ascii-map-drag.js and
    // assets/js/entrance.js use: the Greenhouse must stay inert for as
    // long as the Entrance hasn't been dismissed.
    if (document.body.classList.contains("intro-active")) {
      return;
    }

    // Greenhouse is not itself a managed static content panel (it stays
    // modal, with its own scroll lock/focus trap below), but at most one
    // of Greenhouse/Energy/Seed should ever be visible at once -- so
    // opening Greenhouse closes whichever static panel is currently
    // active first. restoreFocus: false, since focus is about to move
    // to this dialog's own close button instead.
    if (window.ContentPanel) {
      window.ContentPanel.closeActive({ restoreFocus: false });
    }

    if (!iframeLoaded) {
      iframe.src = iframe.dataset.src;
      iframeLoaded = true;
    }

    savedScrollY = window.scrollY;
    lastTrigger = triggerEl;

    document.documentElement.classList.add("dialog-open");
    dialog.showModal();
    // Focused here, not via a static autofocus attribute on the button:
    // autofocus fires at page-load time for any matching element in the
    // document regardless of whether its closed <dialog> ancestor is
    // actually open, which caused an unwanted focus + scroll-into-view
    // before the dialog was ever shown.
    closeButton.focus();
  }

  function closeGreenhouse() {
    document.documentElement.classList.remove("dialog-open");
    window.scrollTo(0, savedScrollY);
    if (lastTrigger) {
      lastTrigger.focus();
    }
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      openGreenhouse(trigger);
    });
  });

  closeButton.addEventListener("click", function () {
    dialog.close();
  });

  // Single source of truth for cleanup: "close" fires for Escape, the
  // close button's dialog.close(), and any future programmatic close
  // alike, so cleanup only lives in one place. Deliberately no
  // backdrop-click-to-close and no iframe-interior-click handling: the
  // iframe is same-origin but still a separate document, so clicks
  // inside it can never reach this listener at all.
  dialog.addEventListener("close", closeGreenhouse);
})();
