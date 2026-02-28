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

### 🚀 Method 1 — Direct iFrame (Recommended)

> ✅ **Easiest method.** Requires an internet connection for the widget to load.

1. Open **iCUE** and go to your screen/dashboard configuration.
2. In the **Widgets** list (left column), click on the **`</> iFrame`** icon.
3. Choose your desired size: **`M`**, **`L`**, or **`XL`**.
4. In the iFrame settings, look for the **HTML code** text area.
5. Choose a URL from the table above and wrap it in an `<iframe>` tag like this, then **paste it** into the text area:
   ```html
   <iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>
   ```

> **🎉 Done!** The widget will load live from GitHub Pages.

---

## 🇫🇷 Documentation en Français

### 📋 Prérequis

Pour utiliser ces widgets sur votre installation Corsair, vous aurez besoin de :

- Un écran **Corsair Xeneon Edge**.
- Le logiciel **[Corsair iCUE](https://www.corsair.com/icue)** installé et à jour sur votre machine.

### 🚀 Méthode 1 — iFrame Direct (Recommandée)

> ✅ **La méthode la plus simple.** Nécessite une connexion internet pour charger le widget.

1. Ouvrez **iCUE** et allez dans la configuration de votre écran.
2. Dans la liste des **Widgets** (colonne gauche), cliquez sur l'icône **`</> iFrame`**.
3. Choisissez la taille souhaitée : **`M`**, **`L`**, ou **`XL`**.
4. Dans les réglages de l'iFrame, cherchez le champ de texte principal **code HTML**.
5. Prenez l'URL de votre choix dans le tableau ci-dessus et insérez-la dans une balise `<iframe>` comme ceci, puis **collez** le tout dans la zone HTML de iCUE :
   ```html
   <iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>
   ```

> **🎉 Et voilà !** Le widget se chargera directement depuis GitHub Pages.

---

### 🛠️ Méthode 2 — Copier-coller le code HTML

> ✅ **Fonctionne hors-ligne.** Aucune connexion internet nécessaire.

1. Ouvrez **iCUE** et allez dans la configuration de votre écran.
2. Dans la liste des **Widgets** (colonne gauche), cliquez sur l'icône **`</> iFrame`**.
3. Choisissez la taille souhaitée : **`M`**, **`L`**, ou **`XL`**.
4. Ouvrez un des fichiers HTML de ce dépôt (par exemple `productivity/pomodoro/pomodoro.html`) dans un éditeur de texte (Bloc-notes, VS Code, etc.).
5. **Sélectionnez tout** (`Ctrl+A`) et **copiez** (`Ctrl+C`) l'intégralité du code.
6. Dans iCUE, **collez** ce code dans la zone de texte **code HTML** sous les réglages "iFrame".

> **🎉 Et voilà !** Le widget apparaîtra instantanément sur votre écran sans connexion internet.

---

*Developed with ❤️ for the community. / Développé avec ❤️ pour la communauté.*
