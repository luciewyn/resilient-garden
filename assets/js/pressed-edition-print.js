// Pressed Edition Web-to-Print: progressive enhancement only. Page 2's
// Garden Map text (structure, labels, ░ layout) is fetched from
// index.html -- the one authoritative source for the map's ASCII
// content -- rather than hand-maintained as a second copy here.
//
// That base text alone would be the ORIGINAL map, with none of the
// visitor's ░->▓ marks (assets/js/ascii-map-scale.js's darken()):
// pressed-edition.html is a separate document, so it can't
// cloneNode() the live map DOM the way a same-page print view could.
// What it CAN do is read the exact same localStorage record that DOM
// mutation is persisted to (assets/js/ascii-map-interaction.js,
// key STORAGE_KEY below) -- already the site's one shared, always-
// current record of which cells are marked, on the same origin, no
// transfer step needed -- and replay it onto the fetched base text in
// the same left-to-right/top-to-bottom shade-cell order that script
// uses. That reconstructs the map exactly as it currently stands for
// this visitor, marks included, without a second mark-storage system.
//
// Rebuilt fresh (marks re-read from localStorage) both on page load
// and again right before every print, so a visitor who leaves more
// footprints, returns to an already-open Pressed Edition tab, and
// prints again sees all of them -- never a stale first-open snapshot.
//
// The field also depletes right-to-left following Garden Status's
// manually authored Energy value (index.html's #garden-energy-level),
// via the same shared, deterministic column-cutoff math the live map
// uses -- see assets/js/ascii-map-density.js and applyEnergyDensity()
// below. This applies to ▓ footprints too, not just ░ background: one
// past its row's cutoff is hidden along with the background.
//
// The print button just waits for the local jgs7 font to be ready,
// then calls window.print() -- no PDF library, no screenshot, no
// server round-trip.
(function () {
  "use strict";

  var STORAGE_KEY = "resilient-garden:ascii-map-marks";
  var SHADE = "░";
  var DARK = "▓";

  var cachedBase = null; // { text, energyPercent } -- neither changes at runtime, only the marks do

  function fetchBase() {
    if (cachedBase !== null) {
      return Promise.resolve(cachedBase);
    }
    return fetch("index.html")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Garden Map fetch failed: " + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var source = doc.querySelector(".ascii-garden-map");
        if (!source || !source.textContent.trim()) {
          throw new Error("Garden Map source not found in index.html");
        }

        // Same manually authored Garden Status value the live map reads
        // (index.html's #garden-energy-level[data-level]) -- read from
        // this same fetched document rather than a second request.
        var energyPercent = 100;
        var energyEl = doc.getElementById("garden-energy-level");
        if (energyEl) {
          var level = Number(energyEl.getAttribute("data-level"));
          if (!isNaN(level)) {
            energyPercent = level;
          }
        }

        cachedBase = { text: source.textContent, energyPercent: energyPercent };
        return cachedBase;
      });
  }

  function loadCurrentMarks() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null; // storage unavailable -- print the unmarked map rather than fail
    }
    if (!raw) {
      return null;
    }
    try {
      var data = JSON.parse(raw);
      if (data && Array.isArray(data.marks) && typeof data.total === "number") {
        return data;
      }
    } catch (err) {
      // fall through
    }
    return null;
  }

  // Same scan order as assets/js/ascii-map-scale.js's buildMarkup(): shade-cell
  // index N is the Nth ░ character encountered left-to-right, top-to-bottom
  // (newlines and every other character just pass through uncounted), so a
  // stored index here always means the same cell it meant on the live map.
  function applyCurrentMarks(baseText) {
    var marks = loadCurrentMarks();
    if (!marks) {
      return baseText;
    }

    var shadeCount = 0;
    for (var i = 0; i < baseText.length; i++) {
      if (baseText[i] === SHADE) {
        shadeCount++;
      }
    }
    if (marks.total !== shadeCount) {
      // Map text doesn't match what these marks were saved against --
      // discard rather than risk darkening the wrong cells (mirrors the
      // live map's own guard in assets/js/ascii-map-interaction.js).
      return baseText;
    }

    var markedIndexes = {};
    for (var m = 0; m < marks.marks.length; m++) {
      markedIndexes[marks.marks[m]] = true;
    }

    var out = "";
    var index = 0;
    for (var j = 0; j < baseText.length; j++) {
      var ch = baseText[j];
      if (ch === SHADE) {
        out += markedIndexes[index] ? DARK : SHADE;
        index++;
      } else {
        out += ch;
      }
    }
    return out;
  }

  // Same row/column-per-character scan used to write data-row/data-col
  // on the live map's spans (assets/js/ascii-map-scale.js's
  // buildMarkup()), so this always agrees with the live map for the
  // same source text -- right-to-left depletion with a per-row terrain
  // edge, not row striping (assets/js/ascii-map-density.js has the one
  // shared cutoff formula both use). Runs AFTER marks are applied, and
  // checks ▓ the same as ░: a footprint past its row's cutoff is hidden
  // along with the background, not exempted.
  function applyEnergyDensity(text, energyPercent) {
    if (!window.AsciiMapDensity) {
      return text; // shared density math not loaded -- leave the map at full density
    }
    var maxCol = window.AsciiMapDensity.computeMaxCol(text);
    var rowCount = text.split("\n").length;
    var terrainOffsets = window.AsciiMapDensity.buildTerrainOffsets(rowCount);
    var out = "";
    var row = 0;
    var col = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === "\n") {
        out += ch;
        row++;
        col = 0;
        continue;
      }
      if (ch === SHADE || ch === DARK) {
        var visible = window.AsciiMapDensity.isColumnVisible(col, row, maxCol, energyPercent, terrainOffsets);
        out += visible ? ch : " ";
      } else {
        out += ch;
      }
      col++;
    }
    return out;
  }

  // Marks are indexed against the FULL base text (including Harvest) before
  // this ever runs, so cutting rows here doesn't touch shade-cell numbering
  // -- this only shortens what gets displayed, not how marks are counted.
  function dropHarvestOnward(rows) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].indexOf("[ HARVEST ]") !== -1) {
        return rows.slice(0, i);
      }
    }
    return rows; // label not found (map text changed) -- print everything rather than guess
  }

  function renderPrintMap() {
    var target = document.getElementById("print-garden-map");
    var fallback = document.getElementById("print-map-fallback");

    if (!target) {
      return Promise.resolve();
    }

    return fetchBase()
      .then(function (base) {
        var text = applyCurrentMarks(base.text);
        text = applyEnergyDensity(text, base.energyPercent);

        // One <div> per row rather than a single ~30,000-character text
        // node: Chromium's print/PDF pagination (confirmed directly,
        // not assumed) mis-fragments one giant absolutely-positioned
        // text node at this size, silently spilling it across extra
        // pages even though its own measured height fits the sheet.
        // Splitting per row sidesteps that without changing what's on
        // the page -- still the same real ASCII/Unicode text, just as
        // many small text nodes instead of one huge one.
        //
        // The print poster stops before [ HARVEST ] and its surrounding
        // artwork (the interactive map on index.html is untouched --
        // this only trims what this print-only reconstruction shows).
        var rows = dropHarvestOnward(text.split("\n"));
        var fragment = document.createDocumentFragment();
        rows.forEach(function (row) {
          var rowEl = document.createElement("div");
          rowEl.className = "print-garden-map-row";
          rowEl.textContent = row;
          fragment.appendChild(rowEl);
        });
        target.textContent = "";
        target.appendChild(fragment);

        if (fallback) {
          fallback.hidden = true;
        }
      })
      .catch(function () {
        if (fallback) {
          fallback.textContent =
            "The Garden Map could not be loaded automatically. Open index.html once in this browser tab, then reload this page before printing.";
        }
      });
  }

  function setUpPrintButton() {
    var printButton = document.getElementById("print-pressed-edition");

    if (!printButton) {
      return;
    }

    printButton.addEventListener("click", function () {
      // Re-render immediately before printing -- not just on page load --
      // so marks left in another already-open tab since this page loaded
      // are still included.
      renderPrintMap().then(function () {
        var fontsReady =
          document.fonts && document.fonts.ready
            ? document.fonts.ready
            : Promise.resolve();
        return fontsReady;
      }).then(function () {
        window.print();
      });
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    renderPrintMap();
    setUpPrintButton();
  });
})();
