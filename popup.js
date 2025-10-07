// popup.js - handles UI and saving settings

const DEFAULTS = {
  enabled: true,
  intervalMinutes: 30,
  durationSeconds: 10,
  suggestions: ["Take a deep breath", "Stand and stretch", "Drink some water"],
  showSuggestions: true
};

const $ = (id) => document.getElementById(id);

function loadSettingsToUI(settings) {
  $("enabled").checked = settings.enabled;
  $("interval").value = settings.intervalMinutes;
  $("duration").value = settings.durationSeconds;
  $("suggestions").value = (settings.suggestions || []).join("\n");
  $("showSuggestions").checked = settings.showSuggestions ?? true;
}

function readUIToSettings() {
  return {
    enabled: $("enabled").checked,
    intervalMinutes: Number($("interval").value) || DEFAULTS.intervalMinutes,
    durationSeconds: Number($("duration").value) || DEFAULTS.durationSeconds,
    suggestions: $("suggestions").value.split("\n").map(s => s.trim()).filter(Boolean),
    showSuggestions: $("showSuggestions").checked
  };
}

// initialize popup
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    // ensure we have defaults for missing keys
    const settings = Object.assign({}, DEFAULTS, items);
    loadSettingsToUI(settings);
  });

  $("saveBtn").addEventListener("click", async () => {
    const settings = readUIToSettings();
    chrome.storage.sync.set(settings, () => {
      // inform background to reschedule
      chrome.runtime.sendMessage({ action: "update-settings", settings });
      // small visual feedback
      $("saveBtn").textContent = "Saved ✓";
      setTimeout(()=> $("saveBtn").textContent = "Save", 1200);
    });
  });

  $("testBtn").addEventListener("click", () => {
    // trigger immediate test via background
    const duration = Number($("duration").value) || DEFAULTS.durationSeconds;
    chrome.runtime.sendMessage({ action: "trigger-now", durationSeconds: duration }, () => {
      window.close(); // close popup after test trigger
    });
  });
});
