// Pure, deterministic right-to-left depletion math, shared by two
// independent consumers rather than duplicated:
//   - the live Garden Map (assets/js/ascii-map-interaction.js, which
//     mutates the already-rendered .shade-cell spans -- see
//     assets/js/ascii-map-scale.js's data-row/data-col attributes on
//     each one);
//   - the Pressed Edition print reconstruction (assets/js/
//     pressed-edition-print.js, which re-derives the same rows/columns
//     from plain fetched text, since it can't reach the live DOM).
// Both read the same manually authored Garden Status Energy value
// (index.html's #garden-energy-level[data-level]) and these same
// functions, so they always agree without either storing or
// transmitting anything to the other.
//
// Energy controls the visible WIDTH of the field (both ░ background and
// ▓ footprints -- a footprint past the cutoff is hidden too, not
// exempted), not row-by-row striping: at energy%, every cell at column
// <= that row's cutoff stays visible; every cell to the right goes
// blank. The cutoff is a per-row offset from one deterministic base
// column derived from energy and the map's own width. The 100%/0% edge
// cases are handled explicitly below so the offset never adds or
// removes cells at the extremes.
(function () {
  "use strict";

  var DEFAULT_SEED = 4187;

  // The map's own width in columns: one greater than the longest row's
  // last character index (0-based columns), i.e. max(row.length) - 1
  // across every row of the source text -- computed once from the same
  // text both consumers already have (unmarked or marks-applied text
  // makes no difference here, since darkening a cell swaps ░ for ▓
  // without changing any row's length).
  function computeMaxCol(text) {
    var rows = text.split("\n");
    var maxCol = 0;
    for (var i = 0; i < rows.length; i++) {
      var lastCol = rows[i].length - 1;
      if (lastCol > maxCol) {
        maxCol = lastCol;
      }
    }
    return maxCol;
  }

  // Deterministic seeded pseudo-random walk, not Math.sin(): a sine
  // (or sum of sines) is a smooth periodic curve and reads as an
  // obvious repeating wave no matter how it's tuned. A random walk with
  // a fixed seed has no period at all -- each row's offset nudges the
  // previous one by a small deterministic pseudo-random step (about
  // -3..+3), clamped to a wandering range (-12..+12), so the boundary
  // looks irregular like uneven terrain while staying exactly
  // reproducible: the same seed and row count always produce the exact
  // same offsets array, computed once per render rather than per cell
  // (recomputing the whole walk per cell would be both wasteful and
  // pointless, since the state only depends on row count and seed).
  function buildTerrainOffsets(rowCount, seed) {
    var state = (typeof seed === "number" ? seed : DEFAULT_SEED) >>> 0;
    var offset = 0;
    var offsets = [];

    function random() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    }

    for (var row = 0; row < rowCount; row++) {
      var step = Math.floor(random() * 7) - 3; // -3..+3
      offset += step;
      offset = Math.max(-12, Math.min(12, offset));
      offsets.push(offset);
    }

    return offsets;
  }

  function computeRowCutoff(maxCol, energyPercent, row, terrainOffsets) {
    var offset = terrainOffsets && terrainOffsets[row] !== undefined ? terrainOffsets[row] : 0;
    var baseCutoff = maxCol * (energyPercent / 100);
    return Math.max(0, Math.min(maxCol, baseCutoff + offset));
  }

  // terrainOffsets: an array built once per render via
  // buildTerrainOffsets(), indexed by row -- not rebuilt per cell.
  function isColumnVisible(col, row, maxCol, energyPercent, terrainOffsets) {
    var clamped = Math.max(0, Math.min(100, energyPercent));

    // Explicit edge cases, not just clamping the terrain-adjusted
    // cutoff: at 100% a negative offset could otherwise erode the
    // right edge, and at 0% a positive offset could otherwise preserve
    // a few leftmost cells -- neither is allowed to happen.
    if (clamped >= 100) {
      return true;
    }
    if (clamped <= 0) {
      return false;
    }

    return col <= computeRowCutoff(maxCol, clamped, row, terrainOffsets);
  }

  window.AsciiMapDensity = {
    computeMaxCol: computeMaxCol,
    buildTerrainOffsets: buildTerrainOffsets,
    isColumnVisible: isColumnVisible
  };
})();
