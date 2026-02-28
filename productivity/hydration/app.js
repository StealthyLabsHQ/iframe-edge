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
        function today() {
          return new Date().toISOString().split("T")[0];
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
            title: "Hydratation",
            meta: "/ 8 verres · 2 L",
            start: "Commencez à vous hydrater !",
            left: (n) =>
              `Plus que ${n} verre${n > 1 ? "s" : ""} pour l'objectif`,
            goal: "🎉 Objectif journalier atteint !",
            addBtn: "+1 verre",
            toastGoal: "💧 Bravo ! Objectif hydratation atteint !",
            toastAlready: "✅ Objectif déjà atteint pour aujourd'hui !",
            toastReset: "🌅 Nouveau jour ! Compteur d'eau réinitialisé.",
          },
          en: {
            title: "Hydration",
            meta: "/ 8 glasses · 2 L",
            start: "Start hydrating!",
            left: (n) => `${n} glass${n > 1 ? "es" : ""} left for your goal`,
            goal: "🎉 Daily goal reached!",
            addBtn: "+1 glass",
            toastGoal: "💧 Great job! Hydration goal reached!",
            toastAlready: "✅ Goal already reached for today!",
            toastReset: "🌅 New day! Water counter reset.",
          },
        };

        function t(key, arg) {
          const val = i18n[currentLang][key];
          return typeof val === "function" ? val(arg) : val;
        }

        function updateLangUI() {
          $("langToggle").textContent = currentLang.toUpperCase();
          $("t-title").textContent = t("title");
          $("t-meta").textContent = t("meta");
          $("t-add").textContent = t("addBtn");
          renderWater();
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

        const WATER_KEY = "pa_waterCount";
        const WATER_DATE_KEY = "pa_waterDate";
        const WATER_GOAL = 8;
        function loadWater() {
          const savedDate = localStorage.getItem(WATER_DATE_KEY);
          if (savedDate !== today()) {
            localStorage.setItem(WATER_DATE_KEY, today());
            localStorage.setItem(WATER_KEY, "0");
            return 0;
          }
          return parseInt(localStorage.getItem(WATER_KEY) || "0", 10);
        }
        function saveWater(count) {
          localStorage.setItem(WATER_KEY, String(count));
          localStorage.setItem(WATER_DATE_KEY, today());
        }
        let waterCount = loadWater();
        function buildGlassGrid() {
          const grid = $("glassGrid");
          grid.replaceChildren();
          for (let i = 0; i < WATER_GOAL; i++) {
            const cell = document.createElement("div");
            cell.className = "glass-cell" + (i < waterCount ? " filled" : "");
            cell.textContent = i < waterCount ? "💧" : "○";
            cell.style.fontSize = i < waterCount ? "18px" : "16px";
            cell.style.color = i < waterCount ? "" : "var(--text-3)";
            grid.appendChild(cell);
          }
        }
        function renderWater() {
          const numEl = $("waterNum");
          numEl.textContent = waterCount;
          numEl.classList.add("bump");
          setTimeout(() => numEl.classList.remove("bump"), 300);
          buildGlassGrid();
          const status = $("waterStatus");
          const remaining = WATER_GOAL - waterCount;
          if (waterCount === 0) {
            status.textContent = t("start");
            status.className = "water-status";
          } else if (remaining > 0) {
            status.textContent = t("left", remaining);
            status.className = "water-status";
          } else {
            status.textContent = t("goal");
            status.className = "water-status complete";
          }
        }
        $("waterPlus").addEventListener("click", () => {
          if (waterCount < WATER_GOAL) {
            waterCount++;
            saveWater(waterCount);
            renderWater();
            if (waterCount === WATER_GOAL) showToast(t("toastGoal"));
          } else {
            showToast(t("toastAlready"));
          }
        });
        $("waterMinus").addEventListener("click", () => {
          if (waterCount > 0) {
            waterCount--;
            saveWater(waterCount);
            renderWater();
          }
        });
        setInterval(() => {
          const saved = localStorage.getItem(WATER_DATE_KEY);
          if (saved && saved !== today()) {
            waterCount = 0;
            saveWater(0);
            renderWater();
            showToast(t("toastReset"));
          }
        }, 60_000);
        updateLangUI();
      })();
    
