// background.js — more aggressive active-tab targeting on focus-end + robust injection + logs

const DEFAULTS = {
  enabled: true,
  intervalMinutes: 30,
  restMinutes: 5,
  suggestions: ["Stretch a little", "Drink some water", "Look away from the screen"]
};

console.log("PauseReminder: background loaded");

// === helpers ===
async function getSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, (r) => resolve(r)));
}

async function getDailyStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["dailyStats"], (res) => {
      const today = new Date().toDateString();
      let stats = res.dailyStats || {};
      if (stats.date !== today) {
        stats = { date: today, focusMinutes: 0, restMinutes: 0, status: "Idle" };
        chrome.storage.local.set({ dailyStats: stats });
      }
      resolve(stats);
    });
  });
}

function saveDailyStats(stats) {
  chrome.storage.local.set({ dailyStats: stats });
}

// try sendMessage, inject css+script and retry once if the tab had no content listener
async function sendMessageToTabEnsuringContent(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, async (resp) => {
      if (chrome.runtime.lastError) {
        console.warn("PauseReminder: initial sendMessage failed (will try injection) on tab", tabId, chrome.runtime.lastError.message);
        try {
          await chrome.scripting.insertCSS({ target: { tabId }, files: ["overlay.css"] });
        } catch (e) {
          console.warn("PauseReminder: insertCSS failed on tab", tabId, e?.message);
        }
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
        } catch (e) {
          console.warn("PauseReminder: executeScript(content.js) failed on tab", tabId, e?.message);
        }

        // short delay then retry sendMessage
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, message, (resp2) => {
            if (chrome.runtime.lastError) {
              console.error("PauseReminder: retry sendMessage failed on tab", tabId, chrome.runtime.lastError.message);
              resolve(false);
            } else {
              console.log("PauseReminder: retry sendMessage succeeded on tab", tabId);
              resolve(true);
            }
          });
        }, 150);
      } else {
        resolve(true);
      }
    });
  });
}

// broadcast to http/https tabs ensuring content exists
async function broadcastToTabs(message) {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, async (tabs) => {
      const results = [];
      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          const ok = await sendMessageToTabEnsuringContent(tab.id, message);
          results.push(ok);
        } catch (e) {
          console.warn("PauseReminder: broadcast error for tab", tab.id, e?.message);
          results.push(false);
        }
      }
      resolve(results);
    });
  });
}

// === session control ===
async function startFocusSession(settingsOverride = null) {
  const settings = settingsOverride || (await getSettings());
  const stats = await getDailyStats();
  stats.status = "Focusing";
  saveDailyStats(stats);

  const nextFocusEnd = Date.now() + (Number(settings.intervalMinutes) || DEFAULTS.intervalMinutes) * 60000;
  chrome.storage.local.set({ nextFocusEnd, nextRestEnd: 0 });

  chrome.alarms.clear("focus-end", () => {
    chrome.alarms.create("focus-end", { when: nextFocusEnd });
    console.log("PauseReminder: focus-end alarm set for", new Date(nextFocusEnd).toISOString());
  });
  chrome.alarms.clear("rest-end");
}

async function startRestSession(settingsOverride = null) {
  const settings = settingsOverride || (await getSettings());
  const stats = await getDailyStats();
  stats.status = "Resting";
  stats.restMinutes = (stats.restMinutes || 0) + Number(settings.restMinutes || DEFAULTS.restMinutes);
  saveDailyStats(stats);

  console.log("PauseReminder: startRestSession broadcasting overlay for", settings.restMinutes, "min");
  await broadcastToTabs({
    action: "trigger-pause",
    restMinutes: Number(settings.restMinutes || DEFAULTS.restMinutes),
    suggestions: settings.suggestions || DEFAULTS.suggestions
  });

  const nextRestEnd = Date.now() + (Number(settings.restMinutes) || DEFAULTS.restMinutes) * 60000;
  chrome.storage.local.set({ nextRestEnd, nextFocusEnd: 0 });

  chrome.alarms.clear("rest-end", () => {
    chrome.alarms.create("rest-end", { when: nextRestEnd });
    console.log("PauseReminder: rest-end alarm set for", new Date(nextRestEnd).toISOString());
  });
  chrome.alarms.clear("focus-end");
}

// === alarms ===
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm || !alarm.name) return;
  console.log("PauseReminder: alarm fired:", alarm.name);

  if (alarm.name === "focus-end") {
    // Aggressive active-tab targeting: try to place overlay on active tab first (so user sees it)
    const settings = await getSettings();
    // update stats immediately for rest
    const stats = await getDailyStats();
    stats.status = "Resting";
    stats.restMinutes = (stats.restMinutes || 0) + Number(settings.restMinutes || DEFAULTS.restMinutes);
    saveDailyStats(stats);

    // try active tab first
    chrome.tabs.query({ active: true, currentWindow: true, url: ["http://*/*", "https://*/*"] }, async (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.id) {
        console.log("PauseReminder: focus-end -> trying active tab", tab.id);
        const ok = await sendMessageToTabEnsuringContent(tab.id, {
          action: "trigger-pause",
          restMinutes: Number(settings.restMinutes || DEFAULTS.restMinutes),
          suggestions: settings.suggestions || DEFAULTS.suggestions
        });
        if (ok) {
          // set rest-end alarm (same as startRestSession)
          const nextRestEnd = Date.now() + (Number(settings.restMinutes || DEFAULTS.restMinutes) * 60000);
          chrome.storage.local.set({ nextRestEnd, nextFocusEnd: 0 });
          chrome.alarms.clear("rest-end", () => {
            chrome.alarms.create("rest-end", { when: nextRestEnd });
            console.log("PauseReminder: rest-end alarm set for", new Date(nextRestEnd).toISOString());
          });
          return;
        } else {
          console.warn("PauseReminder: active tab injection failed, falling back to broadcast");
        }
      } else {
        console.warn("PauseReminder: no active http/https tab found, falling back to broadcast");
      }

      // fallback broadcast
      await startRestSession(settings);
    });
  } else if (alarm.name === "rest-end") {
    console.log("PauseReminder: rest-end — removing overlays and resuming focus");
    // ensure overlays removed (try active tab first)
    chrome.tabs.query({ active: true, currentWindow: true, url: ["http://*/*", "https://*/*"] }, async (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.id) {
        const ok = await sendMessageToTabEnsuringContent(tab.id, { action: "end-rest" });
        if (!ok) await broadcastToTabs({ action: "end-rest" });
      } else {
        await broadcastToTabs({ action: "end-rest" });
      }
      // resume focus
      await startFocusSession();
    });
  }
});

// === install/init ===
chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    const need = {};
    for (const k of Object.keys(DEFAULTS)) if (items[k] === undefined) need[k] = DEFAULTS[k];
    if (Object.keys(need).length) chrome.storage.sync.set(need);
  });
  await getDailyStats();
  console.log("PauseReminder: installed/initialized");
});

// auto-increment focus minutes every minute
setInterval(async () => {
  const stats = await getDailyStats();
  if (stats.status === "Focusing") {
    stats.focusMinutes = (stats.focusMinutes || 0) + 1;
    saveDailyStats(stats);
  }
}, 60000);

// reset daily stats helper
async function resetDailyStats() {
  const today = new Date().toDateString();
  const stats = { date: today, focusMinutes: 0, restMinutes: 0, status: "Idle" };
  chrome.storage.local.set({ dailyStats: stats, nextFocusEnd: 0, nextRestEnd: 0 });
  chrome.alarms.clearAll();
  console.log("PauseReminder: daily stats reset");
}

// === message handler ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || !msg.action) {
      sendResponse({ ok: false });
      return;
    }
    console.log("PauseReminder: received message", msg.action);

    switch (msg.action) {
      case "start-focus": {
        if (msg.settings) chrome.storage.sync.set(msg.settings);
        await startFocusSession(msg.settings || null);
        sendResponse({ ok: true });
        break;
      }
      case "pause-now": {
        // prefer active tab for immediate overlay if message came from popup
        if (msg.fromPopup) {
          chrome.tabs.query({ active: true, currentWindow: true, url: ["http://*/*", "https://*/*"] }, async (tabs) => {
            const tab = tabs && tabs[0];
            const settingsObj = msg.settings || (await getSettings());
            const stats = await getDailyStats();
            stats.status = "Resting";
            stats.restMinutes = (stats.restMinutes || 0) + Number(settingsObj.restMinutes || DEFAULTS.restMinutes);
            saveDailyStats(stats);

            if (tab && tab.id) {
              const ok = await sendMessageToTabEnsuringContent(tab.id, {
                action: "trigger-pause",
                restMinutes: Number(settingsObj.restMinutes || DEFAULTS.restMinutes),
                suggestions: settingsObj.suggestions || DEFAULTS.suggestions
              });
              if (!ok) {
                await broadcastToTabs({
                  action: "trigger-pause",
                  restMinutes: Number(settingsObj.restMinutes || DEFAULTS.restMinutes),
                  suggestions: settingsObj.suggestions || DEFAULTS.suggestions
                });
              }
            } else {
              await startRestSession(settingsObj);
            }

            const nextRestEnd = Date.now() + (Number(settingsObj.restMinutes || DEFAULTS.restMinutes) * 60000);
            chrome.storage.local.set({ nextRestEnd, nextFocusEnd: 0 });
            chrome.alarms.clear("rest-end", () => {
              chrome.alarms.create("rest-end", { when: nextRestEnd });
            });

            sendResponse({ ok: true });
          });
        } else {
          if (msg.settings) chrome.storage.sync.set(msg.settings);
          await startRestSession(msg.settings || null);
          sendResponse({ ok: true });
        }
        break;
      }
      case "resume-focus": {
        await startFocusSession();
        sendResponse({ ok: true });
        break;
      }
      case "get-stats": {
        const stats = await getDailyStats();
        chrome.storage.local.get(["nextFocusEnd", "nextRestEnd"], (vals) => {
          sendResponse({ ...stats, nextFocusEnd: vals.nextFocusEnd || 0, nextRestEnd: vals.nextRestEnd || 0 });
        });
        break;
      }
      case "update-settings": {
        chrome.storage.sync.set(msg.settings || {}, () => sendResponse({ ok: true }));
        break;
      }
      case "reset-stats": {
        await resetDailyStats();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false });
    }
  })();

  return true;
});
