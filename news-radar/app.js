(() => {
    "use strict";
    const $ = (id) => document.getElementById(id);

    // ── Toast ───────────────────────────────────────────
    function showToast(msg, duration = 3000) {
        const el = $("toast");
        el.textContent = msg;
        el.classList.add("visible");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("visible"), duration);
    }

    // ── Theme ────────────────────────────────────────────
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

    // ── Language ─────────────────────────────────────────
    const LANG_KEY = "pa_lang";
    let currentLang = localStorage.getItem(LANG_KEY) || "fr";

    const i18n = {
        fr: {
            title: "News Radar",
            search: "Chercher",
            placeholder: "Entrez un mot-clé…",
            customUrl: "URL personnalisée…",
            customPlaceholder: "https://example.com/feed.xml",
            emptyTitle: "Aucun signal",
            emptyDesc: "Entrez un mot-clé et appuyez sur Chercher pour scanner les flux.",
            loading: "Scan en cours…",
            found: "article(s) trouvé(s)",
            noResults: "Aucun article trouvé pour",
            error: "❌ Erreur lors du chargement du flux.",
            linkCopied: "✅ Lien copié !",
            enterKeyword: "⚠️ Veuillez entrer un mot-clé.",
            btnLink: "Lien",
            cached: "Cache restauré",
        },
        en: {
            title: "News Radar",
            search: "Search",
            placeholder: "Enter a keyword…",
            customUrl: "Custom URL…",
            customPlaceholder: "https://example.com/feed.xml",
            emptyTitle: "No signal yet",
            emptyDesc: "Enter a keyword and hit Search to start scanning feeds.",
            loading: "Scanning…",
            found: "article(s) found",
            noResults: "No articles found for",
            error: "❌ Error loading the feed.",
            linkCopied: "✅ Link copied!",
            enterKeyword: "⚠️ Please enter a keyword.",
            btnLink: "Link",
            cached: "Cache restored",
        },
    };

    function t(key) { return i18n[currentLang][key]; }

    function updateLangUI() {
        $("langToggle").textContent = currentLang.toUpperCase();
        $("t-title").textContent = t("title");
        $("t-search").textContent = t("search");
        $("keywordInput").placeholder = t("placeholder");
        $("t-custom").textContent = t("customUrl");
        $("customUrlInput").placeholder = t("customPlaceholder");
        $("t-emptyTitle").textContent = t("emptyTitle");
        $("t-emptyDesc").textContent = t("emptyDesc");
        document.querySelectorAll(".btn-link-text").forEach((el) => {
            el.textContent = t("btnLink");
        });
    }

    $("langToggle").addEventListener("click", () => {
        currentLang = currentLang === "fr" ? "en" : "fr";
        localStorage.setItem(LANG_KEY, currentLang);
        updateLangUI();
    });

    // ── Cross-tab sync ───────────────────────────────────
    window.addEventListener("storage", (e) => {
        if (e.key === THEME_KEY) { currentTheme = e.newValue; updateThemeUI(); }
        if (e.key === LANG_KEY) { currentLang = e.newValue; updateLangUI(); }
    });

    // ── Source selector ──────────────────────────────────
    const sourceSelect = $("sourceSelect");
    const customUrlInput = $("customUrlInput");

    sourceSelect.addEventListener("change", () => {
        const isCustom = sourceSelect.value === "custom";
        customUrlInput.classList.toggle("visible", isCustom);
        localStorage.setItem("pa_newsSource", sourceSelect.value);
        if (isCustom) customUrlInput.focus();
    });

    customUrlInput.addEventListener("change", () => {
        localStorage.setItem("pa_newsCustomUrl", customUrlInput.value);
    });

    // ── Clipboard helper (iCUE-safe) ─────────────────────
    function copyToClipboard(text) {
        const tmp = document.createElement("textarea");
        tmp.value = text;
        tmp.style.position = "fixed";
        tmp.style.top = "-9999px";
        tmp.style.left = "-9999px";
        tmp.setAttribute("readonly", "");
        document.body.appendChild(tmp);
        tmp.focus();
        tmp.select();
        tmp.setSelectionRange(0, 99999);
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { /* noop */ }
        document.body.removeChild(tmp);
        return ok;
    }

    // ── Render helpers ────────────────────────────────────
    function formatDate(dateStr) {
        try {
            return new Date(dateStr).toLocaleDateString(
                currentLang === "fr" ? "fr-FR" : "en-US",
                { day: "numeric", month: "short", year: "numeric" }
            );
        } catch { return dateStr; }
    }

    function stripHtml(html) {
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    function renderArticles(articles) {
        const list = $("articleList");
        const empty = $("emptyState");

        list.querySelectorAll(".article-card").forEach((c) => c.remove());

        if (!articles || articles.length === 0) {
            empty.style.display = "flex";
            $("statusCount").textContent = "";
            return;
        }

        empty.style.display = "none";
        $("statusCount").textContent = articles.length + " " + t("found");

        articles.forEach((item, i) => {
            const card = document.createElement("div");
            card.className = "article-card";
            setTimeout(() => card.classList.add("pulse"), i * 80);

            const title = document.createElement("div");
            title.className = "article-title";
            title.textContent = stripHtml(item.title || "");

            const meta = document.createElement("div");
            meta.className = "article-meta";

            const source = document.createElement("span");
            source.className = "article-source";
            source.textContent = item.author || item.source || "";

            const date = document.createElement("span");
            date.className = "article-date";
            date.textContent = formatDate(item.pubDate);

            const btn = document.createElement("button");
            btn.className = "btn-link";
            btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span class="btn-link-text">${t("btnLink")}</span>`;

            const link = item.link || "";
            btn.addEventListener("click", () => {
                if (copyToClipboard(link)) {
                    showToast(t("linkCopied"));
                    btn.classList.add("copied");
                    setTimeout(() => btn.classList.remove("copied"), 1200);
                }
            });

            meta.appendChild(source);
            meta.appendChild(date);
            meta.appendChild(btn);
            card.appendChild(title);
            card.appendChild(meta);
            list.appendChild(card);
        });
    }

    // ── Fetch & Filter ────────────────────────────────────
    const API_BASE = "https://api.rss2json.com/v2/rss_to_json?rss_url=";

    async function fetchFeed(keyword) {
        if (!keyword.trim()) { showToast(t("enterKeyword")); return; }

        let rssUrl = sourceSelect.value;
        if (rssUrl === "custom") {
            rssUrl = customUrlInput.value.trim();
            if (!rssUrl) { showToast(t("enterKeyword")); return; }
        }

        $("spinner").classList.add("active");
        $("statusText").textContent = t("loading");
        $("statusCount").textContent = "";

        try {
            const res = await fetch(API_BASE + encodeURIComponent(rssUrl));
            const data = await res.json();

            if (data.status !== "ok" || !data.items) {
                $("statusText").textContent = t("error");
                renderArticles([]);
                return;
            }

            const kw = keyword.toLowerCase();
            const filtered = data.items.filter((item) =>
                (item.title || "").toLowerCase().includes(kw) ||
                stripHtml(item.description || "").toLowerCase().includes(kw)
            );

            localStorage.setItem("pa_newsCache", JSON.stringify(filtered));
            localStorage.setItem("pa_newsKeyword", keyword);

            $("statusText").textContent = filtered.length === 0
                ? t("noResults") + ' "' + keyword + '"'
                : "";

            renderArticles(filtered);
        } catch {
            $("statusText").textContent = t("error");
            renderArticles([]);
        } finally {
            $("spinner").classList.remove("active");
        }
    }

    // ── Events ───────────────────────────────────────────
    $("searchBtn").addEventListener("click", () => fetchFeed($("keywordInput").value.trim()));
    $("keywordInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") fetchFeed($("keywordInput").value.trim());
    });

    // ── Restore from localStorage ─────────────────────────
    function restoreState() {
        const savedSource = localStorage.getItem("pa_newsSource");
        if (savedSource) {
            sourceSelect.value = savedSource;
            if (savedSource === "custom") {
                customUrlInput.classList.add("visible");
                customUrlInput.value = localStorage.getItem("pa_newsCustomUrl") || "";
            }
        }

        const savedKw = localStorage.getItem("pa_newsKeyword");
        if (savedKw) $("keywordInput").value = savedKw;

        const cached = localStorage.getItem("pa_newsCache");
        if (cached) {
            try {
                const articles = JSON.parse(cached);
                if (articles.length > 0) {
                    renderArticles(articles);
                    $("statusText").textContent = t("cached");
                }
            } catch { /* noop */ }
        }
    }

    // ── Init ──────────────────────────────────────────────
    updateThemeUI();
    updateLangUI();
    restoreState();
})();
