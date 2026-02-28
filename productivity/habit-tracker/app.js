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

        const LANG_KEY = "pa_lang";
        let currentLang = localStorage.getItem(LANG_KEY) || "fr";

        const i18n = {
          fr: {
            title: "Habitudes",
            placeholders: [
              "Ex: Lire 10 pages...",
              "Ex: Sport 30mn...",
              "Ex: Méditation...",
              "Ex: Vitamines...",
            ],
            toastReset: "🌅 Nouveau jour ! Habitudes réinitialisées.",
            toastAllDone: "🎉 Toutes les habitudes sont complétées !",
          },
          en: {
            title: "Habit Tracker",
            placeholders: [
              "e.g., Read 10 pages...",
              "e.g., Workout 30m...",
              "e.g., Meditate...",
              "e.g., Take vitamins...",
            ],
            toastReset: "🌅 New day! Habits reset.",
            toastAllDone: "🎉 All habits complete!",
          },
        };

        function t(key) {
          return i18n[currentLang][key];
        }

        function updateLangUI() {
          $("langToggle").textContent = currentLang.toUpperCase();
          $("t-title").textContent = t("title");

          const inputs = document.querySelectorAll(".h-input");
          const placeholders = t("placeholders");
          inputs.forEach((inp, idx) => {
            inp.placeholder = placeholders[idx] || "";
          });
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

        const HABITS_KEY = "pa_habitsData";
        const HABITS_DATE_KEY = "pa_habitsDate";

        let habits = [];

        function loadHabits() {
          try {
            habits = JSON.parse(localStorage.getItem(HABITS_KEY)) || [
              { text: "", done: false },
              { text: "", done: false },
              { text: "", done: false },
              { text: "", done: false },
            ];
          } catch (e) {
            habits = [
              { text: "", done: false },
              { text: "", done: false },
              { text: "", done: false },
              { text: "", done: false },
            ];
          }

          const savedDate = localStorage.getItem(HABITS_DATE_KEY);
          if (savedDate && savedDate !== today()) {
            habits.forEach((h) => (h.done = false));
            localStorage.setItem(HABITS_DATE_KEY, today());
            saveHabits();
            showToast(t("toastReset"));
          } else if (!savedDate) {
            localStorage.setItem(HABITS_DATE_KEY, today());
          }
        }

        function saveHabits() {
          localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
        }

        function renderHabits() {
          const list = $("habitList");
          list.replaceChildren();
          const placeholders = t("placeholders");

          habits.forEach((h, i) => {
            const item = document.createElement("div");
            item.className = "habit-item" + (h.done ? " checked" : "");

            const btn = document.createElement("div");
            btn.className = "h-checkbox";
            btn.textContent = "✓";

            const inp = document.createElement("input");
            inp.type = "text";
            inp.className = "h-input";
            inp.value = h.text;
            inp.placeholder = placeholders[i] || "";

            inp.addEventListener("input", (e) => {
              habits[i].text = e.target.value;
              saveHabits();
            });

            btn.addEventListener("click", () => {
              habits[i].done = !habits[i].done;
              saveHabits();
              renderHabits();

              // check if all done
              if (habits[i].done) {
                const allDone = habits
                  .filter((h) => h.text.trim().length > 0)
                  .every((h) => h.done);
                const hasText = habits.some((h) => h.text.trim().length > 0);
                if (allDone && hasText) {
                  showToast(t("toastAllDone"));
                }
              }
            });

            item.appendChild(btn);
            item.appendChild(inp);
            list.appendChild(item);
          });
        }

        setInterval(() => {
          const saved = localStorage.getItem(HABITS_DATE_KEY);
          if (saved && saved !== today()) {
            loadHabits();
            renderHabits();
          }
        }, 60_000);

        // Init
        loadHabits();
        updateThemeUI();
        renderHabits(); // rendering uses translation for placeholders
        updateLangUI(); // calls update text again
      })();
    
