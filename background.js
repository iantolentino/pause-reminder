// background.js (MV3 service worker) - more robust messaging + debug logs

const DEFAULTS = {
  enabled: true,
  intervalMinutes: 30,
  durationSeconds: 10,
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
    if (!settings.enabled) {
      console.log("PauseReminder: scheduling skipped (disabled).");
      return;
    }
    chrome.alarms.create("pause-reminder", { periodInMinutes: Number(settings.intervalMinutes) });
    console.log(`PauseReminder: alarm scheduled every ${settings.intervalMinutes} min.`);
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.sync.get(null, async (items) => {
    if (!items || Object.keys(items).length === 0) {
      await chrome.storage.sync.set(DEFAULTS);
      console.log("PauseReminder: defaults seeded.");
    }
    await scheduleAlarm();
  });
});

// Helper: ensure overlay.css + content.js are injected into a tab
async function ensureInjected(tabId) {
  try {
    // insert CSS (safe to call repeatedly)
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["overlay.css"] });
  } catch (e) {
    // may fail on some pages (chrome://, webstore, pdf viewer) - that's okay
    // we'll surface a debug message instead of crashing
    console.warn("PauseReminder: insertCSS failed for tab", tabId, e?.message);
  }
  try {
    // inject content script file so the tab can listen to messages
    // injecting content.js twice is harmless because content.js guards against duplicate overlays,
    // but note this will register another onMessage listener if the file doesn't guard - we keep it minimal.
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch (e) {
    console.warn("PauseReminder: executeScript(content.js) failed for tab", tabId, e?.message);
  }
}

// Broadcast a trigger to a single tab, injecting scripts if needed
async function triggerTab(tab, payload) {
  if (!tab || !tab.id || !tab.url) return;
  // skip internal pages
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") ) {
    return;
  }

  // try sending message first
  chrome.tabs.sendMessage(tab.id, payload, async (resp) => {
    if (chrome.runtime.lastError) {
      // likely no content script in this tab; try injecting and send again
      console.warn("PauseReminder: sendMessage failed for tab", tab.id, chrome.runtime.lastError.message);
      await ensureInjected(tab.id);
      // second attempt (ignore errors)
      chrome.tabs.sendMessage(tab.id, payload, (r) => {
        if (chrome.runtime.lastError) {
          console.warn("PauseReminder: second sendMessage failed for tab", tab.id, chrome.runtime.lastError.message);
        } else {
          console.log("PauseReminder: triggered tab after injecting", tab.id);
        }
      });
    } else {
      console.log("PauseReminder: triggered tab", tab.id);
    }
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm && alarm.name === "pause-reminder") {
    const settings = await getSettings();
    if (!settings.enabled) return;
    const payload = {
      action: "trigger-pause",
      durationSeconds: Number(settings.durationSeconds),
      suggestions: settings.suggestions,
      showSuggestions: settings.showSuggestions
    };
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        triggerTab(tab, payload);
      }
    });
  }
});

// handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "update-settings") {
    chrome.storage.sync.set(msg.settings, () => {
      scheduleAlarm();
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg?.action === "trigger-now") {
    (async () => {
      const settings = await getSettings();
      const payload = {
        action: "trigger-pause",
        durationSeconds: Number(msg.durationSeconds ?? settings.durationSeconds),
        suggestions: settings.suggestions,
        showSuggestions: settings.showSuggestions
      };
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          triggerTab(tab, payload);
        }
      });
      sendResponse({ ok: true });
    })();
    return true; // keep channel open for sendResponse
  }
});
