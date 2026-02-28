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

        const LANG_KEY = "pa_lang";
        let currentLang = localStorage.getItem(LANG_KEY) || "fr";

        const i18n = {
          fr: {
            title: "Focus Quotidien",
            placeholder: "UN OBJECTIF AUJOURD'HUI",
            saved: "Sauvegardé",
          },
          en: {
            title: "Daily Focus",
            placeholder: "ONE GOAL TODAY",
            saved: "Saved",
          },
        };

        function t(key) {
          return i18n[currentLang][key];
        }

        function updateLangUI() {
          $("langToggle").textContent = currentLang.toUpperCase();
          $("t-title").textContent = t("title");
          $("focusInput").placeholder = t("placeholder");
          $("t-saved").textContent = t("saved");
        }

        $("langToggle").addEventListener("click", () => {
          currentLang = currentLang === "fr" ? "en" : "fr";
          localStorage.setItem(LANG_KEY, currentLang);
          updateLangUI();
        });

        window.addEventListener("storage", (e) => {
          if (e.key === THEME_KEY) {
            currentTheme = e.newValue;
            updateThemeUI();
          }
          if (e.key === LANG_KEY) {
            currentLang = e.newValue;
            updateLangUI();
          }
        });

        const FOCUS_KEY = "pa_dailyFocus";
        let saveTimer = null;
        const focusInput = $("focusInput");
        const saveBadge = $("saveBadge");

        function flashSaved() {
          saveBadge.classList.add("show");
          clearTimeout(saveBadge._t);
          saveBadge._t = setTimeout(
            () => saveBadge.classList.remove("show"),
            2200,
          );
        }

        focusInput.value = localStorage.getItem(FOCUS_KEY) || "";

        focusInput.addEventListener("input", () => {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            localStorage.setItem(FOCUS_KEY, focusInput.value);
            flashSaved();
          }, 600);
        });

        // Setup UI
        updateThemeUI();
        updateLangUI();
      })();
    
