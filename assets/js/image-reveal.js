// Progressive enhancement only: every .image-reveal button's <img> ships
// with its black-and-white src already in the HTML (the authoritative
// no-JS fallback), so without this script the image just sits there,
// readable and unclickable -- nothing missing, nothing broken.
//
// With this script: a single delegated click listener (rather than one
// per button) reveals the colour asset the first time a paired image is
// clicked. This is deliberately NOT a two-way toggle -- clicking an
// already-revealed image is a no-op. The only way back to
// black-and-white is resetRevealImages(), called by
// assets/js/content-panel.js when a panel closes, and on this script's
// own pageshow listener below for standalone pages (including bfcache
// restores, which otherwise keep whatever src was last set).
//
// Size locking: a BW and its paired colour asset are almost always the
// same photo at different resolutions (see assets/image/*), not the
// same pixel dimensions -- e.g. exp_heat_01.webp ships at 800x446 while
// exp_heat_colour01.png is a much higher-resolution 3430x1916 scan of
// the same shot. Under plain width:auto/height:auto/max-width/
// max-height CSS sizing, a small BW file can render at its own native
// resolution (never being enlarged past it) while the larger colour
// file gets scaled UP to fill the same max-width -- a real, visible
// jump on click, not a hypothetical one. Locking the BW file's
// *rendered* CSS box (not its natural/source pixel dimensions) onto the
// button via --reveal-width/--reveal-height custom properties, then
// having the colour <img> fill that fixed box with object-fit: contain,
// makes the two states pixel-identical regardless of source resolution.
//
// Deliberately does not touch Greenhouse's uploaded photos, webcam
// captures, or canvas output -- those never carry the .image-reveal
// class or data-bw-src/data-color-src pair this script looks for.
(function () {
  function lockRevealImageSize(button) {
    var image = button.querySelector("img");

    if (!image) return;

    var rect = image.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    button.style.setProperty("--reveal-width", rect.width + "px");
    button.style.setProperty("--reveal-height", rect.height + "px");
    button.dataset.sizeLocked = "true";
  }

  function unlockRevealImageSize(button) {
    button.style.removeProperty("--reveal-width");
    button.style.removeProperty("--reveal-height");
    delete button.dataset.sizeLocked;
  }

  // Waits for the BW image to finish loading (or, if it's already
  // cached/complete, the very next frame) so the viewport-aware CSS
  // sizing in garden.css has actually been applied before measuring --
  // measuring mid-layout would just lock in a stale or zero box.
  function prepareRevealImage(button) {
    var image = button.querySelector("img");

    if (!image) return;

    var lock = function () {
      requestAnimationFrame(function () {
        lockRevealImageSize(button);
      });
    };

    if (image.complete) {
      lock();
    } else {
      image.addEventListener("load", lock, { once: true });
    }
  }

  function revealColour(button) {
    var image = button.querySelector("img");

    if (!image || button.dataset.revealed === "true") return;

    var colourSrc = image.dataset.colorSrc;

    if (!colourSrc) return;

    // Locked size (if prepareRevealImage already ran) stays exactly as
    // it is -- only the src and accessibility state change here.
    image.src = colourSrc;
    button.dataset.revealed = "true";
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("aria-label", "Colour image revealed");
  }

  // Preferred reset path (see RESET TO BW in the brief this implements):
  // unlock, switch back to BW, then re-measure and re-lock from that BW
  // render rather than trusting a stale locked box -- correct even if
  // the panel reopens at a different viewport size than when it closed.
  function resetRevealImages(container) {
    var scope = container || document;
    var buttons = scope.querySelectorAll(".image-reveal");

    buttons.forEach(function (button) {
      var image = button.querySelector("img");

      if (!image) return;

      var bwSrc = image.dataset.bwSrc;

      if (!bwSrc) return;

      unlockRevealImageSize(button);
      image.src = bwSrc;
      delete button.dataset.revealed;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Reveal colour image");
      prepareRevealImage(button);
    });
  }

  // Debounced: recalculates every locked box from a fresh BW measurement
  // rather than scaling the existing locked pixel value, so the lock
  // never goes stale after a resize or orientation change. If a pair is
  // currently showing colour, its src is swapped back to BW just long
  // enough to remeasure (the BW asset is authoritative for the box --
  // see ASPECT RATIO in the brief), then restored, since colour/BW
  // aspect ratios are close but not guaranteed byte-identical.
  var resizeTimer = null;
  function relockAllRevealImages() {
    document.querySelectorAll(".image-reveal").forEach(function (button) {
      var image = button.querySelector("img");

      if (!image) return;

      var bwSrc = image.dataset.bwSrc;

      if (!bwSrc) return;

      var wasRevealed = button.dataset.revealed === "true";
      var colourSrc = image.dataset.colorSrc;

      unlockRevealImageSize(button);

      var finish = function () {
        requestAnimationFrame(function () {
          lockRevealImageSize(button);
          if (wasRevealed && colourSrc) {
            image.src = colourSrc;
          }
        });
      };

      if (wasRevealed) {
        image.src = bwSrc;
      }

      if (image.complete) {
        finish();
      } else {
        image.addEventListener("load", finish, { once: true });
      }
    });
  }

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(relockAllRevealImages, 200);
  });

  document.addEventListener("click", function (e) {
    var button = e.target.closest(".image-reveal");
    if (!button) return;
    revealColour(button);
  });

  // Covers plain reloads (the HTML src already starts BW, so this is
  // belt-and-suspenders) and, more importantly, browser Back/Forward
  // restorations from bfcache, which resurrect the DOM exactly as the
  // visitor left it -- colour reveals and locked sizes included --
  // without re-running this script from scratch.
  window.addEventListener("pageshow", function () {
    resetRevealImages(document);
  });

  document.querySelectorAll(".image-reveal").forEach(prepareRevealImage);

  window.ImageReveal = {
    reveal: revealColour,
    reset: resetRevealImages,
  };
})();
