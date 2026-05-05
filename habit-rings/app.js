(() => {
    "use strict";

    const STORAGE_KEY = "xeneonHabitRingsV1";
    const RING_LEN = 326.726;
    const COLORS = ["#1db954", "#00c8ff", "#ffb84d"];
    const $ = id => document.getElementById(id);

    function setting(name, fallback) {
        try {
            if (name === "habit1Label" && typeof habit1Label !== "undefined") return habit1Label || fallback;
            if (name === "habit1Goal" && typeof habit1Goal !== "undefined") return Number(habit1Goal) || fallback;
            if (name === "habit2Label" && typeof habit2Label !== "undefined") return habit2Label || fallback;
            if (name === "habit2Goal" && typeof habit2Goal !== "undefined") return Number(habit2Goal) || fallback;
            if (name === "habit3Label" && typeof habit3Label !== "undefined") return habit3Label || fallback;
            if (name === "habit3Goal" && typeof habit3Goal !== "undefined") return Number(habit3Goal) || fallback;
        } catch (_) {}
        return fallback;
    }

    function todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function defaults() {
        return { day: todayKey(), values: [0, 0, 0] };
    }

    function load() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (data && data.day === todayKey() && Array.isArray(data.values)) return data;
        } catch (_) {}
        return defaults();
    }

    function save(state) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }

    function habits() {
        return [
            { label: String(setting("habit1Label", "Water")).trim() || "Water", goal: Math.max(1, setting("habit1Goal", 8)), color: COLORS[0] },
            { label: String(setting("habit2Label", "Move")).trim() || "Move", goal: Math.max(1, setting("habit2Goal", 30)), color: COLORS[1] },
            { label: String(setting("habit3Label", "Read")).trim() || "Read", goal: Math.max(1, setting("habit3Goal", 20)), color: COLORS[2] }
        ];
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[c]));
    }

    let state = load();

    function ensureToday() {
        if (state.day !== todayKey()) {
            state = defaults();
            save(state);
        }
    }

    function dateLine() {
        $("dateLine").textContent = new Date().toLocaleDateString("en", {
            weekday: "long",
            month: "short",
            day: "numeric"
        });
    }

    function renderHabit(item, index) {
        const current = Math.max(0, Number(state.values[index] || 0));
        const ratio = Math.max(0, Math.min(1, current / item.goal));
        const article = document.createElement("article");
        article.className = "habit";
        article.style.setProperty("--habit-color", item.color);
        const safeLabel = escapeHtml(item.label);
        article.innerHTML = `
            <div class="ring-wrap">
                <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
                    <circle class="track" cx="60" cy="60" r="52"></circle>
                    <circle class="fill" cx="60" cy="60" r="52" style="stroke-dashoffset:${RING_LEN * (1 - ratio)}"></circle>
                </svg>
                <div class="ring-center">
                    <b>${Math.round(ratio * 100)}</b>
                    <small>%</small>
                </div>
            </div>
            <div class="habit-footer">
                <div class="x-stack">
                    <p class="x-truncate">${safeLabel}</p>
                    <span class="x-truncate">${current} / ${item.goal}</span>
                </div>
                <button type="button" class="add" data-index="${index}" aria-label="Add ${safeLabel}">+</button>
            </div>
        `;
        return article;
    }

    function render() {
        ensureToday();
        dateLine();
        const host = $("rings");
        host.innerHTML = "";
        habits().forEach((item, index) => host.appendChild(renderHabit(item, index)));
    }

    function increment(index) {
        ensureToday();
        const cfg = habits()[index];
        state.values[index] = Math.min(cfg.goal, Number(state.values[index] || 0) + 1);
        save(state);
        render();
    }

    $("rings").addEventListener("click", event => {
        const button = event.target.closest("button[data-index]");
        if (!button) return;
        increment(Number(button.dataset.index));
    });

    $("reset").addEventListener("click", () => {
        state = defaults();
        save(state);
        render();
    });

    function start() {
        render();
    }

    window.HabitRings = { start };
    window.icueEvents = { onICUEInitialized: start, onDataUpdated: render };
    start();
})();
