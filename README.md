# 🕒 Pause Reminder — Chrome Extension

### **Stay focused. Rest mindfully. Work smarter.**

**Pause Reminder** helps you build healthy work rhythms by tracking your focus time and gently reminding you to take short, meaningful breaks.
It blurs your screen with a calm overlay, shows a rest countdown, and tracks your daily focus vs. rest time — all locally, without any cloud storage or data sharing.

---

## ✨ Features

* 🧠 **Focus Tracking**
  Start a focus session manually or let the extension schedule it automatically. Tracks your total daily focus minutes.

* ☕ **Smart Rest Overlays**
  When your focus interval ends, the extension gently blurs the active page with a fullscreen overlay and displays a **rest countdown** and **wellness suggestion** (e.g., “Stretch a little”, “Drink some water”).

* 💤 **Automatic Transition Between States**

  * Focus → Rest (overlay appears)
  * Rest → Focus (overlay disappears automatically)

* 🖱️ **Manual Control**

  * **Start Focus** — begins a focus interval immediately.
  * **Pause Now** — shows the rest overlay instantly (useful for spontaneous breaks).
  * **Reset** — clears daily focus and rest stats.

* 📊 **Daily Summary**
  Displays your current **status**, **focus minutes**, and **rest minutes** in the popup UI. Stats reset automatically each day.

* 💾 **Local & Private**
  All data is stored locally using Chrome’s `storage.local` — nothing leaves your device.

---

## 🧩 Tech Stack

* **Manifest V3**
* **HTML / CSS / Vanilla JavaScript**
* **Chrome APIs**:
  `storage`, `alarms`, `tabs`, `scripting`, `activeTab`, and `content_scripts`
* **Modular Architecture**:

  * `background.js` — controls session logic, alarms, and state tracking.
  * `content.js` — displays rest overlay and handles countdown UI.
  * `popup.html` / `popup.js` — user interface for control and stats.
  * `overlay.css` / `popup.css` — modern, responsive styling.

---

## ⚙️ How It Works

1. **Start a Focus Session**

   * Click **Start Focus** in the popup.
   * The extension sets a timer for your chosen *focus interval*.
   * Status changes to **“Focusing”**, and a live countdown appears.

2. **Automatic Rest Reminder**

   * When focus time ends, `background.js` automatically injects an overlay into your current active tab.
   * The overlay softly blurs the page and displays:

     * A random wellness suggestion.
     * A **rest countdown timer**.
     * A **Dismiss** button (to skip the rest).

3. **End of Rest**

   * If you wait out the rest timer → overlay disappears automatically and focus resumes.
   * If you dismiss early → focus resumes immediately.

4. **Tracking**

   * Focus and rest minutes are tracked daily.
   * Stats auto-reset at midnight or when you click **Reset**.

---

## 🪶 UI Overview

| Popup Panel                                                         | Overlay Example                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ![Popup Example](https://via.placeholder.com/350x200?text=Popup+UI) | ![Overlay Example](https://via.placeholder.com/350x200?text=Overlay+Example) |

*(Replace placeholders with actual screenshots before publishing.)*

---

## 🧰 Developer Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/pause-reminder-extension.git
cd pause-reminder-extension
```

### 2. Load the extension in Chrome

1. Open **chrome://extensions/**
2. Enable **Developer Mode**
3. Click **“Load unpacked”**
4. Select the project folder

### 3. Test it

* Open any website (not a `chrome://` page)
* Open the extension popup

  * Set **Focus Interval** = 1 min
  * Set **Rest Duration** = 1 min
  * Click **Start Focus**
* Wait for the rest overlay to appear automatically.
* Click **Pause Now** to test manual rest.

---

## 🧪 Debugging

Open **chrome://extensions** → click **Inspect service worker** for logs.
You’ll see debug lines like:

```
PauseReminder: focus-end alarm set for ...
PauseReminder: alarm fired: focus-end
PauseReminder: startRestSession broadcasting overlay ...
```

If overlays don’t appear:

* Check the **service worker console** for “PauseReminder” logs.
* Check the **page console (F12)** for any `content.js` errors.

---

## 🧱 Folder Structure

```
pause-reminder/
│
├── manifest.json
├── background.js
├── content.js
├── overlay.css
│
├── popup.html
├── popup.js
├── popup.css
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔐 Permissions

| Permission           | Why it’s needed                          |
| -------------------- | ---------------------------------------- |
| `storage`            | Store daily stats & settings locally     |
| `alarms`             | Schedule automatic rest and focus timers |
| `tabs` / `activeTab` | Target and blur the correct tab          |
| `scripting`          | Dynamically inject overlay content       |
| `host_permissions`   | Enable content scripts on all websites   |

---

## 🧑‍💻 Contributing

Contributions are welcome!
If you’d like to improve animations, add sound cues, or integrate stats export, feel free to open a PR.

1. Fork the repo
2. Create your feature branch
3. Commit changes with clear messages
4. Open a pull request

---

## 📄 License

MIT License © 2025 [Your Name]
Use freely. Please credit if you fork or publish derived work.

---

## 💡 Future Enhancements

* 🔔 Optional gentle chime when rest begins
* 📅 Weekly or monthly focus reports
* 🎨 Custom overlay themes
* 📱 Synchronize settings across devices
