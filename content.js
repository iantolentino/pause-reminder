// content.js — on-page rest overlay, countdown and dismiss handling (overlay not blurred)

const OVERLAY_ID = "pause-reminder-overlay-v2";

let overlayEl = null;
let overlayInterval = null;
let overlayRemaining = 0;

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.action) return;
  if (msg.action === "trigger-pause") {
    createOverlay(msg.restMinutes, msg.suggestions);
  } else if (msg.action === "end-rest") {
    // background requested end of rest (alarm fired) — remove overlay silently
    removeOverlaySilent();
  }
});

function createOverlay(restMinutes = 5, suggestions = []) {
  // If already present, optionally extend remaining time
  if (overlayEl) {
    const newRem = restMinutes * 60;
    if (newRem > overlayRemaining) overlayRemaining = newRem;
    return;
  }

  // Build overlay (no page-wide blur class)
  overlayEl = document.createElement("div");
  overlayEl.id = OVERLAY_ID;
  overlayEl.className = "pause-overlay";

  const card = document.createElement("div");
  card.className = "pause-card";

  const title = document.createElement("div");
  title.className = "pause-title";
  title.textContent = "Rest Time 🕒";

  const suggestion = document.createElement("div");
  suggestion.className = "pause-text";
  suggestion.textContent = (Array.isArray(suggestions) && suggestions.length)
    ? suggestions[Math.floor(Math.random() * suggestions.length)]
    : "Take a short break.";

  const timerEl = document.createElement("div");
  timerEl.className = "pause-timer";
  timerEl.textContent = formatClock(restMinutes * 60);

  const btn = document.createElement("button");
  btn.className = "pause-btn";
  btn.textContent = "Dismiss";
  btn.addEventListener("click", () => userDismiss());

  card.appendChild(title);
  card.appendChild(suggestion);
  card.appendChild(timerEl);
  card.appendChild(btn);
  overlayEl.appendChild(card);
  document.body.appendChild(overlayEl);

  // show overlay (overlay CSS uses backdrop-filter to blur page behind it)
  overlayEl.classList.add("visible");

  overlayRemaining = restMinutes * 60;
  timerEl.textContent = `Resuming in ${formatClock(overlayRemaining)}`;

  overlayInterval = setInterval(() => {
    overlayRemaining--;
    if (overlayRemaining <= 0) {
      clearInterval(overlayInterval);
      overlayInterval = null;
      // natural end: remove overlay silently; background's rest-end alarm will also fire to resume focus
      removeOverlaySilent();
    } else {
      timerEl.textContent = `Resuming in ${formatClock(overlayRemaining)}`;
    }
  }, 1000);
}

function userDismiss() {
  // notify background to resume focus immediately
  try {
    chrome.runtime.sendMessage({ action: "resume-focus" });
  } catch (e) { /* ignore */ }
  removeOverlay(false);
}

function removeOverlay(silent = true) {
  if (!overlayEl) return;
  if (overlayInterval) {
    clearInterval(overlayInterval);
    overlayInterval = null;
  }
  overlayEl.classList.remove("visible");
  setTimeout(() => {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
  }, 220);

  // if not silent, background already got resume-focus (userDismiss sends it) — nothing extra here
  // (we keep removeOverlay used for UI cleanup only)
}

function removeOverlaySilent() {
  removeOverlay(true);
}

function formatClock(totalSeconds) {
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
