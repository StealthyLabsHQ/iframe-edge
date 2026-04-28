<h1 align="center">🖥️ iframe-edge</h1>

<p align="center">
  <b>All-in-one HTML/CSS/JS widgets in a single file for Productivity, Streaming, and more.</b></br>
  <i>Specially designed to be 100% responsive for Corsair Xeneon Edge & iCUE.</i>
</p>

---
## ✨ Features

- **No external dependencies:** Pure HTML, CSS, and vanilla JavaScript bundled in single files.
- **Fully Responsive:** M / L / XL sizes via `?size=` URL param or iCUE body-class injection.
- **Plug & Play:** Use either GitHub Pages iFrame embeds or native `.icuewidget` imports.
- **Dark Mode OLED / Light Mode** with a toggle on each widget.
- **English-only UI copy** across active widgets.
- **AI Assistant for 3 AI Models:** Google Gemini, Anthropic Claude, and OpenAI ChatGPT.
- **Xeneon Edge Design System:** Shared `xeneon-edge.css` + `size-loader.js` — unified tokens, fonts, and size variants across all widgets.
- **Headerless widget polish:** Shared `widget-polish.css` removes title-heavy headers and tightens controls, surfaces, borders, and focus states.

---

## 🗂️ Available Widgets

Every widget can be used in two ways: live GitHub Pages iFrame embed, or native iCUE import with the matching `.icuewidget` file from `dist/icuewidgets/`.

| Widget | iCUE `<iframe>` Code (Copy & Paste) |
|---|---|
| 🤖 **AI Assistant** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/ai-assistant/"></iframe>` |
| 🎵 **Spotify Visualizer** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/spotify-visualizer/"></iframe>` |
| 🛰️ **ISS Horizon** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/iss-horizon/"></iframe>` |
| 💧 **Hydration** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>` |
| 💰 **Budget** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/budget/"></iframe>` |
| 🍅 **Pomodoro** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/pomodoro/"></iframe>` |
| ⏱️ **Timer & Countdown** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/timer/"></iframe>` |
| 📝 **Quick Notes** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/notes/"></iframe>` |
| 🎯 **Daily Focus** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/daily-focus/"></iframe>` |
| ✅ **Habit Tracker** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/habit-tracker/"></iframe>` |
| 🧘 **Posture & Blink** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/posture-reminder/"></iframe>` |
| 📋 **Quick Clipboard** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/quick-clipboard/"></iframe>` |

Native packages are generated under `dist/icuewidgets/`:
`ai-assistant.icuewidget`, `spotify-visualizer.icuewidget`, `iss-horizon.icuewidget`, `news-radar.icuewidget`, `budget.icuewidget`, `daily-focus.icuewidget`, `habit-tracker.icuewidget`, `hydration.icuewidget`, `notes.icuewidget`, `pomodoro.icuewidget`, `posture-reminder.icuewidget`, `quick-clipboard.icuewidget`, and `timer.icuewidget`.

---

## 🇬🇧 English Documentation

### 📋 Prerequisites

To use these widgets on your Corsair setup, you will need:

- A **Corsair Xeneon Edge** display.
- The **[Corsair iCUE](https://www.corsair.com/icue)** software installed and up to date.

### 🚀 iFrame

1. Open **iCUE** and go to your screen/dashboard configuration.
2. In the **Widgets** list (left column), click on the **`</> iFrame`** icon.
3. Choose your desired size: **`M`**, **`L`**, or **`XL`**.
4. In the iFrame settings, look for the **HTML code** text area.
5. **Copy the `<iframe>` code** from the table above for your desired widget, and **paste it** into the text area.
   *(Example: `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>`)*

> **🎉 Done!** The widget will load live from GitHub Pages.

### iCUE Widget Packages

Widgets can also be imported directly into iCUE as `.icuewidget` files instead of using the generic iFrame widget.

The iCUE Widget CLI is used to validate each package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-icuewidgets.ps1
```

Packaged widgets are written to `dist/icuewidgets/*.icuewidget`.
Each package includes a transparent widget-specific SVG preview icon at `resources/icon.svg`.
Spotify Visualizer uses `svg/spotify.svg` for its package preview icon.
Packages include `tr('...')` HTML titles required by the iCUE import validator.
Packages also inject a minimal global `icueEvents` bridge so the iCUE validator accepts every widget.
The default iCUE bridge is packaged as an external script so CSP does not need automatic `unsafe-inline` relaxation.
Packages contain a single widget HTML entry, `index.html`; secondary web pages are excluded from `.icuewidget` archives.
Packages include a viewport meta tag before the iCUE title.
Packaged manifests target Xeneon Edge as `dashboard_lcd` with `sensor-screen` support.
Translation files include Corsair locale keys, all mapped to English fallback text.
The packaging script stages files in `icuewidget-build/`; do not switch it to a dot-prefixed folder because the official CLI skips hidden path segments.
Final archives are written with `index.html` as the first ZIP entry to match importable Marketplace packages.
The Spotify Visualizer package exposes native iCUE settings for `Spotify Client ID`, `Refresh Token`, and the Spotify Developer Dashboard URL, opens Spotify authorization from the widget overlay, preserves rotated refresh tokens across iCUE widget switches, retries the native iCUE token after restart fallback, restores the last track while reconnecting, caches synced lyrics, maps S/M to player-only layouts with volume controls, and maps L/XL to lyrics layouts.

### 📐 Size Variants

Most widgets support three sizes via the `?size=` URL parameter:

| Size | Dimensions | URL |
|---|---|---|
| **M** | ~300 × 200 px | `…/pomodoro/?size=m` |
| **L** | ~400 × 280 px | `…/pomodoro/` *(default)* |
| **XL** | ~560 × 380 px | `…/pomodoro/?size=xl` |

Example — Pomodoro in XL:
```html
<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/pomodoro/?size=xl"></iframe>
```

> ISS Horizon uses iCUE's native body-class injection (`sz-m` / `sz-l` / `sz-xl`) and does not need the `?size=` param.

### 🤖 AI Assistant

The AI Assistant widget requires an API key from either Google (Gemini), Anthropic (Claude), or OpenAI (ChatGPT) to function.

<p align="center"><img width="420" height="573" alt="{D9C92563-D79B-4473-BF24-CE4F2FEB7B6D}" src="https://github.com/user-attachments/assets/3d705bdb-ce5a-4ed7-8589-008153144234" /></p>


**How to get an API Key:**
- <img src="svg/img/google.png" width="20" height="20" style="vertical-align: middle; margin-right: 4px;"> **Google Gemini (Free tier available / Pay-as-you-go [Recommended]):** Go to [Google AI Studio](https://aistudio.google.com/app/apikey), sign in with your Google account, and click "Create API Key".
- <img src="svg/img/anthropic.png" width="20" height="20" style="vertical-align: middle; margin-right: 4px;"> **Anthropic Claude (Pay-as-you-go):** Go to the [Anthropic Console](https://console.anthropic.com/settings/keys), sign in, and generate a new secret key.
- <img src="svg/img/openai.png" width="20" height="20" style="vertical-align: middle; margin-right: 4px;"> **OpenAI (Pay-as-you-go):** Go to the [OpenAI Platform](https://platform.openai.com/api-keys), sign in, and generate a new secret key.

**Setup Instructions:**
1. Add the widget to iCUE using its `<iframe>` code from the table.
2. Click the **Settings ⚙️** icon in the top right corner of the widget.
3. Select your preferred provider (Google, Anthropic, or OpenAI) and paste your API Key.
4. Click **Save**. Your key is securely stored locally in your iCUE session.

### 🎵 Spotify Visualizer

**Prerequisites:**
- A **Spotify Premium** account.

**Setup Instructions:**
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click on **Create app**.
3. Fill in the app name and description.
4. For the **Redirect URL**, add exactly: 
   `https://stealthylabshq.github.io/iframe-edge/spotify-visualizer/auth/callback.html`
5. Make sure to check the **Web API** box.
6. Save and go to your app settings to find your **Client ID**.

**How to Use:**
1. Add the widget to iCUE as described above using its specific URL.
2. When the widget loads, enter your **Client ID** to connect.
3. You will be redirected to log in and grant permissions.

---
