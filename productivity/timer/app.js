(() => {
  "use strict";

  // ── Utils ────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  function showToast(msg, duration = 3000) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("visible"), duration);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Parses user input to seconds:
  //   "1h30" | "1h30m" | "25m" | "90s" | "90" (→ min) | "25:00" | "1:30:00"
  function parseTime(str) {
    if (!str) return null;
    str = str.trim().toLowerCase().replace(/\s+/g, "");
    if (!str) return null;

    if (str.includes(":")) {
      const parts = str.split(":").map(Number);
      if (parts.some(isNaN) || parts.some((n) => n < 0)) return null;
      if (parts.length === 3) {
        const s = parts[0] * 3600 + parts[1] * 60 + parts[2];
        return s > 0 ? s : null;
      }
      if (parts.length === 2) {
        const s = parts[0] * 60 + parts[1];
        return s > 0 ? s : null;
      }
      return null;
    }

    let total = 0;
    let matched = false;
    const h = str.match(/(\d+)h/);
    const m = str.match(/(\d+)m(?!s)/);
    const s = str.match(/(\d+)s/);
    if (h) { total += parseInt(h[1]) * 3600; matched = true; }
    if (m) { total += parseInt(m[1]) * 60; matched = true; }
    if (s) { total += parseInt(s[1]); matched = true; }
    if (matched) return total > 0 ? total : null;

    const num = parseInt(str);
    if (!isNaN(num) && num > 0) return num * 60;
    return null;
  }

  function formatTime(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // For edit input pre-fill: "30m", "1h30m", "1h30m20s"
  function formatDurationShort(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    let out = "";
    if (h > 0) out += `${h}h`;
    if (m > 0) out += `${m}m`;
    if (sec > 0) out += `${sec}s`;
    return out || "0m";
  }

  // ── Constants ────────────────────────────────────────────────────────────
  const STORAGE_KEY = "timer_v1";
  const CIRC = 2 * Math.PI * 42; // 263.89
  const ICON_PLAY  = "M5 3 19 12 5 21z";
  const ICON_PAUSE = "M6 4h4v16H6zM14 4h4v16h-4z";

  const PHASE_COLORS = [
    { hex: "#ff6b6b", rgb: "255,107,107" },   // 0 red
    { hex: "#f4a261", rgb: "244,162,97"  },   // 1 orange
    { hex: "#4ecdc4", rgb: "78,205,196"  },   // 2 teal
    { hex: "#a78bfa", rgb: "167,139,250" },   // 3 purple
    { hex: "#34d399", rgb: "52,211,153"  },   // 4 green
  ];

  // ── i18n ─────────────────────────────────────────────────────────────────
  const i18n = {
    fr: {
      btnStart:     "Start",
      btnPause:     "Pause",
      btnResume:    "Reprendre",
      addPhase:     "Ajouter",
      newPhaseName: "Phase",
      toastEnd:     (n) => `✓ ${n} terminé !`,
      toastCycle:   "🎉 Cycle complet !",
      ariaReset:    "Réinitialiser",
      ariaSkip:     "Passer",
    },
    en: {
      btnStart:     "Start",
      btnPause:     "Pause",
      btnResume:    "Resume",
      addPhase:     "Add",
      newPhaseName: "Phase",
      toastEnd:     (n) => `✓ ${n} done!`,
      toastCycle:   "🎉 Cycle complete!",
      ariaReset:    "Reset",
      ariaSkip:     "Skip",
    },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const DEFAULT_PHASES = [
    { id: 1, name: "Live",  duration: 30 * 60, colorIdx: 0 },
    { id: 2, name: "BRB",   duration:  5 * 60, colorIdx: 1 },
    { id: 3, name: "Pause", duration: 15 * 60, colorIdx: 2 },
  ];

  let st = {
    phases:          structuredClone(DEFAULT_PHASES),
    currentPhaseIdx: 0,
    timeLeft:        30 * 60,
    running:         false,
    displayMode:     "ring",
    editingIdx:      -1,
    nextId:          4,
  };

  let timerInterval = null;
  let currentLang   = localStorage.getItem("pa_lang")   || "fr";
  let currentTheme  = localStorage.getItem("pa_theme")  || "dark";

  function t(key, ...args) {
    const v = i18n[currentLang][key];
    return typeof v === "function" ? v(...args) : v;
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      phases:          st.phases,
      currentPhaseIdx: st.currentPhaseIdx,
      displayMode:     st.displayMode,
      nextId:          st.nextId,
    }));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.phases) && saved.phases.length > 0) {
        st.phases          = saved.phases;
        st.currentPhaseIdx = Math.min(saved.currentPhaseIdx || 0, saved.phases.length - 1);
        st.displayMode     = saved.displayMode || "ring";
        st.nextId          = saved.nextId || 4;
        st.timeLeft        = st.phases[st.currentPhaseIdx].duration;
      }
    } catch (_) {}
  }

  // ── Colour helpers ────────────────────────────────────────────────────────
  function phaseColor(phase) {
    return PHASE_COLORS[phase.colorIdx % PHASE_COLORS.length];
  }

  function applyPhaseColor(phase) {
    const c = phaseColor(phase);
    const root = document.documentElement;
    root.style.setProperty("--pc",     c.hex);
    root.style.setProperty("--pc-rgb", c.rgb);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderPhaseUI() {
    const phase = st.phases[st.currentPhaseIdx];
    applyPhaseColor(phase);

    $("phaseLabel").textContent = phase.name;
    $("timerSub").textContent   = formatTime(phase.duration);
    $("digitalSub").textContent = phase.name.toLowerCase();
    $("digitalTotal").textContent = formatTime(phase.duration);
  }

  function renderTimer() {
    const phase = st.phases[st.currentPhaseIdx];
    const pct   = st.timeLeft / phase.duration;

    // Ring
    $("ringProgress").style.strokeDashoffset = CIRC * (1 - pct);
    $("timerDigits").textContent = formatTime(st.timeLeft);

    // Digital
    $("digitalDigits").textContent = formatTime(st.timeLeft);
    $("progressFill").style.width  = pct * 100 + "%";
  }

  function renderControls() {
    const phase = st.phases[st.currentPhaseIdx];
    if (st.running) {
      $("startIconPath").setAttribute("d", ICON_PAUSE);
      $("startLabel").textContent = t("btnPause");
      $("widget").classList.add("is-running");
      document.body.classList.add("is-running");
    } else {
      $("startIconPath").setAttribute("d", ICON_PLAY);
      $("startLabel").textContent = st.timeLeft < phase.duration ? t("btnResume") : t("btnStart");
      $("widget").classList.remove("is-running");
      document.body.classList.remove("is-running");
    }
    $("resetBtn").setAttribute("aria-label", t("ariaReset"));
    $("skipBtn").setAttribute("aria-label",  t("ariaSkip"));
  }

  const ICON_RING = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 14"/></svg>`;
  const ICON_DISP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;

  function renderDisplayMode() {
    const isRing = st.displayMode === "ring";
    $("ringView").classList.toggle("hidden", !isRing);
    $("digitalView").classList.toggle("hidden", isRing);
    // Show the icon for the OTHER mode (what you'll switch TO)
    $("displayBtn").innerHTML = isRing ? ICON_DISP : ICON_RING;
  }

  function renderPhaseList() {
    const list = $("phaseList");
    list.innerHTML = "";

    st.phases.forEach((phase, idx) => {
      const row = document.createElement("div");
      row.className = "phase-row" + (idx === st.currentPhaseIdx ? " active" : "");

      if (st.editingIdx === idx) {
        row.innerHTML = `
          <form class="phase-edit-form" autocomplete="off">
            <input class="phase-input phase-input-name" id="ei-name"
              value="${escapeHtml(phase.name)}" maxlength="20" placeholder="Nom">
            <input class="phase-input phase-input-time" id="ei-time"
              value="${formatDurationShort(phase.duration)}" placeholder="ex: 25m">
            <button type="submit" class="phase-btn phase-save-btn" aria-label="Save">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button type="button" class="phase-btn phase-cancel-btn" aria-label="Cancel">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </form>`;

        row.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          savePhaseEdit(idx);
        });
        row.querySelector(".phase-cancel-btn").addEventListener("click", () => {
          st.editingIdx = -1;
          renderPhaseList();
        });
      } else {
        const c = phaseColor(phase);
        const canDelete = st.phases.length > 1;
        row.innerHTML = `
          <button class="phase-select" data-idx="${idx}">
            <span class="phase-dot" style="background:${c.hex};color:${c.hex}"></span>
            <span class="phase-name-text">${escapeHtml(phase.name)}</span>
          </button>
          <span class="phase-dur-text">${formatTime(phase.duration)}</span>
          <div class="phase-actions">
            <button class="phase-btn" data-action="edit" aria-label="Edit phase">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ${canDelete ? `
            <button class="phase-btn phase-del-btn" data-action="delete" aria-label="Delete phase">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>` : ""}
          </div>`;

        row.querySelector(".phase-select").addEventListener("click", () => switchToPhase(idx));
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          st.editingIdx = idx;
          renderPhaseList();
          setTimeout(() => $("ei-name")?.focus(), 10);
        });
        const delBtn = row.querySelector('[data-action="delete"]');
        if (delBtn) delBtn.addEventListener("click", () => deletePhase(idx));
      }

      list.appendChild(row);
    });

    $("addLabel").textContent = t("addPhase");
  }

  function renderAll() {
    renderPhaseUI();
    renderTimer();
    renderControls();
    renderPhaseList();
    renderDisplayMode();
  }

  // ── Timer logic ───────────────────────────────────────────────────────────
  function switchToPhase(idx, keepTime = false) {
    if (st.running) {
      clearInterval(timerInterval);
      timerInterval = null;
      st.running = false;
    }
    st.currentPhaseIdx = idx;
    if (!keepTime) st.timeLeft = st.phases[idx].duration;
    renderAll();
    saveState();
  }

  function toggleTimer() {
    if (st.running) {
      clearInterval(timerInterval);
      timerInterval = null;
      st.running = false;
      renderControls();
    } else {
      st.running = true;
      renderControls();
      timerInterval = setInterval(() => {
        st.timeLeft--;
        renderTimer();
        if (st.timeLeft <= 0) handlePhaseEnd();
      }, 1000);
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    st.running = false;
    st.timeLeft = st.phases[st.currentPhaseIdx].duration;
    renderTimer();
    renderControls();
  }

  function handlePhaseEnd() {
    clearInterval(timerInterval);
    timerInterval = null;
    st.running = false;

    const phaseName = st.phases[st.currentPhaseIdx].name;
    playEndSound();
    triggerEndFlash();

    const nextIdx  = (st.currentPhaseIdx + 1) % st.phases.length;
    const isCycle  = nextIdx === 0;
    showToast(isCycle ? t("toastCycle") : t("toastEnd", phaseName));

    st.currentPhaseIdx = nextIdx;
    st.timeLeft        = st.phases[nextIdx].duration;
    renderAll();
    saveState();
  }

  function skipPhase() {
    if (!st.running && st.timeLeft === st.phases[st.currentPhaseIdx].duration) {
      // Not started yet – just advance phase
      handlePhaseEnd();
    } else {
      st.timeLeft = 1; // will trigger handlePhaseEnd on next tick (or directly)
      handlePhaseEnd();
    }
  }

  // ── Phase CRUD ────────────────────────────────────────────────────────────
  function addPhase() {
    const colorIdx = st.nextId % PHASE_COLORS.length;
    st.phases.push({ id: st.nextId++, name: t("newPhaseName"), duration: 5 * 60, colorIdx });
    st.editingIdx = st.phases.length - 1;
    renderPhaseList();
    setTimeout(() => $("ei-name")?.focus(), 10);
    saveState();
  }

  function savePhaseEdit(idx) {
    const name     = ($("ei-name")?.value || "").trim() || st.phases[idx].name;
    const duration = parseTime($("ei-time")?.value || "") || st.phases[idx].duration;
    st.phases[idx].name     = name;
    st.phases[idx].duration = duration;
    if (idx === st.currentPhaseIdx && !st.running) st.timeLeft = duration;
    st.editingIdx = -1;
    renderAll();
    saveState();
  }

  function deletePhase(idx) {
    if (st.phases.length <= 1) return;
    st.phases.splice(idx, 1);
    if (st.currentPhaseIdx >= st.phases.length) st.currentPhaseIdx = st.phases.length - 1;
    else if (st.currentPhaseIdx > idx) st.currentPhaseIdx--;
    st.timeLeft = st.phases[st.currentPhaseIdx].duration;
    if (st.running) { clearInterval(timerInterval); timerInterval = null; st.running = false; }
    renderAll();
    saveState();
  }

  // ── Sound & Visual alert ──────────────────────────────────────────────────
  function playEndSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      function beep(freq, t0, dur) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
        gain.gain.setValueAtTime(0.22, t0 + dur - 0.02);
        gain.gain.linearRampToValueAtTime(0, t0 + dur);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      }
      const now = ctx.currentTime;
      beep(660,  now,        0.12);
      beep(880,  now + 0.18, 0.12);
      beep(1100, now + 0.36, 0.28);
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1500);
    } catch (_) {}
  }

  function triggerEndFlash() {
    const w = $("widget");
    w.classList.remove("end-flash");
    // Force reflow so re-adding the class retriggers the animation
    void w.offsetWidth;
    w.classList.add("end-flash");
    w.addEventListener("animationend", () => w.classList.remove("end-flash"), { once: true });
  }

  // ── Theme ─────────────────────────────────────────────────────────────────
  function updateThemeUI() {
    $("themeToggle").textContent = currentTheme === "dark" ? "🌙" : "☀️";
    document.documentElement.setAttribute("data-theme", currentTheme);
  }

  $("themeToggle").addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("pa_theme", currentTheme);
    updateThemeUI();
  });

  // ── Lang ──────────────────────────────────────────────────────────────────
  function updateLangUI() {
    $("langToggle").textContent = currentLang.toUpperCase();
    renderControls();
    renderPhaseList();
  }

  $("langToggle").addEventListener("click", () => {
    currentLang = currentLang === "fr" ? "en" : "fr";
    localStorage.setItem("pa_lang", currentLang);
    updateLangUI();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "pa_theme") { currentTheme = e.newValue; updateThemeUI(); }
    if (e.key === "pa_lang")  { currentLang  = e.newValue; updateLangUI(); }
  });

  // ── Display toggle ────────────────────────────────────────────────────────
  $("displayBtn").addEventListener("click", () => {
    st.displayMode = st.displayMode === "ring" ? "digital" : "ring";
    renderDisplayMode();
    saveState();
  });

  // ── Controls ──────────────────────────────────────────────────────────────
  $("startBtn").addEventListener("click", toggleTimer);
  $("resetBtn").addEventListener("click", resetTimer);
  $("skipBtn").addEventListener("click",  skipPhase);
  $("addPhaseBtn").addEventListener("click", addPhase);

  // ── Init ──────────────────────────────────────────────────────────────────
  loadState();
  updateThemeUI();
  renderAll();
})();
