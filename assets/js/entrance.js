// Progressive enhancement only: without this script, slide 1 is already
// the active slide in the raw HTML (no `hidden` attribute; slides 2/3
// carry it), so a no-JS visitor always sees a correct initial state --
// just with no way to advance through slides 2/3. The <noscript>
// fallback link is their only way to reach the map in that case.
(function () {
  var TOTAL_SLIDES = 3;
  var ENTRANCE_DISMISSED_KEY = "resilient-garden-entrance-dismissed";

  var overlay = document.querySelector(".entrance-overlay");
  var slides = document.querySelectorAll(".entrance-slide");
  var dots = document.querySelectorAll(".entrance-dots .dot");
  var actionButton = document.getElementById("entrance-action");
  var mapSection = document.getElementById("garden-map");
  var homeLinks = document.querySelectorAll("[data-home-link]");
  var mapIndex = document.querySelector(".map-index");

  if (!overlay || !slides.length || !actionButton) {
    return;
  }

  // Map Index must always start collapsed: fresh load, reload, Home
  // reset, and bfcache restoration all call this. It is deliberately
  // never called from anywhere that merely opens/closes a content panel
  // or the Greenhouse dialog -- once a visitor manually opens Map Index,
  // it stays open through ordinary interaction until one of those real
  // reset points happens.
  function resetMapIndex() {
    if (!mapIndex) {
      return;
    }
    if (mapIndex instanceof HTMLDetailsElement) {
      mapIndex.open = false;
    } else {
      mapIndex.classList.remove("is-open");
    }
  }

  function readDismissedFlag() {
    try {
      return sessionStorage.getItem(ENTRANCE_DISMISSED_KEY) === "true";
    } catch (err) {
      // sessionStorage unavailable (private mode, disabled storage) --
      // treat as "not dismissed" so Entrance still shows correctly.
      return false;
    }
  }

  function clearDismissedFlag() {
    try {
      sessionStorage.removeItem(ENTRANCE_DISMISSED_KEY);
    } catch (err) {
      // ignore -- nothing to clear if storage isn't available
    }
  }

  function setDismissedFlag() {
    try {
      sessionStorage.setItem(ENTRANCE_DISMISSED_KEY, "true");
    } catch (err) {
      // sessionStorage unavailable -- Entrance still works for this
      // visit, it just can't remember "already dismissed" across a
      // Back/Forward restoration.
    }
  }

  // Set by assets/js/garden-return-flag.js (loaded on dictionary.html,
  // field-notes/index.html, about.html, pressed-edition.html) when the
  // visitor clicks one of those pages' own "← Garden Map" breadcrumb
  // links -- a real forward navigation back here, not the browser's
  // native Back/Forward (already handled below via the "back_forward"
  // navigation-type branch and ENTRANCE_DISMISSED_KEY on its own).
  // Consumed once, immediately, so it never lingers to affect a later
  // reload or a genuine fresh visit.
  var RETURNING_KEY = "resilient-garden-returning-to-garden";

  function consumeReturningFlag() {
    var returning;
    try {
      returning = sessionStorage.getItem(RETURNING_KEY) === "true";
      sessionStorage.removeItem(RETURNING_KEY);
    } catch (err) {
      return false; // sessionStorage unavailable -- fall back to normal Entrance logic
    }
    return returning;
  }

  function clearReturningFlag() {
    try {
      sessionStorage.removeItem(RETURNING_KEY);
    } catch (err) {
      // ignore -- nothing to clear if storage isn't available
    }
  }

  var currentSlide = 0;

  function renderEntranceSlide(index) {
    currentSlide = index;

    slides.forEach(function (slide, i) {
      var isActive = i === index;
      slide.hidden = !isActive;
      slide.classList.toggle("is-active", isActive);
    });

    dots.forEach(function (dot, i) {
      var isActive = i === index;
      dot.classList.toggle("is-active", isActive);
      if (isActive) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    actionButton.textContent = index === TOTAL_SLIDES - 1 ? "Enter the garden" : "Next";
  }

  // Only ever called from the initial-load handling below and an
  // explicit Home-link click -- never from a generic panel, hash,
  // focus, visibility, or dialog event, so ordinary homepage
  // interaction can never reopen Entrance.
  function resetEntrance() {
    currentSlide = 0;
    renderEntranceSlide(0);
    overlay.hidden = false;
    document.body.classList.add("intro-active");
  }

  function enterGarden() {
    overlay.hidden = true;
    document.body.classList.remove("intro-active");
    setDismissedFlag();
    if (mapSection) {
      // preventScroll: true -- without it, focusing a full-bleed section
      // that starts at zero pixels below the fixed header makes the
      // browser's default scroll-into-view behavior scroll the header
      // itself out of view.
      mapSection.focus({ preventScroll: true });
    }
  }

  actionButton.addEventListener("click", function () {
    if (currentSlide < TOTAL_SLIDES - 1) {
      renderEntranceSlide(currentSlide + 1);
    } else {
      enterGarden();
    }
  });

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      renderEntranceSlide(i);
    });
  });

  // Home link(s): the fixed-header site title, marked with
  // [data-home-link] so any future explicit Home control shares the
  // same behavior. This script only loads on index.html, so a Home
  // link clicked from any other page is never intercepted here -- it
  // just navigates normally, and the handling below runs fresh once
  // that navigation lands.
  homeLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo(0, 0);
      // Garden Status needs no explicit reset call here: the
      // body.intro-active CSS rule (assets/css/garden.css) already
      // hides it unconditionally the moment resetEntrance() below adds
      // that class. Map Index is different -- that same CSS rule only
      // hides it visually, it doesn't clear a manually-opened [open]
      // state underneath, so Entrance finishing again would reveal it
      // still open. resetMapIndex() below closes it explicitly instead.
      if (window.ContentPanel) {
        window.ContentPanel.closeActive({ restoreFocus: false });
      }
      resetMapIndex();
      clearDismissedFlag();
      clearReturningFlag();
      resetEntrance();
      // Rescale only -- never re-render. assets/js/ascii-map-scale.js's
      // renderer already guards against running twice on its own
      // (map.dataset.rendered), but Home only ever needs a fresh
      // measurement here (e.g. if the viewport changed since the map
      // was last scaled), not a rebuild of the map's markup.
      if (window.AsciiMapScale) {
        window.AsciiMapScale.scheduleMapScale();
      }
    });
  });

  // Initial load: decide whether this load should show Entrance from
  // slide 1 (the default the static HTML already represents) or skip
  // straight to the dismissed state, based on how the browser actually
  // navigated here -- never on a panel, hash, focus, or visibility
  // event.
  //
  //   returning to Garden Map from an internal page (dictionary.html,
  //                field-notes/index.html, about.html,
  //                pressed-edition.html -- see assets/js/
  //                garden-return-flag.js, which sets this the moment
  //                one of those pages loads, however the visitor got
  //                there or leaves it) -- takes priority over
  //                everything below: skip Entrance and show the map
  //                immediately, regardless of navigationType.
  //   reload       -- always show Entrance; clears any dismissed flag
  //                   left over from before the reload.
  //   back_forward -- a full re-execution of this script only happens
  //                   here when the browser didn't restore this
  //                   navigation from bfcache (see the pageshow/
  //                   persisted handling below for that case) --
  //                   preserve whatever the dismissed flag says.
  //   anything else -- a direct load or a normal navigation here
  //                    (including from a Home link on another page) --
  //                    always show Entrance, and clear any leftover
  //                    dismissed flag since this is the start of a new
  //                    visit.
  // The static markup already represents Map Index collapsed (no `open`
  // attribute), so this is defensive rather than corrective on a true
  // cold load -- but it also covers the back_forward branch just below,
  // where a full script re-execution (as opposed to a bfcache restore,
  // handled separately in the pageshow listener at the bottom of this
  // file) still starts from that same static markup.
  resetMapIndex();

  if (consumeReturningFlag()) {
    enterGarden();
  } else {
    var navigationEntry =
      window.performance &&
      typeof performance.getEntriesByType === "function" &&
      performance.getEntriesByType("navigation")[0];
    var navigationType = navigationEntry && navigationEntry.type;

    if (navigationType === "reload") {
      clearDismissedFlag();
      resetEntrance();
    } else if (navigationType === "back_forward") {
      if (readDismissedFlag()) {
        enterGarden();
      } else {
        resetEntrance();
      }
    } else {
      clearDismissedFlag();
      resetEntrance();
    }
  }

  // Covers the case where the browser DID restore this page from
  // bfcache: script state (currentSlide, overlay.hidden, the
  // intro-active class) is preserved exactly as it was when the
  // visitor left, and none of the code above re-runs at all -- so if
  // Entrance was NOT already dismissed before they navigated away (the
  // header nav is reachable while Entrance is still showing, so this
  // is a real case, not just a hypothetical), it would otherwise come
  // back exactly as it was: still showing. The returning flag (set by
  // assets/js/garden-return-flag.js the moment one of the four internal
  // pages loaded, cleared on that page's Home link) is consumed here
  // specifically for that reason -- it's the one signal that survives
  // a true bfcache restore, since it lives in sessionStorage rather
  // than in this script's now-frozen state. A non-bfcache pageshow
  // (event.persisted === false) also fires on every ordinary load,
  // right after the navigation-type handling above already ran (which
  // already consumed the flag in that case), so it must do nothing
  // here too rather than resetting Entrance a second time.
  window.addEventListener("pageshow", function (event) {
    // Independent of the Entrance restoration logic above: whether or
    // not this was a bfcache restore, and regardless of what Entrance
    // decides to do, Map Index specifically must never come back open.
    // A bfcache restore is the one path that can hand back a page whose
    // Map Index was left open by the visitor before they navigated away.
    resetMapIndex();

    if (event.persisted) {
      if (consumeReturningFlag()) {
        enterGarden();
      }
      return;
    }
  });
})();
