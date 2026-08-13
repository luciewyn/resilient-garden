// Progressive enhancement only: replaces the "pending browser
// measurement" static text already in the page (see index.html) with
// real measurements -- Page (total page weight) and Images (image
// weight within that total). If unsupported or disabled, that static
// text remains and stays meaningful.
(function () {
  var weightEl = document.getElementById("res-weight");
  var imagesEl = document.getElementById("res-images-weight");

  if ((!weightEl && !imagesEl) || !window.performance || typeof performance.getEntriesByType !== "function") {
    return;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return Math.round(bytes) + " B";
    }
    var kib = bytes / 1024;
    if (kib < 1024) {
      return kib.toFixed(2) + " KiB";
    }
    return (kib / 1024).toFixed(2) + " MiB";
  }

  // encodedBodySize only -- the actual (compressed) weight of the page's
  // resources as loaded, deliberately not transferSize. transferSize is
  // near-zero for anything served from cache (a disk-cache hit or a 304
  // legitimately transfers almost nothing over the network), which made
  // this metric collapse from ~550 KiB to ~11 KiB on an ordinary repeat
  // load -- accurate for "bytes moved over the wire just now," but not
  // what "Page" is meant to represent here: the size of the page itself,
  // stable regardless of whether this particular load happened to hit
  // cache. Images below shares this same reasoning and property.
  function measureCurrentPageSize() {
    var nav = performance.getEntriesByType("navigation")[0];

    if (!nav) {
      // Performance API present but no navigation entry -- genuinely
      // unavailable, not "the page happens to weigh 0 bytes."
      return null;
    }

    // nav = the main document only; resource entries are subresources
    // only (CSS/JS/fonts/images/etc.) -- summed together without ever
    // double-counting the document itself.
    var total = nav.encodedBodySize || 0;

    performance.getEntriesByType("resource").forEach(function (entry) {
      total += entry.encodedBodySize || 0;
    });

    return total;
  }

  // Matches this site's real image files (assets/image/*.webp/.png/
  // .jpg/.jpeg/.gif/.svg/.avif) -- deliberately excludes the .mp4 poster
  // videos that live in the same field-note-video-figure markup pattern
  // as .image-reveal, since a video is not an image no matter how it's
  // wrapped.
  var IMAGE_EXTENSION_PATTERN = /\.(?:webp|png|jpe?g|gif|svg|avif)(?:[?#].*)?$/i;

  function isImageResourceEntry(entry) {
    // initiatorType "img" covers every real case on this page: the
    // dialogs' original <img src> in the HTML, and
    // assets/js/image-reveal.js's revealColour() swapping that same
    // element's .src to the colour asset (per the Resource Timing spec,
    // a later src change on an existing <img> still reports "img" as
    // its initiator). The extension check is a defensive fallback only,
    // in case some future image is loaded a different way (e.g. a CSS
    // background-image) that reports a different initiatorType.
    if (entry.initiatorType === "img") {
      return true;
    }
    return IMAGE_EXTENSION_PATTERN.test(entry.name);
  }

  // Only ever sums resource entries that already exist -- an image
  // behind a still-closed dialog, a colour asset not yet clicked, or
  // anything inside the Greenhouse iframe before it's opened simply has
  // no entry yet, so it's correctly excluded rather than needing to be
  // filtered out by hand.
  function measureCurrentImagesSize() {
    var total = 0;

    performance.getEntriesByType("resource").forEach(function (entry) {
      if (isImageResourceEntry(entry)) {
        total += entry.encodedBodySize || 0;
      }
    });

    return total;
  }

  function updatePageWeight() {
    if (!weightEl) {
      return;
    }
    var totalBytes = measureCurrentPageSize();
    weightEl.textContent = totalBytes === null ? "unavailable" : formatBytes(totalBytes);
  }

  function updateImagesWeight() {
    if (!imagesEl) {
      return;
    }
    // Unlike Page, zero loaded images is a real, valid state (not an
    // API failure) -- always formatted as a byte value, e.g. "0 B",
    // never "unavailable".
    imagesEl.textContent = formatBytes(measureCurrentImagesSize());
  }

  function updateAll() {
    updatePageWeight();
    updateImagesWeight();
  }

  window.addEventListener("load", function () {
    updateAll();
    // One deferred re-check only, not a repeating timer: a few
    // resources (e.g. webfonts triggered by CSS) can still finish
    // fractionally after the load event itself fires.
    setTimeout(updateAll, 1000);
  });

  // The Greenhouse Image Tool iframe (assets/js/greenhouse-dialog.js)
  // is the one resource on this page that loads lazily -- only once its
  // dialog is actually opened, well after window.load. Recalculate
  // right after its own real load event fires, rather than guessing
  // with a timer.
  var greenhouseFrame = document.querySelector(".greenhouse-tool-frame");
  if (greenhouseFrame) {
    greenhouseFrame.addEventListener("load", function () {
      // The frame carries no src attribute at all until
      // greenhouse-dialog.js sets one -- guards against reacting to a
      // spurious load event before there's anything real to count.
      if (greenhouseFrame.src) {
        updateAll();
      }
    });
  }

  // Recalculates Images specifically whenever any <img> on the page
  // finishes loading after the fact -- a BW->colour reveal
  // (assets/js/image-reveal.js's revealColour()) being the real case on
  // this page today, but this covers any future lazy-loaded image the
  // same way. <img> load events don't bubble, so this has to listen on
  // the capture phase of a document-level listener rather than
  // delegating in the usual bubble-phase way.
  document.addEventListener(
    "load",
    function (e) {
      if (e.target && e.target.tagName === "IMG") {
        updateImagesWeight();
      }
    },
    true
  );

  // Covers bfcache restoration, where the page reappears without a
  // fresh "load" event -- re-reads whatever the browser has already
  // recorded rather than re-measuring on a timer.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      updateAll();
    }
  });
})();
