// Progressive enhancement only: without this script, .ascii-garden-map
// falls back to the CSS font-size formula in garden.css (a real,
// self-sufficient if slightly conservative fit on its own) and the map
// stays a single plain-text <pre> with no ░/▓ interaction. index.html's
// <noscript> override for .ascii-map-stage's visibility guarantees the
// map is never left invisible for a no-JS visitor -- see that override
// and the visibility comment on .ascii-map-stage in garden.css.
//
// Owns the map's one authoritative startup sequence, in this exact
// order, so the map's on-screen scale is correct on the very first
// paint rather than needing a resize -- or a second or third refresh --
// to "settle":
//   1. build the interactive markup (.shade-cell / .map-primary-label
//      spans) from the original plain-text source;
//   2. wait for both local map fonts (jgs7, jgs5) to actually be ready;
//   3. wait two animation frames, so Safari has finished applying those
//      fonts' real metrics to layout;
//   4. measure the map's true natural (unscaled) size;
//   5. apply one absolute scale;
//   6. reveal the map.
//
// The previous version of this script measured immediately on script
// execution -- skipping straight to step 5 before 1-4 had happened --
// which was the actual, confirmed cause of the "map is too small until
// a couple of refreshes" bug: this script ran BEFORE the renderer
// (formerly the top-level code of assets/js/ascii-map-interaction.js,
// a later <script> tag) had wrapped the eight primary labels in their
// jgs5 spans, and before either local font was necessarily loaded, so
// the very first measurement was sometimes taken against a <pre> still
// showing a fallback font (different per-character width than jgs7)
// and/or still showing every label in jgs7 instead of jgs5. Nothing
// ever re-measured afterward once the real fonts and labels swapped in
// -- only an actual window resize did (the only thing that previously
// triggered a second measurement), which is why resizing, but not
// simply waiting, always looked "correct." A cached font (warm reload)
// also happened to sidestep the race by loading fast enough to already
// be active before the old code's single synchronous measurement ran --
// which is why the bug was intermittent and cache-dependent rather than
// constant.
(function () {
  var frame = document.querySelector(".ascii-map-frame");
  var stage = document.querySelector(".ascii-map-stage");
  var map = document.querySelector(".ascii-garden-map");

  if (!frame || !stage || !map) {
    return;
  }

  var REFERENCE_FONT_SIZE = 13; // px -- matches the CSS formula's cap

  // ---- 1. render -------------------------------------------------------
  //
  // Moved here from assets/js/ascii-map-interaction.js specifically so
  // it always runs as step 1 of this one sequence, before anything ever
  // measures the map. assets/js/ascii-map-interaction.js now only
  // handles click/drag interaction on the spans this creates, reading
  // them from window.AsciiMapRender below.

  var SHADE = "░"; // ░
  var DARK = "▓"; // ▓

  // Exact eight primary Garden Map labels that get the jgs5 typeface
  // (see .map-primary-label in garden.css) -- everything else in the
  // map, including similar-looking bracketed text like "[ Enter ]" or
  // "[ IMAGE INPUT ]", stays in the surrounding jgs7. Sorted longest
  // first so the scan below matches each as one complete string rather
  // than any shorter label (or a lone character) accidentally matching
  // partway through a longer one -- not actually ambiguous for this
  // specific list (none is a substring of another), but done
  // unconditionally so that stays true regardless of list order.
  var primaryLabels = [
    "[ GARDEN BED 01 ]",
    "[ GARDEN BED 02 ]",
    "[ GARDEN BED 03 ]",
    "[ GREENHOUSE ]",
    "[ COMPOST ]",
    "[ HARVEST ]",
    "[ SEED ]",
    "[ SOIL ]"
  ].sort(function (a, b) {
    return b.length - a.length;
  });

  function escapeHtml(ch) {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return ch;
  }

  function escapeHtmlString(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      out += escapeHtml(str[i]);
    }
    return out;
  }

  // Only ░ needs to be individually addressable -- every other
  // character (letters, box-drawing, arrows, punctuation, whitespace)
  // is left as plain escaped text between spans, so "click does
  // nothing" holds by construction instead of needing a check per
  // character, and the DOM stays far smaller than one span per glyph.
  var shadeCells = [];

  function buildMarkup(text) {
    var html = "";
    var i = 0;
    var row = 0; // 0-based; incremented after each newline is appended below
    var col = 0; // 0-based; reset to 0 after each newline, advanced by every character
    outer: while (i < text.length) {
      for (var l = 0; l < primaryLabels.length; l++) {
        var label = primaryLabels[l];
        if (text.substr(i, label.length) === label) {
          html +=
            '<span class="map-primary-label" style="--label-columns: ' +
            label.length +
            '">' +
            escapeHtmlString(label) +
            "</span>";
          i += label.length;
          col += label.length;
          continue outer;
        }
      }
      var ch = text[i];
      if (ch === SHADE) {
        // data-row/data-col let assets/js/ascii-map-interaction.js's
        // energy-density pass (assets/js/ascii-map-density.js) decide
        // visibility per cell without re-deriving position from scratch.
        html +=
          '<span class="shade-cell" data-i="' +
          shadeCells.length +
          '" data-row="' +
          row +
          '" data-col="' +
          col +
          '">' +
          SHADE +
          "</span>";
        shadeCells.push(null); // placeholder; filled in after parsing below
        col++;
      } else {
        html += escapeHtml(ch);
        if (ch === "\n") {
          row++;
          col = 0;
        } else {
          col++;
        }
      }
      i += 1;
    }
    return html;
  }

  function darken(span) {
    if (!span || span.classList.contains("is-darkened")) {
      return;
    }
    span.textContent = DARK;
    span.classList.add("is-darkened");
    // A footprint always overrides energy depletion (assets/js/
    // ascii-map-interaction.js's applyEnergyDensity()), including one
    // left after that pass already ran -- clear any stale marker so a
    // newly-clicked cell in the depleted zone isn't left both.
    span.classList.remove("is-thinned");
  }

  function renderAsciiMap() {
    // Guards against ever running twice on the same <pre>: rebuilding
    // already-rendered markup would nest spans inside spans and desync
    // the shadeCells index from the data-i attributes actually in the
    // DOM. Under the current design this function is only ever called
    // once anyway (from initialiseAsciiMap() below, itself called once
    // per page load), but this keeps that true even if a future change
    // ever called it again -- e.g. from a rescale or pageshow path.
    if (map.dataset.rendered === "true") {
      return;
    }

    var originalText = map.textContent;
    map.innerHTML = buildMarkup(originalText);
    map.dataset.rendered = "true";

    // Resolve the placeholder array to real span references, in the
    // same stable left-to-right/top-to-bottom order they were created
    // in, so a stored index always means the same cell across a reload
    // (as long as the underlying map text hasn't changed).
    var spans = map.querySelectorAll(".shade-cell");
    for (var s = 0; s < spans.length; s++) {
      shadeCells[s] = spans[s];
    }
  }

  // ---- 2. font readiness -------------------------------------------

  function waitForMapFonts() {
    if (!document.fonts) {
      return Promise.resolve();
    }
    return Promise.all([
      document.fonts.load('16px "jgs7"'),
      document.fonts.load('16px "jgs5"'),
      document.fonts.ready
    ]).then(
      function () {},
      function () {
        // A font load rejected (e.g. a network failure) -- proceed with
        // whatever's available rather than leaving the map hidden
        // indefinitely.
      }
    );
  }

  // ---- 3. layout readiness -------------------------------------------

  function waitForLayout() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  // Per-character cell width for the eight jgs5 primary labels (see
  // .map-primary-label in garden.css): depends on real font metrics
  // exactly like the overall map scale below, so it has to wait for the
  // same font/layout readiness -- previously measured immediately on
  // script execution by assets/js/ascii-map-interaction.js, with no
  // font wait at all.
  function measureCellWidth() {
    var CELL_PROBE_LENGTH = 50;
    var cellProbe = map.cloneNode(false);
    cellProbe.textContent = new Array(CELL_PROBE_LENGTH + 1).join("0");
    cellProbe.style.position = "absolute";
    cellProbe.style.visibility = "hidden";
    map.parentNode.appendChild(cellProbe);
    var cellWidthPx = cellProbe.offsetWidth / CELL_PROBE_LENGTH;
    map.parentNode.removeChild(cellProbe);
    if (cellWidthPx > 0) {
      map.style.setProperty("--map-cell-width", cellWidthPx + "px");
    }
  }

  // ---- 4-5. measure + scale --------------------------------------------

  function measureNaturalMapSize() {
    // Never derived from the live, currently-scaled element: an inline
    // transform: none temporarily overrides whatever transform: scale(
    // var(--map-scale, 1)) in garden.css is currently applying (an
    // inline style always wins over a stylesheet rule, regardless of
    // specificity), so scrollWidth/scrollHeight here always reflect the
    // stage's true 1:1 size -- measured from .ascii-map-stage itself,
    // the shared element that contains both the ASCII <pre> and every
    // map-destination hotspot, not just the <pre> alone.
    var previousInlineTransform = stage.style.transform;
    stage.style.transform = "none";

    var naturalWidth = stage.scrollWidth;
    var naturalHeight = stage.scrollHeight;

    stage.style.transform = previousInlineTransform;

    return { naturalWidth: naturalWidth, naturalHeight: naturalHeight };
  }

  function scaleAsciiMap() {
    stage.style.fontSize = REFERENCE_FONT_SIZE + "px";

    var natural = measureNaturalMapSize();
    var frameWidth = frame.clientWidth;

    if (!natural.naturalWidth || !frameWidth) {
      return;
    }

    var scale = frameWidth / natural.naturalWidth;

    // Absolute assignment, not a cumulative multiply: every call starts
    // from the same natural width measured just above, so repeated
    // calls (resize, pageshow, Home) can never compound the map into a
    // smaller or larger scale than the frame actually warrants.
    stage.style.setProperty("--map-scale", scale);

    // Computed fresh from the natural height each time, not read back
    // from whatever height the frame already had and scaled again --
    // the same reason scale itself is an absolute assignment above.
    frame.style.height = natural.naturalHeight * scale + "px";
  }

  // ---- resize handling ---------------------------------------------

  var scaleFrame = 0;

  function scheduleMapScale() {
    cancelAnimationFrame(scaleFrame);
    scaleFrame = requestAnimationFrame(function () {
      scaleAsciiMap();
    });
  }

  // ---- 6. startup sequence -------------------------------------------

  function initialiseAsciiMap() {
    renderAsciiMap();

    return waitForMapFonts()
      .then(function () {
        measureCellWidth();
        return waitForLayout();
      })
      .then(function () {
        scaleAsciiMap();
      })
      .catch(function () {
        // Even if font loading or measurement unexpectedly threw, still
        // reveal the map below rather than leaving it hidden forever
        // behind body.map-scale-ready.
      })
      .then(function () {
        document.body.classList.add("map-scale-ready");

        if (window.ResizeObserver) {
          new ResizeObserver(scheduleMapScale).observe(frame);
        } else {
          // No ResizeObserver support -- fall back to a plain resize
          // listener so the map still stays responsive.
          window.addEventListener("resize", scheduleMapScale);
        }

        window.addEventListener("orientationchange", scheduleMapScale);

        // Rescales only -- never resets Entrance (see assets/js/
        // entrance.js's own, separate pageshow listener for that, which
        // is scoped to Entrance state alone and never touches the map).
        // Also covers a true bfcache restore, where this whole script
        // doesn't re-run at all: the stage's font-size/--map-scale are
        // preserved exactly as they were, but re-measuring here is
        // still cheap and correct regardless of whether anything
        // actually changed since the visitor left.
        window.addEventListener("pageshow", scheduleMapScale);
      });
  }

  // Exposed for assets/js/ascii-map-interaction.js (the click/drag
  // interaction that operates on these spans) and assets/js/entrance.js
  // (which calls scheduleMapScale() -- never renderAsciiMap() or
  // initialiseAsciiMap() again -- after an explicit Home-link reset).
  window.AsciiMapRender = {
    shadeCells: shadeCells,
    darken: darken
  };

  window.AsciiMapScale = {
    scheduleMapScale: scheduleMapScale
  };

  initialiseAsciiMap();
})();
