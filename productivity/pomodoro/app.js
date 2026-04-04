(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  /* ── Toast ──────────────────────────────────────────────── */
  function showToast(msg, duration = 3000) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("visible"), duration);
  }

  /* ── Theme ──────────────────────────────────────────────── */
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

  /* ── Language ───────────────────────────────────────────── */
  const LANG_KEY = "pa_lang";
  let currentLang = localStorage.getItem(LANG_KEY) || "en";

  const i18n = {
    fr: {
      focus:          "Focus",
      pause:          "Pause",
      focusSub:       "focus",
      pauseSub:       "pause",
      btnStart:       "Start",
      btnResume:      "Reprendre",
      btnPause:       "Pause",
      toastFocusEnd:  "🍅 Focus terminé ! Pause 5 min.",
      toastCycleEnd:  "🎉 Cycle complet ! 4 pomodoros terminés.",
      toastNextFocus: "💪 C'est reparti ! Nouveau focus.",
      ariaReset:      "Réinitialiser",
      ariaStart:      "Démarrer",
      ariaSkip:       "Passer la phase",
      statSession:    "Séance",
      statFocused:    "Focalisé",
      statDone:       "Faits",
    },
    en: {
      focus:          "Focus",
      pause:          "Break",
      focusSub:       "focus",
      pauseSub:       "break",
      btnStart:       "Start",
      btnResume:      "Resume",
      btnPause:       "Pause",
      toastFocusEnd:  "🍅 Focus complete! 5 min break.",
      toastCycleEnd:  "🎉 Cycle complete! 4 pomodoros done.",
      toastNextFocus: "💪 Here we go! New focus session.",
      ariaReset:      "Reset",
      ariaStart:      "Start",
      ariaSkip:       "Skip phase",
      statSession:    "Session",
      statFocused:    "Focused",
      statDone:       "Done",
    },
  };

  const t = (key) => i18n[currentLang][key];

  function updateLangUI() {
    $("langToggle").textContent = currentLang.toUpperCase();
    $("t-title").textContent = "POMODORO";
    $("resetBtn").setAttribute("aria-label", t("ariaReset"));
    $("startBtn").setAttribute("aria-label", t("ariaStart"));
    $("skipBtn").setAttribute("aria-label", t("ariaSkip"));
    /* Update stat labels */
    const labels = document.querySelectorAll(".stat-label");
    const keys = ["statSession", "statFocused", "statDone"];
    labels.forEach((el, i) => { if (keys[i]) el.textContent = t(keys[i]); });
    renderPhase();
  }

  $("langToggle").addEventListener("click", () => {
    currentLang = currentLang === "fr" ? "en" : "fr";
    localStorage.setItem(LANG_KEY, currentLang);
    updateLangUI();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY) { currentTheme = e.newValue; updateThemeUI(); }
    if (e.key === LANG_KEY)  { currentLang  = e.newValue; updateLangUI(); }
  });

  /* ── Timer State ────────────────────────────────────────── */
  const FOCUS_S  = 25 * 60;
  const BREAK_S  =  5 * 60;
  const CIRC     = 2 * Math.PI * 42; /* 263.89 */
  const ICON_PLAY  = "M5 3 19 12 5 21 5 3";
  const ICON_PAUSE = "M6 4h4v16H6zM14 4h4v16h-4z";

  let timer = {
    interval:   null,
    timeLeft:   FOCUS_S,
    totalTime:  FOCUS_S,
    running:    false,
    isBreak:    false,
    sessions:   0,           /* completed focus sessions */
  };

  /* Total focused seconds — accumulates while timer runs in focus mode */
  let totalFocusSecs = 0;

  /* ── DOM refs ───────────────────────────────────────────── */
  const widget      = $("widget");
  const phaseBadge  = $("phaseBadge");
  const phaseLabel  = $("phaseLabel");
  const ringProgress = $("ringProgress");
  const timerDigits = $("timerDigits");
  const timerSub    = $("timerSub");
  const startLabel  = $("startLabel");
  const startIcon   = $("startIcon");
  const mFill       = $("mProgressFill"); /* may be null if not in DOM */
  const statSession = $("statSession");
  const statFocused = $("statFocused");
  const statDone    = $("statDone");

  /* ── Helpers ────────────────────────────────────────────── */
  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function formatDuration(secs) {
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  /* ── Render Functions ───────────────────────────────────── */
  function renderTimer() {
    timerDigits.textContent = formatTime(timer.timeLeft);

    /* Ring arc — stroke decreases as time passes (remaining indicator) */
    const offset = CIRC * (1 - timer.timeLeft / timer.totalTime);
    ringProgress.style.strokeDashoffset = offset;

    /* M progress bar — fills as time passes (elapsed indicator) */
    if (mFill) {
      const pct = timer.totalTime > 0
        ? ((timer.totalTime - timer.timeLeft) / timer.totalTime) * 100
        : 0;
      mFill.style.width = `${pct}%`;
    }

    renderStats();
  }

  function renderPhase() {
    const isBreak = timer.isBreak;

    /* Phase badge class */
    phaseBadge.className = `phase-badge ${isBreak ? "pause" : "focus"}`;
    phaseLabel.textContent = isBreak ? t("pause") : t("focus");

    /* Ring progress color */
    ringProgress.classList.toggle("is-break", isBreak);

    /* Sub-label */
    timerSub.textContent = isBreak ? t("pauseSub") : t("focusSub");

    /* Widget accent line & border color */
    widget.classList.toggle("is-break", isBreak);
  }

  function renderSessionDots() {
    document.querySelectorAll(".s-dot").forEach((dot, i) => {
      dot.classList.toggle("done", i < timer.sessions);
    });
  }

  function renderStats() {
    if (statSession) {
      const current = Math.min(
        timer.sessions + (timer.isBreak ? 0 : 1),
        4
      );
      statSession.textContent = `${current} / 4`;
    }
    if (statFocused) {
      statFocused.textContent = formatDuration(totalFocusSecs);
    }
    if (statDone) {
      statDone.textContent = String(timer.sessions);
    }
  }

  function setRunningUI(running) {
    if (running) {
      startLabel.textContent = t("btnPause");
      startIcon.setAttribute("d", ICON_PAUSE);
      widget.classList.add("is-running");
      document.body.classList.add("is-running");
      $("startBtn").classList.add("is-running");
    } else {
      startLabel.textContent =
        timer.timeLeft < timer.totalTime ? t("btnResume") : t("btnStart");
      startIcon.setAttribute("d", ICON_PLAY);
      widget.classList.remove("is-running");
      document.body.classList.remove("is-running");
      $("startBtn").classList.remove("is-running");
    }
  }

  /* ── Timer Logic ────────────────────────────────────────── */
  function handlePhaseEnd() {
    clearInterval(timer.interval);
    timer.interval = null;
    timer.running  = false;

    if (!timer.isBreak) {
      timer.sessions  = Math.min(timer.sessions + 1, 4);
      renderSessionDots();
      timer.isBreak   = true;
      timer.totalTime = BREAK_S;
      timer.timeLeft  = BREAK_S;
      renderPhase();
      showToast(t("toastFocusEnd"));
    } else {
      timer.isBreak   = false;
      timer.totalTime = FOCUS_S;
      timer.timeLeft  = FOCUS_S;
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
      timer.running  = false;
      setRunningUI(false);
    } else {
      timer.running  = true;
      setRunningUI(true);
      timer.interval = setInterval(() => {
        timer.timeLeft--;
        /* Accumulate focused time (not during break) */
        if (!timer.isBreak) totalFocusSecs++;
        renderTimer();
        if (timer.timeLeft <= 0) handlePhaseEnd();
      }, 1000);
    }
  }

  function resetTimer() {
    clearInterval(timer.interval);
    timer.interval   = null;
    timer.running    = false;
    timer.isBreak    = false;
    timer.timeLeft   = FOCUS_S;
    timer.totalTime  = FOCUS_S;
    totalFocusSecs   = 0;
    renderPhase();
    renderTimer();
    renderSessionDots();
    setRunningUI(false);
  }

  function skipPhase() {
    clearInterval(timer.interval);
    timer.interval = null;
    timer.running  = false;
    timer.timeLeft = 0;
    handlePhaseEnd();
  }

  /* ── Event Listeners ────────────────────────────────────── */
  $("startBtn").addEventListener("click", toggleTimer);
  $("resetBtn").addEventListener("click", resetTimer);
  $("skipBtn").addEventListener("click",  skipPhase);

  /* ── Init ───────────────────────────────────────────────── */
  renderTimer();
  renderPhase();
  renderSessionDots();
  updateLangUI();
})();
