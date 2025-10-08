// popup.js — UI interactions, Reset clears tracked times, and immediate start/pause use current inputs
document.addEventListener("DOMContentLoaded", () => {
  const intervalEl = document.getElementById("interval");
  const durationEl = document.getElementById("duration");
  const focusEl = document.getElementById("focus");
  const restEl = document.getElementById("rest");
  const statusEl = document.getElementById("status");
  const remainingEl = document.getElementById("remaining");

  // load saved settings
  chrome.storage.sync.get({ intervalMinutes: 30, restMinutes: 5 }, (res) => {
    intervalEl.value = res.intervalMinutes;
    durationEl.value = res.restMinutes;
  });

  function formatClock(totalSeconds) {
    const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const ss = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  async function refreshUI() {
    chrome.runtime.sendMessage({ action: "get-stats" }, (stats) => {
      if (!stats) return;
      focusEl.textContent = stats.focusMinutes || 0;
      restEl.textContent = stats.restMinutes || 0;
      statusEl.textContent = stats.status || "Idle";
      statusEl.style.color = stats.status === "Resting" ? "#ef4444" : (stats.status === "Focusing" ? "#10b981" : "#6b7280");

      chrome.storage.local.get(["nextFocusEnd", "nextRestEnd"], (vals) => {
        const nf = vals.nextFocusEnd || 0;
        const nr = vals.nextRestEnd || 0;
        const now = Date.now();
        if (stats.status === "Focusing" && nf && nf > now) {
          const secs = Math.max(0, Math.ceil((nf - now) / 1000));
          remainingEl.textContent = `Focus remaining: ${formatClock(secs)}`;
        } else if (stats.status === "Resting" && nr && nr > now) {
          const secs = Math.max(0, Math.ceil((nr - now) / 1000));
          remainingEl.textContent = `Rest remaining: ${formatClock(secs)}`;
        } else {
          remainingEl.textContent = "—";
        }
      });
    });
  }

  // periodic UI update
  refreshUI();
  const uiTimer = setInterval(refreshUI, 1000);

  // Start Focus: send current inputs immediately (persist to storage too)
  document.getElementById("start-focus").addEventListener("click", () => {
    const settings = {
      intervalMinutes: Number(intervalEl.value) || 30,
      restMinutes: Number(durationEl.value) || 5
    };
    chrome.runtime.sendMessage({ action: "start-focus", settings }, () => {
      // also persist to storage
      chrome.storage.sync.set(settings, () => refreshUI());
    });
  });

  // Pause Now: immediate rest; target active tab first for immediate overlay visibility
  document.getElementById("pause-now").addEventListener("click", () => {
    const settings = {
      intervalMinutes: Number(intervalEl.value) || 30,
      restMinutes: Number(durationEl.value) || 5
    };
    chrome.runtime.sendMessage({ action: "pause-now", fromPopup: true, settings }, () => {
      chrome.storage.sync.set(settings, () => refreshUI());
    });
  });

  // Reset tracked times
  document.getElementById("reset").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "reset-stats" }, () => {
      refreshUI();
    });
  });

  window.addEventListener("unload", () => clearInterval(uiTimer));
});
