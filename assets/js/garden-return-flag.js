// Progressive enhancement only: without this script, the sessionStorage
// flag below never gets set, so index.html simply falls back to its
// existing back_forward/dismissed-flag logic (assets/js/entrance.js) --
// a visitor without JS sees no difference from before this feature
// existed.
//
// Loaded on the four internal pages that link back to the Garden Map
// (dictionary.html, field-notes/index.html, about.html,
// pressed-edition.html): marks the session as "on an internal page, so
// the next arrival at index.html is a return, not a fresh entry" the
// moment this page loads -- not tied to clicking any particular link.
// That's deliberate: the Entrance overlay does not actually block the
// header nav (it's visible and clickable while Entrance is still
// showing), so a visitor can reach this page without ever dismissing
// Entrance, and can then leave it via the breadcrumb, the browser's own
// Back button, or a bfcache restore of index.html -- none of which
// fire a click handler here except the explicit Home link below. Only
// setting this on a specific link's click would miss the Back-button
// and bfcache paths entirely. See assets/js/entrance.js's pageshow
// listener for where the bfcache-restore case consumes this flag.
(function () {
  "use strict";

  var RETURNING_KEY = "resilient-garden-returning-to-garden";

  try {
    sessionStorage.setItem(RETURNING_KEY, "true");
  } catch (err) {
    // sessionStorage unavailable -- index.html just runs its normal
    // Entrance logic instead, same as any other visit
  }

  // The Home / ASCII logo link always intentionally restarts Entrance,
  // even when clicked from this same page -- clear the flag first so
  // it doesn't suppress Entrance on a deliberate Home navigation.
  var homeLink = document.querySelector(".ascii-home-link");
  if (homeLink) {
    homeLink.addEventListener("click", function () {
      try {
        sessionStorage.removeItem(RETURNING_KEY);
      } catch (err) {
        // ignore -- nothing to clear if storage isn't available
      }
    });
  }
})();
