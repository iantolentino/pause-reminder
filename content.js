// content.js
// Injects/controls the blur overlay inside each page and responds to background messages.

const OVERLAY_ID = "pause-reminder-overlay-v1";

// Helper: create overlay DOM element
function createOverlay({ durationSeconds = 10, suggestions = [], showSuggestions = true } = {}) {
  // if overlay exists, don't create another
  if (document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.tabIndex = -1;

  // inner card
  const card = document.createElement("div");
  card.className = "pr-card";

  // Title
  const title = document.createElement("div");
  title.className = "pr-title";
  title.textContent = "Take a short pause";

  // Suggestion text
  const suggestionText = document.createElement("div");
  suggestionText.className = "pr-suggestion";
  suggestionText.textContent = selectSuggestion(suggestions);

  // Buttons row
  const btnRow = document.createElement("div");
  btnRow.className = "pr-btnrow";

  // Dismiss button
  const dismissBtn = document.createElement("button");
  dismissBtn.className = "pr-btn pr-dismiss";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.addEventListener("click", removeOverlay);

  // Snooze button (5 minutes)
  const snoozeBtn = document.createElement("button");
  snoozeBtn.className = "pr-btn pr-snooze";
  snoozeBtn.textContent = "Snooze 5m";
  snoozeBtn.addEventListener("click", () => {
    removeOverlay();
    chrome.runtime.sendMessage({ action: "update-settings" }); // no-op but kept for future
    // schedule a snooze by setting a one-off alarm via background - easiest to trigger immediate through runtime
    chrome.runtime.sendMessage({ action: "trigger-now", durationSeconds: 5 }).catch(()=>{});
  });

  // Append elements
  btnRow.appendChild(snoozeBtn);
  btnRow.appendChild(dismissBtn);

  card.appendChild(title);
  if (showSuggestions) card.appendChild(suggestionText);
  card.appendChild(btnRow);

  overlay.appendChild(card);
  document.documentElement.appendChild(overlay);

  // Accessibility focus
  card.focus();

  // animate: add visible class to start CSS transitions
  requestAnimationFrame(() => overlay.classList.add("pr-visible"));

  // Auto-remove after durationSeconds
  const timer = setTimeout(() => {
    removeOverlay();
    clearTimeout(timer);
  }, Math.max(1000, Number(durationSeconds) * 1000));
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
  el.classList.remove("pr-visible");
  // match CSS transition duration (300ms)
  setTimeout(() => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }, 320);
}

// Listen for background messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === "trigger-pause") {
    // guard: do not trigger inside some extension pages or file:// where injection could be blocked
    try {
      createOverlay({
        durationSeconds: msg.durationSeconds,
        suggestions: msg.suggestions,
        showSuggestions: msg.showSuggestions
      });
    } catch (e) {
      // fail silently
      console.error("Pause Reminder overlay failed:", e);
    }
  }
});
