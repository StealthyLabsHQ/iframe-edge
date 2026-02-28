      (() => {
        "use strict";
        const $ = (id) => document.getElementById(id);
        function showToast(msg, duration = 3000) {
          const el = $("toast");
          el.textContent = msg;
          el.classList.add("visible");
          clearTimeout(el._t);
          el._t = setTimeout(() => el.classList.remove("visible"), duration);
        }

        const THEME_KEY = "pa_theme";
        let currentTheme = localStorage.getItem(THEME_KEY) || "dark";

        function updateThemeUI() {
          $("themeToggle").textContent = currentTheme === "dark" ? "🌙" : "☀️";
          document.documentElement.setAttribute("data-theme", currentTheme);
        }

        $("themeToggle").addEventListener("click", () => {
          currentTheme = currentTheme === "dark" ? "light" : "dark";
          localStorage.setItem(THEME_KEY, currentTheme);
          updateThemeUI();
        });

        window.addEventListener("storage", (e) => {
          if (e.key === THEME_KEY) {
            currentTheme = e.newValue;
            updateThemeUI();
          }
        });

        updateThemeUI();

        const LANG_KEY = "pa_lang";
        let currentLang = localStorage.getItem(LANG_KEY) || "fr";

        const i18n = {
          fr: {
            title: "Notes Rapides",
            placeholder:
              "Vos idées, tâches, pensées... Sauvegarde automatique.",
            char: (n) => `${n} caractère${n !== 1 ? "s" : ""}`,
            saved: "Sauvegardé",
            clearBtn: "Effacer",
            confirm: "Effacer toutes les notes ?",
            toastClear: "🗑️ Notes effacées.",
          },
          en: {
            title: "Quick Notes",
            placeholder: "Your ideas, tasks, thoughts... Auto-saving.",
            char: (n) => `${n} character${n !== 1 ? "s" : ""}`,
            saved: "Saved",
            clearBtn: "Clear",
            confirm: "Clear all notes?",
            toastClear: "🗑️ Notes cleared.",
          },
        };

        function t(key, arg) {
          const val = i18n[currentLang][key];
          return typeof val === "function" ? val(arg) : val;
        }

        function updateLangUI() {
          $("langToggle").textContent = currentLang.toUpperCase();
          $("t-title").textContent = t("title");
          $("notesArea").placeholder = t("placeholder");
          $("t-saved").textContent = t("saved");
          $("t-clear").textContent = t("clearBtn");
          updateCharCount();
        }

        $("langToggle").addEventListener("click", () => {
          currentLang = currentLang === "fr" ? "en" : "fr";
          localStorage.setItem(LANG_KEY, currentLang);
          updateLangUI();
        });

        window.addEventListener("storage", (e) => {
          if (e.key === LANG_KEY) {
            currentLang = e.newValue;
            updateLangUI();
          }
        });

        const NOTES_KEY = "pa_quickNotes";
        let saveTimer = null;
        const notesArea = $("notesArea");
        const charCount = $("charCount");
        const saveBadge = $("saveBadge");
        function loadNotes() {
          notesArea.value = localStorage.getItem(NOTES_KEY) || "";
          updateCharCount();
        }
        function updateCharCount() {
          const n = notesArea.value.length;
          charCount.textContent = t("char", n);
        }
        function flashSaved() {
          saveBadge.classList.add("show");
          clearTimeout(saveBadge._t);
          saveBadge._t = setTimeout(
            () => saveBadge.classList.remove("show"),
            2200,
          );
        }
        notesArea.addEventListener("input", () => {
          updateCharCount();
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            localStorage.setItem(NOTES_KEY, notesArea.value);
            flashSaved();
          }, 500);
        });
        $("clearBtn").addEventListener("click", () => {
          if (!notesArea.value) return;
          if (window.confirm(t("confirm"))) {
            notesArea.value = "";
            localStorage.removeItem(NOTES_KEY);
            updateCharCount();
            showToast(t("toastClear"));
          }
        });
        loadNotes();
        updateLangUI();
      })();
    
