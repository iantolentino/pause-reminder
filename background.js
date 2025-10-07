// background.js (service worker)
// Manages alarms and relays trigger messages to tabs.

const DEFAULTS = {
  enabled: true,
  intervalMinutes: 30, // default 30 minutes
  durationSeconds: 10, // default 10 seconds blur
  suggestions: ["Take a deep breath", "Stand and stretch", "Drink some water"],
  showSuggestions: true
};

async function getSettings() {
  return new Promise((resolve) =>
    chrome.storage.sync.get(DEFAULTS, (items) => resolve(items))
  );
}

async function scheduleAlarm() {
  const settings = await getSettings();
  chrome.alarms.clearAll(() => {
    if (!settings.enabled) return;
    // Create repeating alarm
    chrome.alarms.create("pause-reminder", {
      periodInMinutes: Number(settings.intervalMinutes),
      // create immediately so first reminder occurs after interval
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  // seed defaults on install
  chrome.storage.sync.get(null, async (items) => {
    if (!items || Object.keys(items).length === 0) {
      await chrome.storage.sync.set(DEFAULTS);
    }
    await scheduleAlarm();
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm && alarm.name === "pause-reminder") {
    const settings = await getSettings();
    if (!settings.enabled) return;

    // Broadcast to all tabs to trigger overlay
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        // only message tabs with a valid id and non-chrome URLs
        if (!tab.id || tab.url?.startsWith("chrome://")) continue;
        chrome.tabs.sendMessage(tab.id, {
          action: "trigger-pause",
          durationSeconds: Number(settings.durationSeconds),
          suggestions: settings.suggestions,
          showSuggestions: settings.showSuggestions
        }).catch(() => {/* ignore tabs that can't be reached */});
      }
    });
  }
});

// Listen to messages from popup to update schedule or immediate trigger
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "update-settings") {
    chrome.storage.sync.set(msg.settings, () => {
      scheduleAlarm();
      sendResponse({ok: true});
    });
    return true; // keep channel open for async response
  }

  if (msg?.action === "trigger-now") {
    // create a one-off immediate alarm fire by directly broadcasting
    getSettings().then((settings) => {
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (!tab.id || tab.url?.startsWith("chrome://")) continue;
          chrome.tabs.sendMessage(tab.id, {
            action: "trigger-pause",
            durationSeconds: Number(msg.durationSeconds ?? settings.durationSeconds),
            suggestions: settings.suggestions,
            showSuggestions: settings.showSuggestions
          }).catch(()=>{});
        }
      });
      sendResponse({ok:true});
    });
    return true;
  }
});
