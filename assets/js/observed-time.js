// Progressive enhancement only: replaces the "pending browser
// measurement" static text already in the page (see index.html) with
// the visitor's own device clock -- local time, not UTC, and not the
// Garden's own hosting/environmental conditions (see the Device row's
// own distinction in index.html's Computing Climate comment).
(function () {
  var observedEl = document.getElementById("observed-time");

  if (!observedEl) {
    return;
  }

  function formatObservedTime(date) {
    date = date || new Date();
    var day = String(date.getDate()).padStart(2, "0");
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var year = date.getFullYear();
    var hours = String(date.getHours()).padStart(2, "0");
    var minutes = String(date.getMinutes()).padStart(2, "0");

    return day + "." + month + "." + year + " " + hours + ":" + minutes;
  }

  function updateObservedTime() {
    observedEl.textContent = formatObservedTime();
  }

  updateObservedTime();

  // Minutes are the finest unit actually displayed, so a once-a-minute
  // timer is the coarsest interval that still can't visibly go stale --
  // not a second timer doing 60x the work for a digit nobody sees.
  setInterval(updateObservedTime, 60000);

  // Between this timer's ticks, a backgrounded/asleep tab can drift
  // arbitrarily far out of date -- both of these catch it the moment
  // the visitor actually looks at the page again, rather than waiting
  // for the next scheduled tick.
  window.addEventListener("pageshow", updateObservedTime);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      updateObservedTime();
    }
  });
})();
