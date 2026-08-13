// Progressive enhancement only: without this script the ASCII map is
// still fully readable and navigable via normal document scrolling
// (wheel, trackpad, scrollbar, keyboard). This just adds "grab the map
// and move it like paper" as an additional way to scroll the same
// document -- it never introduces its own scroll container, transform,
// or coordinate system.
//
// pointerType is checked so only the actual mouse is affected: touch
// pointers are ignored entirely (never captured, never tracked), so a
// touchscreen's native single-finger scrolling is untouched.
(function () {
  var frame = document.querySelector(".ascii-map-frame");

  if (!frame) {
    return;
  }

  var DRAG_THRESHOLD = 5; // px

  var isPointerDown = false;
  var isDragging = false;
  var lastX = 0;
  var lastY = 0;
  var activePointerId = null;

  // Dragging must never start from a fixed interface layer (header,
  // Entrance, Map Index, Garden Status, an open Energy/Seed content
  // panel) or from an interactive control. Listening on
  // .ascii-map-frame already rules out the fixed layers, since none of
  // them are descendants of it -- this check is a second, explicit
  // guard for anything interactive that ever ends up inside the frame
  // itself. dialog/.map-content-dialog are included defensively even
  // though the content panels currently live outside .ascii-map-frame
  // in the DOM (so a pointerdown on one can't bubble to this listener
  // in the first place) -- in case that ever changes.
  function isExcludedTarget(target) {
    return !!(
      target.closest &&
      target.closest(
        "a, button, input, select, textarea, summary, details, dialog, " +
          ".site-header, .entrance-overlay, .map-panel, .map-content-dialog"
      )
    );
  }

  // The map is a visual field to grab and move, not selectable text --
  // without this, a plain mousedown-and-move on the background starts a
  // native text-selection drag (the blue highlight rectangle) before
  // the 5px threshold even resolves whether the gesture is a click or
  // a drag.
  function clearTextSelection() {
    var selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }

  function onPointerDown(e) {
    if (e.pointerType !== "mouse" || e.button !== 0) {
      return;
    }
    if (document.body.classList.contains("intro-active")) {
      return;
    }
    // The Greenhouse dialog covers the map already (native <dialog>
    // top-layer stacking), but this also blocks drag from starting in
    // any exposed margin around it while it's open.
    if (document.documentElement.classList.contains("dialog-open")) {
      return;
    }
    if (isExcludedTarget(e.target)) {
      return;
    }

    e.preventDefault();
    clearTextSelection();

    isPointerDown = true;
    isDragging = false;
    lastX = e.clientX;
    lastY = e.clientY;
    activePointerId = e.pointerId;
    frame.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!isPointerDown || e.pointerId !== activePointerId) {
      return;
    }

    if (!isDragging) {
      var totalDx = e.clientX - lastX;
      var totalDy = e.clientY - lastY;
      if (Math.hypot(totalDx, totalDy) < DRAG_THRESHOLD) {
        return;
      }
      isDragging = true;
      frame.classList.add("is-dragging");
      // A second clear right as dragging is confirmed: the pointerdown
      // clear handles the common case, this covers a selection that
      // started from some other prior interaction and was still active
      // when this gesture began.
      clearTextSelection();
    }

    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;

    // Horizontal: pans .ascii-map-frame's own scroll position. A no-op
    // whenever the map has no horizontal overflow (the common case,
    // since ascii-map-scale.js scales the map to exactly fill the
    // frame's width) -- by design, not a bug.
    frame.scrollLeft -= dx;

    // Vertical: moves the real document scroll position (not a
    // transform on the <pre>), so the browser's own scrollbar and
    // scroll limits stay authoritative.
    window.scrollBy({ top: -dy, left: 0, behavior: "auto" });

    lastX = e.clientX;
    lastY = e.clientY;

    // Keeps suppressing default browser behavior (text selection, image
    // drag) for the rest of the gesture, on top of the pointerdown call.
    e.preventDefault();
  }

  function endDrag(e) {
    if (activePointerId !== null) {
      try {
        frame.releasePointerCapture(activePointerId);
      } catch (err) {
        // Pointer capture may already have been released implicitly
        // (e.g. pointercancel); nothing further to do.
      }
    }
    isPointerDown = false;
    isDragging = false;
    activePointerId = null;
    frame.classList.remove("is-dragging");
  }

  frame.addEventListener("pointerdown", onPointerDown);
  frame.addEventListener("pointermove", onPointerMove);
  frame.addEventListener("pointerup", endDrag);
  frame.addEventListener("pointercancel", endDrag);
})();
