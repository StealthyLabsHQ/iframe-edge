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
            focus: "Focus",
            pause: "Pause",
            focusSub: "focus",
            pauseSub: "pause",
            btnStart: "Start",
            btnResume: "Reprendre",
            btnPause: "Pause",
            toastFocusEnd: "🍅 Focus terminé ! Pause 5 min.",
            toastCycleEnd: "🎉 Cycle complet ! 4 pomodoros terminés.",
            toastNextFocus: "💪 C'est reparti ! Nouveau focus.",
            ariaReset: "Réinitialiser",
            ariaStart: "Démarrer",
            ariaSkip: "Passer la phase",
          },
          en: {
            focus: "Focus",
            pause: "Break",
            focusSub: "focus",
            pauseSub: "break",
            btnStart: "Start",
            btnResume: "Resume",
            btnPause: "Pause",
            toastFocusEnd: "🍅 Focus complete! 5 min break.",
            toastCycleEnd: "🎉 Cycle complete! 4 pomodoros finished.",
            toastNextFocus: "💪 Here we go again! New focus.",
            ariaReset: "Reset",
            ariaStart: "Start",
            ariaSkip: "Skip phase",
          },
        };

        function t(key) {
          return i18n[currentLang][key];
        }

        function updateLangUI() {
          $("langToggle").textContent = currentLang.toUpperCase();
          $("t-title").textContent = "POMODORO";
          $("resetBtn").setAttribute("aria-label", t("ariaReset"));
          $("startBtn").setAttribute("aria-label", t("ariaStart"));
          $("skipBtn").setAttribute("aria-label", t("ariaSkip"));
          renderPhase(); // re-render running texts
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

        const FOCUS_S = 25 * 60;
        const BREAK_S = 5 * 60;
        const CIRC = 2 * Math.PI * 42; /* 263.89 */
        const ICON_PLAY = "M5 3 19 12 5 21 5 3";
        const ICON_PAUSE = "M6 4h4v16H6zM14 4h4v16h-4z";
        let timer = {
          interval: null,
          timeLeft: FOCUS_S,
          totalTime: FOCUS_S,
          running: false,
          isBreak: false,
          sessions: 0,
        };
        const widget = $("widget");
        const phaseBadge = $("phaseBadge");
        const phaseLabel = $("phaseLabel");
        const ringProgress = $("ringProgress");
        const timerDigits = $("timerDigits");
        const timerSub = $("timerSub");
        const startLabel = $("startLabel");
        const startIcon = $("startIcon");

        function formatTime(s) {
          return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        }
        function renderTimer() {
          timerDigits.textContent = formatTime(timer.timeLeft);
          const offset = CIRC * (1 - timer.timeLeft / timer.totalTime);
          ringProgress.style.strokeDashoffset = offset;
        }
        function renderPhase() {
          if (timer.isBreak) {
            phaseBadge.className = "phase-badge pause";
            phaseLabel.textContent = t("pause");
            ringProgress.classList.add("is-break");
            timerSub.textContent = t("pauseSub");
          } else {
            phaseBadge.className = "phase-badge focus";
            phaseLabel.textContent = t("focus");
            ringProgress.classList.remove("is-break");
            timerSub.textContent = t("focusSub");
          }
        }
        function renderSessionDots() {
          document.querySelectorAll(".s-dot").forEach((dot, i) => {
            dot.classList.toggle("done", i < timer.sessions);
          });
        }
        function setRunningUI(running) {
          if (running) {
            startLabel.textContent = t("btnPause");
            startIcon.setAttribute("d", ICON_PAUSE);
            widget.classList.add("is-running");
            document.body.classList.add("is-running");
          } else {
            startLabel.textContent =
              timer.timeLeft < timer.totalTime ? t("btnResume") : t("btnStart");
            startIcon.setAttribute("d", ICON_PLAY);
            widget.classList.remove("is-running");
            document.body.classList.remove("is-running");
          }
        }
        function handlePhaseEnd() {
          clearInterval(timer.interval);
          timer.interval = null;
          timer.running = false;
          if (!timer.isBreak) {
            timer.sessions = Math.min(timer.sessions + 1, 4);
            renderSessionDots();
            timer.isBreak = true;
            timer.totalTime = BREAK_S;
            timer.timeLeft = BREAK_S;
            renderPhase();
            showToast(t("toastFocusEnd"));
          } else {
            timer.isBreak = false;
            timer.totalTime = FOCUS_S;
            timer.timeLeft = FOCUS_S;
            if (timer.sessions >= 4) {
              timer.sessions = 0;
              renderSessionDots();
              showToast(t("toastCycleEnd"));
            } else {
              showToast(t("toastNextFocus"));
            }
            renderPhase();
          }
          renderTimer();
          setRunningUI(false);
        }
        function toggleTimer() {
          if (timer.running) {
            clearInterval(timer.interval);
            timer.interval = null;
            timer.running = false;
            setRunningUI(false);
          } else {
            timer.running = true;
            setRunningUI(true);
            timer.interval = setInterval(() => {
              timer.timeLeft--;
              renderTimer();
              if (timer.timeLeft <= 0) handlePhaseEnd();
            }, 1000);
          }
        }
        function resetTimer() {
          clearInterval(timer.interval);
          timer.interval = null;
          timer.running = false;
          timer.isBreak = false;
          timer.timeLeft = FOCUS_S;
          timer.totalTime = FOCUS_S;
          renderPhase();
          renderTimer();
          setRunningUI(false);
        }
        function skipPhase() {
          clearInterval(timer.interval);
          timer.interval = null;
          timer.running = false;
          timer.timeLeft = 0;
          handlePhaseEnd();
        }
        $("startBtn").addEventListener("click", toggleTimer);
        $("resetBtn").addEventListener("click", resetTimer);
        $("skipBtn").addEventListener("click", skipPhase);

        renderTimer();
        renderPhase();
        renderSessionDots();
      })();
    
