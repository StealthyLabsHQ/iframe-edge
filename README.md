<h1 align="center">🖥️ iframe-edge</h1>

<img width="2560" height="720" alt="{ADD81F34-B6AF-41F5-8927-9F8BCA4BE490}" src="https://github.com/user-attachments/assets/ceccbf30-6d85-4d0e-aecf-327c5137d9c8" />
<img width="2560" height="720" alt="{A72EA717-C9F2-4B4B-9514-57498A444FDE}" src="https://github.com/user-attachments/assets/cacc99a5-3e7c-4b96-a160-db1d7031cb02" />
<img width="2560" height="720" alt="{A7221C84-BBC2-4EEC-B00B-86D7A814B4CC}" src="https://github.com/user-attachments/assets/1a1be2d4-1d50-48ba-9d91-31c3a3d91e64" />
<img width="2560" height="720" alt="{0D4010FE-62BE-42F3-A0AD-2EEB821F9203}" src="https://github.com/user-attachments/assets/b3af95e0-2289-48e6-b895-bc2b2d309e23" />

<p align="center">
  <b>All-in-one HTML/CSS/JS widgets in a single file for Productivity, Streaming, and more.</b></br>
  <i>Specially designed to be 100% responsive for Corsair Xeneon Edge & iCUE.</i>
</p>

---

## ✨ Features

- **No external dependencies:** Pure HTML, CSS, and vanilla JavaScript bundled in single files.
- **Fully Responsive:** Automatically scales to fit any container size (`M`, `L`, `XL`).
- **Plug & Play:** Just copy the code and paste it.
- **Dark Mode OLED / Light Mode** with a toggle on each widget.
- **EN / FR** bilingual support on all widgets.
- **AI Assistant for 3 AI Models:** Google Gemini, Anthropic Claude, and OpenAI ChatGPT.
---

## 🗂️ Available Widgets

| Widget | iCUE `<iframe>` Code (Copy & Paste) |
|---|---|
| 🤖 **AI Assistant** | `<iframe src="https://stealthylabshq.github.io/iframe-edge/ai-assistant/"></iframe>` |
| � News Radar | `<iframe src="https://stealthylabshq.github.io/iframe-edge/news-radar/"></iframe>` |
| 🎵 Spotify Visualizer | `<iframe src="https://stealthylabshq.github.io/iframe-edge/spotify-visualizer/"></iframe>` |
| �💧 Hydration | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>` |
| 💰 Budget | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/budget/"></iframe>` |
| 🍅 Pomodoro | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/pomodoro/"></iframe>` |
| ⏱️ Timer & Countdown | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/timer/"></iframe>` |
| 📝 Quick Notes | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/notes/"></iframe>` |
| 🎯 Daily Focus | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/daily-focus/"></iframe>` |
| ✅ Habit Tracker | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/habit-tracker/"></iframe>` |
| 🧘 Posture & Blink | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/posture-reminder/"></iframe>` |
| 📋 Quick Clipboard | `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/quick-clipboard/"></iframe>` |


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

## 🇫🇷 Documentation en Français

### 📋 Prérequis

Pour utiliser ces widgets sur votre installation Corsair, vous aurez besoin de :

- Un écran **Corsair Xeneon Edge**.
- Le logiciel **[Corsair iCUE](https://www.corsair.com/icue)** installé et à jour sur votre machine.

### 🚀 iFrame Direct

1. Ouvrez **iCUE** et allez dans la configuration de votre écran.
2. Dans la liste des **Widgets** (colonne gauche), cliquez sur l'icône **`</> iFrame`**.
3. Choisissez la taille souhaitée : **`M`**, **`L`**, ou **`XL`**.
4. Dans les réglages de l'iFrame, cherchez le champ de texte principal **code HTML**.
5. **Copiez le code `<iframe>`** du tableau ci-dessus pour le widget souhaité, et **collez-le** dans la zone de texte.
   *(Exemple : `<iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>`)*

> **🎉 Et voilà !** Le widget se chargera directement depuis GitHub Pages.

### 🤖 Assistant IA

Le widget Assistant IA nécessite une clé API de Google (Gemini), Anthropic (Claude), ou OpenAI (ChatGPT) pour fonctionner.

<p align="center"><img width="420" height="573" alt="{D9C92563-D79B-4473-BF24-CE4F2FEB7B6D}" src="https://github.com/user-attachments/assets/3d705bdb-ce5a-4ed7-8589-008153144234" /></p>

**Comment obtenir une clé API :**
- <img src="svg/img/google.png" width="20" height="20" style="vertical-align: middle; margin-right: 4px;"> **Google Gemini (Gratuit disponible / Payant à l'usage [Recommandé]) :** Allez sur [Google AI Studio](https://aistudio.google.com/app/apikey), connectez-vous avec votre compte Google et cliquez sur "Create API Key".
- <img src="svg/img/anthropic.png" width="20" height="20" style="vertical-align: middle; margin-right: 4px;"> **Anthropic Claude (Payant à l'usage) :** Allez sur la [Console Anthropic](https://console.anthropic.com/settings/keys), connectez-vous et générez une nouvelle clé secrète.
- <img src="svg/img/openai.png" width="20" height="20" style="vertical-align: middle; margin-right: 4px;"> **OpenAI (Payant à l'usage) :** Allez sur la [Plateforme OpenAI](https://platform.openai.com/api-keys), connectez-vous et générez une nouvelle clé secrète.

**Configuration :**
1. Ajoutez le widget dans iCUE en utilisant son code `<iframe>` du tableau.
2. Cliquez sur l'icône **Paramètres ⚙️** en haut à droite du widget.
3. Sélectionnez votre fournisseur préféré (Google, Anthropic, ou OpenAI) et collez votre clé API.
4. Cliquez sur **Enregistrer**. Votre clé est stockée localement de manière sécurisée dans votre session iCUE.

### 🎵 Spotify Visualizer

**Prérequis :**
- Avoir un compte **Spotify Premium**.

**Comment l'installer :**
1. Allez sur le site des développeurs Spotify avec [ce lien](https://developer.spotify.com/dashboard) et connectez-vous.
2. Cliquez sur **Create app** (Créer une application).
3. Remplissez le nom et la description de l'application.
4. Ajouter en tant que **Redirect URL** exactement : 
   `https://stealthylabshq.github.io/iframe-edge/spotify-visualizer/auth/callback.html`
5. Et cochez la case **Web API**.
6. Enregistrez et récupérez votre **Client ID**.

**Comment l'utiliser :**
1. Ajoutez le widget dans iCUE comme décrit plus haut avec son URL.
2. Au chargement du widget, entrez votre **Client ID** pour vous connecter.
3. Autorisez l'accès à votre compte et profitez de la musique !

---