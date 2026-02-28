      (() => {
        "use strict";
        const $ = (id) => document.getElementById(id);

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
            title: "Santé",
            working: "Concentre-toi. Prochain rappel dans 20m.",
            alertTime: "Il est temps !",
            alertMsg:
              "Tiens-toi droit. Regarde au loin (6m) pendant 20s. Cligne des yeux.",
            btnReset: "Réinitialiser",
            btnDone: "Fait ! Reprendre",
          },
          en: {
            title: "Care",
            working: "Focusing. Next friendly reminder in 20m.",
            alertTime: "Time's up!",
            alertMsg:
              "Sit up straight. Look 20ft away for 20s. Blink your eyes.",
            btnReset: "Reset",
            btnDone: "Done! Resume",
          },
        };

        function t(key) {
          return i18n[currentLang][key];
        }

        const INTERVAL_S = 20 * 60; // 20 minutes
        let timeLeft = INTERVAL_S;
        let isAlert = false;
        let timer = null;

        function updateLangUI() {
          $("langToggle").textContent = currentLang.toUpperCase();
          $("t-title").textContent = t("title");

          if (isAlert) {
            $("msgArea").textContent = t("alertMsg");
            $("actionBtn").textContent = t("btnDone");
          } else {
            $("msgArea").textContent = t("working");
            $("actionBtn").textContent = t("btnReset");
          }
        }

        function formatTime(s) {
          if (isAlert) return "00:00";
          return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        }

        function renderTimer() {
          $("timeDisplay").textContent = formatTime(timeLeft);
        }

        function triggerAlert() {
          isAlert = true;
          $("widget").classList.add("alert-mode");
          updateLangUI();
        }

        function resetTimer() {
          isAlert = false;
          timeLeft = INTERVAL_S;
          $("widget").classList.remove("alert-mode");
          updateLangUI();
          renderTimer();
        }

        $("actionBtn").addEventListener("click", () => {
          resetTimer();
        });

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

        // Initialize Loop
        timer = setInterval(() => {
          if (!isAlert) {
            timeLeft--;
            renderTimer();
            if (timeLeft <= 0) {
              triggerAlert();
            }
          }
        }, 1000);

        updateThemeUI();
        updateLangUI();
        renderTimer();
      })();
    
