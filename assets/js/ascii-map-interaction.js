// Progressive enhancement only: without this script the map stays fully
// readable with no ░ -> ▓ interaction lost except this decorative one.
//
// The actual markup (.shade-cell spans, .map-primary-label spans) is
// built by assets/js/ascii-map-scale.js instead of here, as the first
// step of its one authoritative render -> fonts -> layout -> scale
// startup sequence -- see that file for why. This script only adds
// click/drag interaction and persisted-mark storage on top of the spans
// it exposes via window.AsciiMapRender, so it has to load after that
// script (see the <script> order in index.html).
(function () {
  var map = document.querySelector(".ascii-garden-map");
  var frame = document.querySelector(".ascii-map-frame");
  var renderer = window.AsciiMapRender;

  if (!map || !frame || !renderer) {
    return;
  }

  var STORAGE_KEY = "resilient-garden:ascii-map-marks";
  var DRAG_THRESHOLD = 5; // px -- matches assets/js/ascii-map-drag.js

  var shadeCells = renderer.shadeCells;
  var darken = renderer.darken;

  function loadMarks() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return; // storage unavailable (private mode, disabled, etc.) -- session-only
    }
    if (!raw) {
      return;
    }
    var data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return;
    }
    if (!data || !Array.isArray(data.marks) || data.total !== shadeCells.length) {
      // Map regenerated with a different shade-cell count since these
      // marks were saved -- discard rather than risk applying them to
      // the wrong cells.
      return;
    }
    for (var i = 0; i < data.marks.length; i++) {
      darken(shadeCells[data.marks[i]]);
    }
  }

  function saveMark(index) {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return;
    }
    var data = { total: shadeCells.length, marks: [] };
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.marks) && parsed.total === shadeCells.length) {
          data = parsed;
        }
      } catch (err) {
        // fall through with a fresh record
      }
    }
    if (data.marks.indexOf(index) === -1) {
      data.marks.push(index);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // storage unavailable/full -- interaction still works, just not saved
    }
  }

  loadMarks();

  // Click-vs-drag: assets/js/ascii-map-drag.js calls frame.setPointerCapture()
  // on pointerdown, which retargets subsequent pointermove/pointerup
  // events' e.target to the capturing element (the frame), not the span
  // under the cursor -- so e.target can't be trusted here. Tracked
  // independently (no shared state with the drag script) using the same
  // distance-from-press rule, and elementFromPoint() at release time to
  // find the real element regardless of capture retargeting.
  var downX = null;
  var downY = null;
  var draggedPastThreshold = false;

  frame.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button !== 0) {
      return;
    }
    downX = e.clientX;
    downY = e.clientY;
    draggedPastThreshold = false;
  });

  frame.addEventListener("pointermove", function (e) {
    if (downX === null || draggedPastThreshold) {
      return;
    }
    var dx = e.clientX - downX;
    var dy = e.clientY - downY;
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      draggedPastThreshold = true;
    }
  });

  frame.addEventListener("pointerup", function (e) {
    if (downX === null) {
      return;
    }
    var wasClick = !draggedPastThreshold;
    downX = null;
    downY = null;
    if (!wasClick) {
      return;
    }
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || !target.classList || !target.classList.contains("shade-cell")) {
      return;
    }
    var index = Number(target.getAttribute("data-i"));
    darken(target);
    saveMark(index);
  });

  frame.addEventListener("pointercancel", function () {
    downX = null;
    downY = null;
    draggedPastThreshold = false;
  });
})();
