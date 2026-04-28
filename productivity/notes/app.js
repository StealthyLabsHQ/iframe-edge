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

        updateThemeUI();
        const currentLang = "en";

        const i18n = {
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
          $("t-title").textContent = t("title");
          $("notesArea").placeholder = t("placeholder");
          $("t-saved").textContent = t("saved");
          $("t-clear").textContent = t("clearBtn");
          updateCharCount();
        }

        window.addEventListener("storage", (e) => {
          if (e.key === THEME_KEY) {
            currentTheme = e.newValue;
            updateThemeUI();
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
    
