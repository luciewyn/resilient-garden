// Progressive enhancement only: replaces the "unknown" static text
// already in the page (see index.html) with a real detection. Needs no
// Performance API and no resource load to wait for -- window.location is
// available synchronously, so this runs immediately rather than waiting
// for window.load like assets/js/resource-indicator.js does.
(function () {
  var modeEl = document.getElementById("site-mode");

  if (!modeEl) {
    return;
  }

  function getSiteMode() {
    var hostname = window.location.hostname;
    var protocol = window.location.protocol;

    if (
      protocol === "file:" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return "local";
    }

    return "online";
  }

  modeEl.textContent = getSiteMode();
})();
