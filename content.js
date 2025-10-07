// content.js (in-page content script)
const OVERLAY_ID = "pause-reminder-overlay-v1";

function createOverlay({ durationSeconds = 10, suggestions = [], showSuggestions = true } = {}) {
  if (document.getElementById(OVERLAY_ID)) {
    console.log("PauseReminder: overlay already present, skipping create.");
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.tabIndex = -1;
  // inline styles as fallback if CSS wasn't injected
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "2147483647";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.backdropFilter = "blur(6px) brightness(0.85)";
  overlay.style.background = "rgba(0,0,0,0.18)";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 280ms ease";

  const card = document.createElement("div");
  card.className = "pr-card";
  card.style.background = "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,250,250,0.9))";
  card.style.minWidth = "300px";
  card.style.maxWidth = "85%";
  card.style.padding = "18px";
  card.style.borderRadius = "12px";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
  card.style.textAlign = "center";
  card.style.outline = "none";
  card.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

  const title = document.createElement("div");
  title.className = "pr-title";
  title.textContent = "Take a short pause";
  title.style.fontWeight = "700";
  title.style.fontSize = "18px";
  title.style.color = "#111827";
  title.style.marginBottom = "8px";

  const suggestionText = document.createElement("div");
  suggestionText.className = "pr-suggestion";
  suggestionText.textContent = selectSuggestion(suggestions);
  suggestionText.style.fontSize = "15px";
  suggestionText.style.color = "#374151";
  suggestionText.style.marginBottom = "14px";

  const btnRow = document.createElement("div");
  btnRow.className = "pr-btnrow";
  btnRow.style.display = "flex";
  btnRow.style.gap = "10px";
  btnRow.style.justifyContent = "center";

  const dismissBtn = document.createElement("button");
  dismissBtn.className = "pr-btn pr-dismiss";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.style.padding = "8px 12px";
  dismissBtn.style.borderRadius = "10px";
  dismissBtn.style.fontSize = "14px";
  dismissBtn.style.cursor = "pointer";
  dismissBtn.addEventListener("click", removeOverlay);

  const snoozeBtn = document.createElement("button");
  snoozeBtn.className = "pr-btn pr-snooze";
  snoozeBtn.textContent = "Snooze 5m";
  snoozeBtn.style.padding = "8px 12px";
  snoozeBtn.style.borderRadius = "10px";
  snoozeBtn.style.fontSize = "14px";
  snoozeBtn.style.cursor = "pointer";
  snoozeBtn.addEventListener("click", () => {
    removeOverlay();
    // optional: request a manual trigger with a short duration to simulate snooze
    chrome.runtime.sendMessage({ action: "trigger-now", durationSeconds: 5 }, () => {});
  });

  btnRow.appendChild(snoozeBtn);
  btnRow.appendChild(dismissBtn);

  card.appendChild(title);
  if (showSuggestions) card.appendChild(suggestionText);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  document.documentElement.appendChild(overlay);

  // show
  requestAnimationFrame(() => overlay.style.opacity = "1");

  // auto remove
  const timer = setTimeout(() => {
    removeOverlay();
    clearTimeout(timer);
  }, Math.max(1000, Number(durationSeconds) * 1000));

  console.log("PauseReminder: overlay shown (duration:", durationSeconds, "s )");
}

function selectSuggestion(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return "Take a breath and stretch.";
  }
  const idx = Math.floor(Math.random() * suggestions.length);
  return suggestions[idx];
}

function removeOverlay() {
  const el = document.getElementById(OVERLAY_ID);
  if (!el) return;
  el.style.opacity = "0";
  setTimeout(() => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    console.log("PauseReminder: overlay removed.");
  }, 320);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "trigger-pause") {
    try {
      createOverlay({
        durationSeconds: msg.durationSeconds,
        suggestions: msg.suggestions,
        showSuggestions: msg.showSuggestions
      });
    } catch (e) {
      console.error("PauseReminder: content script failed to create overlay:", e);
    }
  }
});
