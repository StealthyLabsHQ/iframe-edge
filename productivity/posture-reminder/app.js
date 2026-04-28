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
        const currentLang = "en";

        const i18n = {
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

        function showToast(msg, duration = 3000) {
          const el = $("toast");
          if (!el) return;
          el.textContent = msg;
          el.classList.add("visible");
          clearTimeout(el._t);
          el._t = setTimeout(() => el.classList.remove("visible"), duration);
        }

        const INTERVAL_S = 20 * 60; // 20 minutes
        let timeLeft = INTERVAL_S;
        let isAlert = false;
        let timer = null;

        function updateLangUI() {
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

        function startTimer() {
          clearInterval(timer);
          timer = setInterval(() => {
            if (!isAlert) {
              timeLeft--;
              renderTimer();
              if (timeLeft <= 0) {
                triggerAlert();
              }
            }
          }, 1000);
        }

        function resetTimer() {
          isAlert = false;
          timeLeft = INTERVAL_S;
          $("widget").classList.remove("alert-mode");
          updateLangUI();
          renderTimer();
          startTimer();
        }

        $("actionBtn").addEventListener("click", () => {
          resetTimer();
        });

        window.addEventListener("storage", (e) => {
          if (e.key === THEME_KEY) {
            currentTheme = e.newValue;
            updateThemeUI();
          }
        });

        // Initialize Loop
        startTimer();

        updateThemeUI();
        updateLangUI();
        renderTimer();
      })();
    
