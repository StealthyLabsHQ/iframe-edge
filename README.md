<h1 align="center">🖥️ iframe-edge</h1>

<p align="center">
  <b>All-in-one HTML/CSS/JS widgets in a single file for Productivity, Streaming, DevOps, and more.</b></br>
  <i>Specially designed to be 100% responsive for Corsair Xeneon Edge & iCUE.</i>
</p>

---

## ✨ Features

- **No external dependencies:** Pure HTML, CSS, and vanilla JavaScript bundled in single files.
- **Fully Responsive:** Automatically scales to fit any container size (`M`, `L`, `XL`).
- **Plug & Play:** Just copy the code and paste it.
- **Dark OLED / Light Mode** with a toggle on each widget.
- **EN / FR** bilingual support on all widgets.

---

## 🗂️ Available Widgets

| Widget | GitHub Pages URL |
|---|---|
| 💧 Hydration | `https://stealthylabshq.github.io/iframe-edge/productivity/hydration/` |
| 🍅 Pomodoro | `https://stealthylabshq.github.io/iframe-edge/productivity/pomodoro/` |
| 📝 Quick Notes | `https://stealthylabshq.github.io/iframe-edge/productivity/notes/` |
| 🎯 Daily Focus | `https://stealthylabshq.github.io/iframe-edge/productivity/daily-focus/` |
| ✅ Habit Tracker | `https://stealthylabshq.github.io/iframe-edge/productivity/habit-tracker/` |
| 🧘 Posture & Blink | `https://stealthylabshq.github.io/iframe-edge/productivity/posture-reminder/` |
| 📋 Quick Clipboard | `https://stealthylabshq.github.io/iframe-edge/productivity/quick-clipboard/` |
| 🎵 Spotify Visualizer | `https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/` |


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
5. Choose a URL from the table above and wrap it in an `<iframe>` tag like this, then **paste it** into the text area:
   ```html
   <iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>
   ```

> **🎉 Done!** The widget will load live from GitHub Pages.

### 🎵 Spotify Visualizer

**Prerequisites:**
- A **Spotify Premium** account.

**Setup Instructions:**
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click on **Create app**.
3. Fill in the app name and description.
4. For the **Redirect URL**, add exactly: 
   `https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/auth/callback.html`
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
5. Prenez l'URL de votre choix dans le tableau ci-dessus et insérez-la dans une balise `<iframe>` comme ceci, puis **collez** le tout dans la zone HTML de iCUE :
   ```html
   <iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>
   ```

> **🎉 Et voilà !** Le widget se chargera directement depuis GitHub Pages.

### 🎵 Spotify Visualizer

**Prérequis :**
- Avoir un compte **Spotify Premium**.

**Comment l'installer :**
1. Allez sur le site des développeurs Spotify avec [ce lien](https://developer.spotify.com/dashboard) et connectez-vous.
2. Cliquez sur **Create app** (Créer une application).
3. Remplissez le nom et la description de l'application.
4. Ajouter en tant que **Redirect URL** exactement : 
   `https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/auth/callback.html`
5. Et cochez la case **Web API**.
6. Enregistrez et récupérez votre **Client ID**.

**Comment l'utiliser :**
1. Ajoutez le widget dans iCUE comme décrit plus haut avec son URL.
2. Au chargement du widget, entrez votre **Client ID** pour vous connecter.
3. Autorisez l'accès à votre compte et profitez de la musique !

---
