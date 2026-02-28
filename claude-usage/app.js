(() => {
    "use strict";

    const $ = id => document.getElementById(id);

    /* ─────────────────────────────────────────────────────────────────
     *  CONSTANTS
     * ────────────────────────────────────────────────────────────────*/
    const THEME_KEY = "pa_theme";
    const LANG_KEY = "pa_lang";
    const CONVS_KEY = "pa_ai_conversations";

    /* ─────────────────────────────────────────────────────────────────
     *  i18n
     * ────────────────────────────────────────────────────────────────*/
    const i18n = {
        fr: {
            title: "Usage Claude",
            refresh: "Actualiser",
            messages: "Messages",
            tokens: "Tokens (est.)",
            convs: "Convs",
            chartTitle: "Activité par heure",
            moderate: "Modérée",
            intense: "Intense",
            critical: "Critique",
            emptyText: "Aucune conversation Claude trouvée aujourd'hui.",
            breakdownTitle: "Toutes les conversations",
            today: "Aujourd'hui",
            chars: "Caractères",
            toastRefresh: "✓ Statistiques mises à jour",
        },
        en: {
            title: "Claude Usage",
            refresh: "Refresh",
            messages: "Messages",
            tokens: "Tokens (est.)",
            convs: "Convs",
            chartTitle: "Activity by Hour",
            moderate: "Moderate",
            intense: "Intense",
            critical: "Critical",
            emptyText: "No Claude conversations found today.",
            breakdownTitle: "All Conversations",
            today: "Today",
            chars: "Characters",
            toastRefresh: "✓ Stats updated",
        },
    };

    let currentLang = localStorage.getItem(LANG_KEY) || "fr";
    if (currentLang !== "fr" && currentLang !== "en") currentLang = "fr";

    let currentTheme = localStorage.getItem(THEME_KEY) || "dark";
    if (currentTheme !== "dark" && currentTheme !== "light") currentTheme = "dark";

    function t(key) { return (i18n[currentLang] || i18n.en)[key] || key; }

    /* ─────────────────────────────────────────────────────────────────
     *  TOAST
     * ────────────────────────────────────────────────────────────────*/
    function showToast(msg, dur = 3000) {
        const el = $("toast");
        el.textContent = msg;
        el.classList.add("visible");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("visible"), dur);
    }

    /* ─────────────────────────────────────────────────────────────────
     *  THEME
     * ────────────────────────────────────────────────────────────────*/
    function applyTheme(th) {
        currentTheme = th === "light" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", currentTheme);
        $("themeToggle").textContent = currentTheme === "dark" ? "🌙" : "☀️";
    }

    $("themeToggle").addEventListener("click", () => {
        applyTheme(currentTheme === "dark" ? "light" : "dark");
        localStorage.setItem(THEME_KEY, currentTheme);
    });

    /* ─────────────────────────────────────────────────────────────────
     *  LANGUAGE
     * ────────────────────────────────────────────────────────────────*/
    function applyLang(lang) {
        currentLang = lang === "en" ? "en" : "fr";
        $("langToggle").textContent = currentLang.toUpperCase();
        updateStaticStrings();
    }

    function updateStaticStrings() {
        const set = (id, key) => { const e = $(id); if (e) e.textContent = t(key); };
        set("t-title", "title");
        set("t-refresh", "refresh");
        set("t-stat-messages", "messages");
        set("t-stat-tokens", "tokens");
        set("t-stat-convs", "convs");
        set("t-chart-title", "chartTitle");
        set("t-empty", "emptyText");
        set("t-breakdown-title", "breakdownTitle");
        set("t-today-label", "today");
        set("t-chars-label", "chars");
    }

    $("langToggle").addEventListener("click", () => {
        applyLang(currentLang === "fr" ? "en" : "fr");
        localStorage.setItem(LANG_KEY, currentLang);
    });

    // Cross-tab sync
    window.addEventListener("storage", e => {
        if (e.key === THEME_KEY && e.newValue) applyTheme(e.newValue);
        if (e.key === LANG_KEY && e.newValue) applyLang(e.newValue);
        if (e.key === CONVS_KEY) renderClaudeStats(); // live update when ai-assistant saves
    });

    /* ─────────────────────────────────────────────────────────────────
     *  CLAUDE USAGE ANALYTICS
     * ────────────────────────────────────────────────────────────────*/
    function loadConversations() {
        try {
            const raw = localStorage.getItem(CONVS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    function getTodayStart() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }

    function computeClaudeStats() {
        const conversations = loadConversations();
        const todayStart = getTodayStart();

        let totalMessages = 0;
        let totalChars = 0;
        let activeConvs = 0;
        let allTotalChars = 0;
        const hourlyActivity = new Array(24).fill(0);

        conversations.forEach(conv => {
            if (!conv.messages || !Array.isArray(conv.messages)) return;

            // Count all characters across all conversations
            conv.messages.forEach(msg => {
                allTotalChars += (msg.content || "").length;
            });

            let convHasToday = false;
            const convTime = conv.createdAt || 0;

            if (convTime >= todayStart) {
                conv.messages.forEach(msg => {
                    totalMessages++;
                    totalChars += (msg.content || "").length;
                    convHasToday = true;

                    const hour = new Date(convTime).getHours();
                    hourlyActivity[hour]++;
                });

                if (convHasToday) activeConvs++;
            }
        });

        const estimatedTokens = Math.ceil(totalChars / 4);

        return {
            totalMessages,
            estimatedTokens,
            activeConvs,
            hourlyActivity,
            totalConversations: conversations.length,
            allTotalChars,
        };
    }

    function formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
        if (n >= 1000) return (n / 1000).toFixed(1) + "k";
        return String(n);
    }

    function renderClaudeStats() {
        const stats = computeClaudeStats();

        // Stats cards
        $("statMessages").textContent = formatNumber(stats.totalMessages);
        $("statTokens").textContent = formatNumber(stats.estimatedTokens);
        $("statConvs").textContent = String(stats.activeConvs);

        // Breakdown
        $("totalAllConvs").textContent = formatNumber(stats.totalConversations);
        $("totalTodayConvs").textContent = formatNumber(stats.activeConvs);
        $("totalChars").textContent = formatNumber(stats.allTotalChars);

        // Empty state
        const emptyState = $("emptyState");
        if (stats.totalMessages === 0) {
            emptyState.style.display = "flex";
        } else {
            emptyState.style.display = "none";
        }

        // Hourly chart
        renderHourlyChart(stats.hourlyActivity);

        // Intensity gauge
        renderGauge(stats.totalMessages);
    }

    function renderHourlyChart(hourly) {
        const wrap = $("chartWrap");
        wrap.innerHTML = "";

        const max = Math.max(...hourly, 1);

        for (let h = 0; h < 24; h++) {
            const bar = document.createElement("div");
            bar.className = "chart-bar";
            const pct = (hourly[h] / max) * 100;
            bar.style.height = Math.max(pct, 3) + "%";
            bar.setAttribute("data-tooltip", `${h}h: ${hourly[h]} msg`);

            if (hourly[h] === 0) {
                bar.style.opacity = "0.15";
            }

            wrap.appendChild(bar);
        }
    }

    function renderGauge(messageCount) {
        const fill = $("gaugeFill");
        const label = $("gaugeLabel");

        fill.className = "gauge-fill";
        label.className = "gauge-label";

        if (messageCount > 150) {
            fill.classList.add("critical");
            label.classList.add("critical");
            label.textContent = t("critical");
        } else if (messageCount > 50) {
            fill.classList.add("intense");
            label.classList.add("intense");
            label.textContent = t("intense");
        } else {
            fill.classList.add("moderate");
            label.classList.add("moderate");
            label.textContent = t("moderate");
        }
    }

    /* ─────────────────────────────────────────────────────────────────
     *  REFRESH BUTTON
     * ────────────────────────────────────────────────────────────────*/
    $("refreshBtn").addEventListener("click", () => {
        renderClaudeStats();
        showToast(t("toastRefresh"));
    });

    /* ─────────────────────────────────────────────────────────────────
     *  INIT
     * ────────────────────────────────────────────────────────────────*/
    applyTheme(currentTheme);
    applyLang(currentLang);
    updateStaticStrings();
    renderClaudeStats();

    // Auto-refresh every 60 seconds
    setInterval(renderClaudeStats, 60 * 1000);
})();
