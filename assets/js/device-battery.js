// Progressive enhancement only: the static "unavailable" text already in
// index.html's #device-battery-status is a complete, meaningful fallback
// on its own -- this only refines it where the Battery Status API exists
// (Chromium; not Safari, not Firefox). Feature-detected via
// navigator.getBattery, never user-agent sniffing.
//
// This is the visiting device's own battery -- unrelated to, and never
// conflated with, the Garden's own solar-powered hosting. Nothing here
// is stored (no localStorage/cookies) or transmitted (no network
// request); it only ever updates the one DOM node in place.
async function initialiseDeviceBattery() {
  var output = document.getElementById("device-battery-status");

  if (!output) {
    return;
  }

  if (typeof navigator.getBattery !== "function") {
    output.textContent = "unavailable";
    output.dataset.state = "unsupported";
    return;
  }

  try {
    var battery = await navigator.getBattery();

    function updateBatteryStatus() {
      var level = Math.round(battery.level * 100);

      output.textContent = level + "%";

      output.dataset.state = "available";
      output.dataset.level = String(level);
      output.dataset.charging = String(battery.charging);
    }

    updateBatteryStatus();

    battery.addEventListener("levelchange", updateBatteryStatus);
    battery.addEventListener("chargingchange", updateBatteryStatus);
  } catch (error) {
    output.textContent = "unavailable";
    output.dataset.state = "unavailable";

    console.info("Device battery information is unavailable.", error);
  }
}

initialiseDeviceBattery();
