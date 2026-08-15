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
// PAGE 5's image works the same way: tools/greenhouse/script.js's
// [ ADD TO PRESSED EDITION ] button is the one authoritative place an
// image is made and chosen (Greenhouse is where it's MADE; this page
// only displays what was selected there) -- it stores a JSON RECORD in
// sessionStorage, not just a bare data URL: { image, originalBytes,
// outputBytes, originalWidth, originalHeight, outputWidth,
// outputHeight, parameters: {...} }, all real values read off Greenhouse's
// own state and the actual encoded Blob (see that file's
// buildPressedEditionMetadata()). Clicking USE DEFAULT IMAGE below
// writes buildDefaultRecord() into that SAME storage slot, so a chosen
// default and a real Greenhouse selection are indistinguishable from
// then on -- one resolved record, not two competing ones -- and always
// overwrites whatever was there, even an already-selected Greenhouse
// image. getStoredRecord() reads whichever is there; PAGE 5 uses its
// .image, PAGE 4's [ IMAGE DATA ] section (renderPressedEditionImageData())
// uses everything else from the SAME record, so the two pages can never
// drift out of sync -- changing the selection re-renders both. If
// nothing is resolved yet, the [ IMAGE ] placeholder in
// pressed-edition.html shows instead and PAGE 4's section stays hidden.
// PAGE 5 is a persistent editing surface on screen: its light-grey
// background, dimmed image/placeholder, and its two controls (OPEN IN
// GREENHOUSE / USE DEFAULT IMAGE, centred as an overlay on top) stay
// visible regardless of whether an image is currently resolved -- only
// print switches it to a plain white, image-only page (assets/css/
// pressed-edition-print.css). Printing auto-resolves to the default
// first if nothing was chosen, so the Pressed Edition always stays
// printable without requiring a screen visit first.
//
// Orientation (not full-bleed cover-crop): classifyOrientation() checks
// the image's own naturalWidth/naturalHeight once it has loaded --
// never the filename or an assumption -- and toggles
// .is-landscape-rotated so only landscape sources get the rotation CSS
// applies (a plain calc()-based swapped-dimension frame, same
// technique as PAGE 2's Garden Map poster -- the controls are an
// absolutely positioned overlay now, not a layout sibling, so the
// stage stays a fixed mm size and needs no runtime measurement). This
// only affects PAGE 5's own rendering: neither the Greenhouse canvas
// nor the sessionStorage data URL itself is ever rotated.
//
// The print button just waits for the local jgs7 font to be ready,
// then calls window.print() -- no PDF library, no screenshot, no
// server round-trip.
(function () {
  "use strict";

  var STORAGE_KEY = "resilient-garden:ascii-map-marks";
  var SHADE = "░";
  var DARK = "▓";

  // Set by tools/greenhouse/script.js's [ ADD TO PRESSED EDITION ]
  // button, and by USE DEFAULT IMAGE below -- same key, same
  // session-scoped storage, no second image-selection system.
  // sessionStorage (not localStorage): this selection belongs to the
  // current Garden visit, not a permanent preference.
  var PRESSED_EDITION_IMAGE_KEY = "resilient-garden-pressed-edition-image";

  // Same two flags assets/js/garden-return-flag.js and
  // assets/js/greenhouse-dialog.js already read -- OPEN IN GREENHOUSE
  // below reuses that existing return flow rather than a second one.
  var RETURNING_KEY = "resilient-garden-returning-to-garden";
  var OPEN_GREENHOUSE_KEY = "resilient-garden-open-greenhouse-on-return";

  // A real, already-authored asset -- not invented for this feature.
  // Fill in with the intended default Greenhouse-style result if one
  // exists. Left blank, USE DEFAULT IMAGE stays present but inert
  // (see setUpImageControls() below) and printing without a prior
  // selection still falls back to the placeholder state rather than a
  // broken image, so the page stays printable either way.
  var DEFAULT_PRESSED_EDITION_IMAGE = "";

  // Fill in alongside DEFAULT_PRESSED_EDITION_IMAGE above with that
  // asset's REAL Greenhouse metadata once it exists -- same shape as
  // the record tools/greenhouse/script.js's buildPressedEditionMetadata()
  // produces, so PAGE 4's [ IMAGE DATA ] section renders identically
  // for a chosen default as for a real Greenhouse selection. Leave any
  // individual value null if genuinely unknown (e.g. no original-file
  // size on record for this asset) -- buildImageDataRows() below omits
  // a row entirely rather than showing a fabricated number for it.
  var DEFAULT_PRESSED_EDITION_METADATA = {
    originalBytes: null,
    outputBytes: null,
    originalWidth: null,
    originalHeight: null,
    outputWidth: null,
    outputHeight: null,
    parameters: {
      downsample: null,
      bitDepth: null,
      ditherLevel: null,
      algorithm: null,
      colourMode: null
    }
  };

  function buildDefaultRecord() {
    return {
      image: DEFAULT_PRESSED_EDITION_IMAGE,
      originalBytes: DEFAULT_PRESSED_EDITION_METADATA.originalBytes,
      outputBytes: DEFAULT_PRESSED_EDITION_METADATA.outputBytes,
      originalWidth: DEFAULT_PRESSED_EDITION_METADATA.originalWidth,
      originalHeight: DEFAULT_PRESSED_EDITION_METADATA.originalHeight,
      outputWidth: DEFAULT_PRESSED_EDITION_METADATA.outputWidth,
      outputHeight: DEFAULT_PRESSED_EDITION_METADATA.outputHeight,
      parameters: DEFAULT_PRESSED_EDITION_METADATA.parameters
    };
  }

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

  // Reads the JSON record tools/greenhouse/script.js's [ ADD TO PRESSED
  // EDITION ] button (or buildDefaultRecord() below) wrote. A plain
  // string somehow left over from before this record format existed,
  // or any other malformed value, is treated the same as nothing
  // chosen yet -- never guessed at.
  function getStoredRecord() {
    var raw;
    try {
      raw = sessionStorage.getItem(PRESSED_EDITION_IMAGE_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) {
      return null;
    }
    try {
      var record = JSON.parse(raw);
      if (record && typeof record === "object" && typeof record.image === "string" && record.image) {
        return record;
      }
    } catch (err) {
      // fall through
    }
    return null;
  }

  function setStoredRecord(record) {
    try {
      sessionStorage.setItem(PRESSED_EDITION_IMAGE_KEY, JSON.stringify(record));
      return true;
    } catch (err) {
      return false;
    }
  }

  // KiB/MiB, two decimal places -- matches the site's other manually
  // authored size figures (e.g. Garden Status's page-weight note).
  function formatBytes(bytes) {
    if (typeof bytes !== "number" || isNaN(bytes)) {
      return null;
    }
    var KiB = 1024;
    var MiB = KiB * 1024;
    if (Math.abs(bytes) >= MiB) {
      return (bytes / MiB).toFixed(2) + " MiB";
    }
    if (Math.abs(bytes) >= KiB) {
      return (bytes / KiB).toFixed(2) + " KiB";
    }
    return bytes + " B";
  }

  // The real result, one decimal place -- including a negative
  // percentage if the output is actually larger than the original.
  // Never clamped to look like a saving that didn't happen.
  function formatSavedPercent(originalBytes, outputBytes) {
    if (typeof originalBytes !== "number" || !originalBytes || typeof outputBytes !== "number") {
      return null;
    }
    var saved = ((originalBytes - outputBytes) / originalBytes) * 100;
    return saved.toFixed(1) + "%";
  }

  // Every row is independently optional: a value that's null/missing
  // on the record (e.g. the default image's not-yet-filled-in
  // metadata) simply produces no row, rather than a fabricated one --
  // see DEFAULT_PRESSED_EDITION_METADATA above.
  function buildImageDataRows(record) {
    var rows = [];
    var originalBytes = record.originalBytes;
    var outputBytes = record.outputBytes;
    var params = record.parameters || {};

    var originalFormatted = formatBytes(originalBytes);
    if (originalFormatted) {
      rows.push(["Original", originalFormatted]);
    }

    var outputFormatted = formatBytes(outputBytes);
    if (outputFormatted) {
      rows.push(["Output", outputFormatted]);
    }

    var savedFormatted = formatSavedPercent(originalBytes, outputBytes);
    if (savedFormatted) {
      rows.push(["Saved", savedFormatted]);
    }

    if (record.outputWidth && record.outputHeight) {
      rows.push(["Dimensions", record.outputWidth + " × " + record.outputHeight + " px"]);
    }

    if (typeof params.bitDepth === "number") {
      rows.push(["Bit depth", params.bitDepth + "-bit"]);
    }

    if (params.algorithm) {
      var ditherValue = params.algorithm;
      if (typeof params.ditherLevel === "number") {
        ditherValue += " (" + params.ditherLevel + "%)";
      }
      rows.push(["Dithering", ditherValue]);
    }

    if (params.colourMode) {
      rows.push(["Colour", params.colourMode]);
    }

    return rows;
  }

  // PAGE 4: the [ IMAGE DATA ] section describing whichever record
  // PAGE 5 is currently showing -- called every time that record is
  // (re)resolved, in renderPressedEditionImage() below, so the two
  // pages can never show different images/values at once. Hidden
  // entirely (not just empty) while nothing is resolved.
  function renderPressedEditionImageData(record) {
    var section = document.getElementById("pressed-edition-image-data");
    var list = document.getElementById("pressed-edition-image-data-list");

    if (!section || !list) {
      return;
    }

    if (!record) {
      section.hidden = true;
      list.textContent = "";
      return;
    }

    var rows = buildImageDataRows(record);
    list.textContent = "";
    rows.forEach(function (pair) {
      var row = document.createElement("div");
      row.className = "image-data-row";
      var dt = document.createElement("dt");
      dt.textContent = pair[0];
      var dd = document.createElement("dd");
      dd.textContent = pair[1];
      row.appendChild(dt);
      row.appendChild(dd);
      list.appendChild(row);
    });

    section.hidden = rows.length === 0;
  }

  // Decided from the actual decoded image, not the filename or any
  // assumption -- called only once the image has finished loading, so
  // naturalWidth/naturalHeight are already known. Square counts as
  // "not landscape": ties don't rotate.
  function classifyOrientation(img) {
    if (img.naturalWidth > img.naturalHeight) {
      img.classList.add("is-landscape-rotated");
    } else {
      img.classList.remove("is-landscape-rotated");
    }
  }

  // PAGE 5 (+ PAGE 4's [ IMAGE DATA ], via renderPressedEditionImageData()):
  // resolves to whichever of [Greenhouse selection, chosen default]
  // sessionStorage currently holds -- see the top-of-file comment for
  // why those two share one record. Returns a Promise that settles
  // once PAGE 5 has reached its final, classified state (image
  // revealed and oriented, or the placeholder showing) -- the print
  // flow below awaits this so a print can never fire mid-classification.
  // The two controls are never touched here: they stay visible
  // regardless of this outcome (assets/css/pressed-edition-print.css
  // hides them only in print).
  function renderPressedEditionImage() {
    var img = document.getElementById("pressed-edition-selected-image");
    var placeholder = document.getElementById("pressed-edition-image-placeholder");

    if (!img) {
      return Promise.resolve();
    }

    var record = getStoredRecord();
    renderPressedEditionImageData(record);

    if (!record) {
      img.hidden = true;
      img.removeAttribute("src");
      img.classList.remove("is-landscape-rotated");
      if (placeholder) {
        placeholder.hidden = false;
      }
      return Promise.resolve();
    }

    if (placeholder) {
      placeholder.hidden = true;
    }

    return new Promise(function (resolve) {
      function reveal() {
        classifyOrientation(img);
        img.hidden = false;
        resolve();
      }
      img.onload = reveal;
      img.onerror = function () {
        // Broken/unreadable source -- fail open rather than block
        // printing on it; back to the placeholder, same as no
        // selection at all, rather than a half-resolved state with
        // neither the image nor the placeholder showing. Clears PAGE
        // 4's data section too, so it never describes an image PAGE 5
        // isn't actually showing.
        img.hidden = true;
        img.removeAttribute("src");
        if (placeholder) {
          placeholder.hidden = false;
        }
        renderPressedEditionImageData(null);
        resolve();
      };
      img.src = record.image;
      // Already-cached/identical src may not refire "load" in every
      // engine -- handle the synchronously-already-decoded case too.
      if (img.complete && img.naturalWidth) {
        reveal();
      }
    });
  }

  // OPEN IN GREENHOUSE: a real <a href="index.html">, so it already
  // works with no JS at all -- lands on the Garden Map, just without
  // the auto-skip-Entrance/auto-open convenience below. With JS,
  // setting these same two flags assets/js/garden-return-flag.js and
  // assets/js/greenhouse-dialog.js already read makes that arrival
  // skip Entrance and reopen the SAME Greenhouse dialog automatically
  // -- never a second Greenhouse instance. Both controls are
  // persistent editing controls: they stay available whether or not
  // PAGE 5 already has an image showing.
  //
  // USE DEFAULT IMAGE: starts disabled in the HTML (there's no
  // non-JS way to write sessionStorage), enabled here once its click
  // handler actually exists. Writes buildDefaultRecord() into the SAME
  // slot a real Greenhouse selection uses, then re-renders immediately
  // -- this replaces whatever was resolved before, including an
  // already-selected Greenhouse image and its PAGE 4 data, since it's
  // the same storage slot either way.
  function setUpImageControls() {
    var openGreenhouseLink = document.getElementById("pressed-edition-open-greenhouse");
    var useDefaultButton = document.getElementById("pressed-edition-use-default");

    if (openGreenhouseLink) {
      openGreenhouseLink.addEventListener("click", function () {
        try {
          sessionStorage.setItem(RETURNING_KEY, "true");
          sessionStorage.setItem(OPEN_GREENHOUSE_KEY, "true");
        } catch (err) {
          // storage unavailable -- link still navigates to index.html,
          // just without the auto-skip-Entrance/auto-open behaviour
        }
      });
    }

    if (useDefaultButton) {
      // DEFAULT_PRESSED_EDITION_IMAGE isn't filled in yet -- leave the
      // button visible but inert rather than writing an empty string
      // into PRESSED_EDITION_IMAGE_KEY, which would just re-produce
      // the same empty state under a "resolved" appearance.
      if (DEFAULT_PRESSED_EDITION_IMAGE) {
        useDefaultButton.disabled = false;
      }

      useDefaultButton.addEventListener("click", function () {
        if (!DEFAULT_PRESSED_EDITION_IMAGE) {
          return;
        }
        if (setStoredRecord(buildDefaultRecord())) {
          renderPressedEditionImage();
        }
      });
    }
  }

  // Preferred fallback from the spec this implements: printing never
  // leaves PAGE 5 unresolved. If nothing has been chosen yet and a
  // default is configured, this silently resolves to it first (the
  // same as clicking USE DEFAULT IMAGE), so the exported PDF always
  // has an image (and PAGE 4 always has matching data) rather than a
  // blank panel. If no default is configured either, this is a no-op
  // and the panel prints blank -- see the DEFAULT_PRESSED_EDITION_IMAGE
  // comment above.
  function resolvePressedEditionImageForPrint() {
    if (!getStoredRecord() && DEFAULT_PRESSED_EDITION_IMAGE) {
      setStoredRecord(buildDefaultRecord());
    }
    return renderPressedEditionImage();
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
        return resolvePressedEditionImageForPrint();
      }).then(function () {
        renderCoverDate();
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

  // dd.mm.yyyy (European format, as the rest of the Pressed Edition's
  // authored dates already use). PAGE 1's copy number stays a plain
  // hand-edited string in pressed-edition.html -- only the date is
  // computed, from the real local Date the moment this runs, both on
  // load and again right before every print (same re-render-fresh
  // pattern renderPrintMap() and renderPressedEditionImage() already
  // follow), so it's never a stale value from an earlier visit.
  function renderCoverDate() {
    var el = document.getElementById("pressed-edition-cover-date");
    if (!el) {
      return;
    }
    var now = new Date();
    var dd = String(now.getDate()).padStart(2, "0");
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var yyyy = now.getFullYear();
    el.textContent = dd + "." + mm + "." + yyyy;
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
    renderPressedEditionImage();
    renderCoverDate();
    setUpImageControls();
    setUpPrintButton();
  });
})();
