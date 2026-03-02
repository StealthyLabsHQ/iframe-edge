(() => {
    "use strict";
    const $ = (id) => document.getElementById(id);
    const HTTP_PROTOCOLS = new Set(["https:", "http:"]);
    const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
    const VALID_THEMES = new Set(["dark", "light"]);
    const VALID_LANGS = new Set(["fr", "en"]);

    function normalizeTheme(value) {
        return VALID_THEMES.has(value) ? value : "dark";
    }

    function normalizeLang(value) {
        return VALID_LANGS.has(value) ? value : "fr";
    }

    function isPrivateOrLoopbackHost(hostname) {
        if (!hostname) return true;
        const host = hostname.toLowerCase();
        if (LOCAL_HOSTS.has(host) || host.endsWith(".local")) return true;

        // Basic IPv6 local ranges and loopback.
        if (host.includes(":")) {
            return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
        }

        const parts = host.split(".");
        if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
        const octets = parts.map((part) => Number(part));
        if (octets.some((value) => value < 0 || value > 255)) return true;

        return (
            octets[0] === 0 ||
            octets[0] === 10 ||
            octets[0] === 127 ||
            (octets[0] === 169 && octets[1] === 254) ||
            (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
            (octets[0] === 192 && octets[1] === 168) ||
            octets[0] >= 224
        );
    }

    function sanitizeHttpUrl(rawUrl, options = {}) {
        const value = String(rawUrl || "").trim();
        if (!value || value.length > 2048) return "";

        let parsed;
        try {
            parsed = new URL(value);
        } catch {
            return "";
        }

        if (!HTTP_PROTOCOLS.has(parsed.protocol)) return "";
        if (parsed.username || parsed.password) return "";
        if (options.blockPrivateHosts && isPrivateOrLoopbackHost(parsed.hostname)) return "";

        return parsed.href;
    }

    // Toast
    function showToast(msg, duration = 3000) {
        const el = $("toast");
        el.textContent = msg;
        el.classList.add("visible");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("visible"), duration);
    }

    // Theme
    const THEME_KEY = "pa_theme";
    let currentTheme = normalizeTheme(localStorage.getItem(THEME_KEY));

    function updateThemeUI() {
        $("themeToggle").textContent = currentTheme === "dark" ? "🌙" : "☀️";
        document.documentElement.setAttribute("data-theme", currentTheme);
    }

    $("themeToggle").addEventListener("click", () => {
        currentTheme = currentTheme === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, currentTheme);
        updateThemeUI();
    });

    // Language
    const LANG_KEY = "pa_lang";
    let currentLang = normalizeLang(localStorage.getItem(LANG_KEY));

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
            btnOpen: "Ouvrir",
            cached: "Cache restauré",
            invalidCustomUrl: "URL de flux invalide (http/https public uniquement).",
            invalidArticleLink: "Lien d'article invalide.",
            groupFr: "France",
            groupUsUk: "Etats-Unis / Royaume-Uni",
            groupEu: "Europe",
            groupTech: "Tech",
            groupGnews: "Google News",
            groupOther: "Autre",
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
            btnOpen: "Open",
            cached: "Cache restored",
            invalidCustomUrl: "Invalid feed URL (public http/https only).",
            invalidArticleLink: "Invalid article link.",
            groupFr: "France",
            groupUsUk: "United States / United Kingdom",
            groupEu: "Europe",
            groupTech: "Tech",
            groupGnews: "Google News",
            groupOther: "Other",
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
        document.querySelectorAll(".btn-open-text").forEach((el) => {
            el.textContent = t("btnOpen");
        });
        // Dropdown group headers
        const groupMap = { "t-group-gnews": "groupGnews", "t-group-fr": "groupFr", "t-group-usuk": "groupUsUk", "t-group-eu": "groupEu", "t-group-tech": "groupTech", "t-group-other": "groupOther" };
        for (const [id, key] of Object.entries(groupMap)) {
            const el = $(id);
            if (el && i18n[currentLang][key]) el.textContent = t(key);
        }
        // Reorder groups based on language
        reorderDropdownGroups();
    }

    // Group order per language: FR = French first, EN = English first
    const GROUP_ORDER = {
        fr: ["t-group-gnews", "t-group-fr", "t-group-usuk", "t-group-eu", "t-group-tech", "t-group-other"],
        en: ["t-group-gnews", "t-group-usuk", "t-group-tech", "t-group-eu", "t-group-fr", "t-group-other"],
    };

    function reorderDropdownGroups() {
        const list = $("customSelectList");
        if (!list) return;

        const order = GROUP_ORDER[currentLang] || GROUP_ORDER.fr;

        // Collect each group: header LI + following option LIs until next group
        const groups = new Map();
        let currentGroup = null;

        Array.from(list.children).forEach((li) => {
            if (li.classList.contains("custom-select-group")) {
                currentGroup = li.id || "__unknown__";
                groups.set(currentGroup, [li]);
            } else if (currentGroup && groups.has(currentGroup)) {
                groups.get(currentGroup).push(li);
            }
        });

        // Within Google News group: EN first when lang=en, FR first when lang=fr
        const gnews = groups.get("t-group-gnews");
        if (gnews) {
            const frOpt = gnews.find((el) => el.dataset?.value?.includes("ceid=FR:fr"));
            const enOpt = gnews.find((el) => el.dataset?.value?.includes("ceid=US:en"));
            if (frOpt && enOpt) {
                const frIdx = gnews.indexOf(frOpt);
                const enIdx = gnews.indexOf(enOpt);
                if (currentLang === "en" && frIdx < enIdx) {
                    gnews[frIdx] = enOpt;
                    gnews[enIdx] = frOpt;
                } else if (currentLang === "fr" && enIdx < frIdx) {
                    gnews[enIdx] = frOpt;
                    gnews[frIdx] = enOpt;
                }
            }
        }

        // Re-append in desired order
        for (const groupId of order) {
            const elements = groups.get(groupId);
            if (elements) {
                elements.forEach((el) => list.appendChild(el));
            }
        }
    }

    $("langToggle").addEventListener("click", () => {
        currentLang = currentLang === "fr" ? "en" : "fr";
        localStorage.setItem(LANG_KEY, currentLang);
        updateLangUI();
    });

    // Cross-tab sync
    window.addEventListener("storage", (e) => {
        if (e.key === THEME_KEY) { currentTheme = normalizeTheme(e.newValue); updateThemeUI(); }
        if (e.key === LANG_KEY) { currentLang = normalizeLang(e.newValue); updateLangUI(); }
    });

    // Custom source dropdown
    const customSelectBtn = $("customSelectBtn");
    const customSelectList = $("customSelectList");
    const customSelectLabel = $("customSelectLabel");
    const customUrlInput = $("customUrlInput");
    const DEFAULT_SOURCE = "https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr";
    const allowedSources = new Set(
        Array.from(customSelectList.querySelectorAll(".custom-select-option"))
            .map((opt) => opt.dataset.value)
            .filter(Boolean)
    );
    let selectedValue = DEFAULT_SOURCE;

    function closeDropdown() {
        customSelectList.classList.remove("open");
        customSelectBtn.setAttribute("aria-expanded", "false");
    }

    customSelectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = customSelectList.classList.contains("open");
        if (isOpen) {
            closeDropdown();
        } else {
            customSelectList.classList.add("open");
            customSelectBtn.setAttribute("aria-expanded", "true");
        }
    });

    customSelectList.querySelectorAll(".custom-select-option").forEach((opt) => {
        opt.addEventListener("click", () => {
            selectedValue = opt.dataset.value;
            customSelectLabel.textContent = opt.textContent.trim();
            customSelectList.querySelectorAll(".custom-select-option").forEach((o) => o.classList.remove("selected"));
            opt.classList.add("selected");
            closeDropdown();
            const isCustom = selectedValue === "custom";
            customUrlInput.classList.toggle("visible", isCustom);
            localStorage.setItem("pa_newsSource", selectedValue);
            if (isCustom) customUrlInput.focus();
        });
    });

    document.addEventListener("click", closeDropdown);

    customUrlInput.addEventListener("change", () => {
        const rawValue = customUrlInput.value.trim();
        if (!rawValue) {
            localStorage.removeItem("pa_newsCustomUrl");
            customUrlInput.value = "";
            return;
        }
        const sanitized = sanitizeHttpUrl(rawValue, { blockPrivateHosts: true });
        if (!sanitized) {
            showToast(t("invalidCustomUrl"));
            return;
        }
        customUrlInput.value = sanitized;
        localStorage.setItem("pa_newsCustomUrl", sanitized);
    });

    // Clipboard helper (iCUE-safe)
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

    // Render helpers
    function formatDate(dateStr) {
        try {
            return new Date(dateStr).toLocaleDateString(
                currentLang === "fr" ? "fr-FR" : "en-US",
                { day: "numeric", month: "short", year: "numeric" }
            );
        } catch { return dateStr; }
    }

    function stripHtml(html) {
        if (!html) return "";
        const doc = new DOMParser().parseFromString(String(html), "text/html");
        return doc.body?.textContent || "";
    }

    function createLinkButton() {
        const btn = document.createElement("button");
        btn.className = "btn-link";
        btn.type = "button";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "12");
        svg.setAttribute("height", "12");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.5");
        svg.setAttribute("stroke-linecap", "round");

        const pathA = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathA.setAttribute("d", "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71");
        const pathB = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathB.setAttribute("d", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71");
        svg.append(pathA, pathB);

        const label = document.createElement("span");
        label.className = "btn-link-text";
        label.textContent = t("btnLink");

        btn.append(svg, label);
        return btn;
    }

    function createOpenButton() {
        const btn = document.createElement("button");
        btn.className = "btn-open";
        btn.type = "button";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "12");
        svg.setAttribute("height", "12");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.5");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        const box = document.createElementNS("http://www.w3.org/2000/svg", "path");
        box.setAttribute("d", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6");
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        poly.setAttribute("points", "15 3 21 3 21 9");
        const diag = document.createElementNS("http://www.w3.org/2000/svg", "line");
        diag.setAttribute("x1", "10"); diag.setAttribute("y1", "14");
        diag.setAttribute("x2", "21"); diag.setAttribute("y2", "3");
        svg.append(box, poly, diag);

        const label = document.createElement("span");
        label.className = "btn-open-text";
        label.textContent = t("btnOpen");

        btn.append(svg, label);
        return btn;
    }

    // Auto-summary: extract the first 1-2 sentences, max 220 chars
    function buildSummary(rawText) {
        const text = rawText.replace(/\s+/g, " ").trim();
        if (!text) return "";

        // Match sentence boundaries (. ! ?) followed by space or end
        const sentenceRe = /[^.!?]+[.!?](?:\s|$)/g;
        const sentences = [];
        let match;
        while ((match = sentenceRe.exec(text)) !== null) {
            sentences.push(match[0].trim());
            if (sentences.join(" ").length >= 220 || sentences.length >= 2) break;
        }

        if (sentences.length > 0) {
            const summary = sentences.join(" ");
            return summary.length > 240 ? summary.slice(0, 237) + "..." : summary;
        }
        // No sentence boundary found; truncate cleanly at word boundary
        if (text.length <= 220) return text;
        const cut = text.lastIndexOf(" ", 220);
        return text.slice(0, cut > 0 ? cut : 220) + "...";
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
            setTimeout(() => card.classList.add("pulse"), Math.min(i * 35, 600));

            const title = document.createElement("div");
            title.className = "article-title";
            title.textContent = stripHtml(item.title || "");

            const desc = document.createElement("div");
            desc.className = "article-desc";
            const rawDesc = buildSummary(stripHtml(item.description || ""));
            desc.textContent = rawDesc;

            const meta = document.createElement("div");
            meta.className = "article-meta";

            const source = document.createElement("span");
            source.className = "article-source";
            source.textContent = item.author || item.source || "";

            const date = document.createElement("span");
            date.className = "article-date";
            date.textContent = formatDate(item.pubDate);

            const btn = createLinkButton();
            const link = sanitizeHttpUrl(item.link);
            btn.addEventListener("click", () => {
                if (!link) {
                    showToast(t("invalidArticleLink"));
                    return;
                }
                if (copyToClipboard(link)) {
                    showToast(t("linkCopied"));
                    btn.classList.add("copied");
                    setTimeout(() => btn.classList.remove("copied"), 1200);
                }
            });

            const btnOpen = createOpenButton();
            btnOpen.addEventListener("click", () => {
                if (!link) { showToast(t("invalidArticleLink")); return; }
                window.open(link, "_blank", "noopener,noreferrer");
            });

            const actions = document.createElement("div");
            actions.className = "card-actions";
            actions.appendChild(btnOpen);
            actions.appendChild(btn);

            meta.appendChild(source);
            meta.appendChild(date);
            meta.appendChild(actions);
            card.appendChild(title);
            if (rawDesc) card.appendChild(desc);
            card.appendChild(meta);
            list.appendChild(card);
        });
    }

    // Fetch and filter
    const MAX_ARTICLES = 50;
    const FETCH_TIMEOUT_MS = 10000;
    const RSS2JSON_API = "https://api.rss2json.com/v1/api.json?count=" + MAX_ARTICLES + "&rss_url=";
    const ALLORIGINS_GET = "https://api.allorigins.win/get?url=";
    const ALLORIGINS_RAW = "https://api.allorigins.win/raw?url=";
    const URL_ALIASES = Object.freeze({
        // Legacy URL migrations (http->https, broken->working)
        "https://www.lemonde.fr/international/rss_full_text.xml": "https://www.lemonde.fr/international/rss_full.xml",
        "https://www.bfmtv.com/rss/info/flux-rss/": "https://www.bfmtv.com/rss/news-24-7/",
        "http://feeds.bbci.co.uk/news/world/rss.xml": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "http://feeds.skynews.com/feeds/rss/home.xml": "https://feeds.skynews.com/feeds/rss/home.xml",
        "http://rss.cnn.com/rss/edition.rss": "https://news.google.com/rss/search?q=site%3Acnn.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://rss.cnn.com/rss/edition.rss": "https://news.google.com/rss/search?q=site%3Acnn.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml": "https://news.google.com/rss/search?q=site%3Anytimes.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://www.cbsnews.com/latest/rss/main": "https://news.google.com/rss/search?q=site%3Acbsnews.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://fr.euronews.com/rss?format=full&level=vertical&name=news": "https://news.google.com/rss/search?q=site%3Afr.euronews.com&hl=fr&gl=FR&ceid=FR:fr",
        "https://www.euronews.com/rss?format=full&level=vertical&name=news": "https://news.google.com/rss/search?q=site%3Aeuronews.com&hl=en-US&gl=US&ceid=US%3Aen",
        // Feeds that block proxies -> Google News site search
        "https://feeds.reuters.com/reuters/topNews": "https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://www.theguardian.com/world/rss": "https://news.google.com/rss/search?q=site%3Atheguardian.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://feeds.a.dj.com/rss/RSSWorldNews.xml": "https://news.google.com/rss/search?q=site%3Awsj.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://abcnews.go.com/abcnews/topstories": "https://news.google.com/rss/search?q=site%3Aabcnews.go.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://feeds.foxnews.com/foxnews/latest": "https://news.google.com/rss/search?q=site%3Afoxnews.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://www.eureporter.co/feed/": "https://news.google.com/rss/search?q=site%3Aeureporter.co&hl=en-US&gl=US&ceid=US%3Aen",
        "https://www.theverge.com/rss/index.xml": "https://news.google.com/rss/search?q=site%3Atheverge.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://techcrunch.com/feed/": "https://news.google.com/rss/search?q=site%3Atechcrunch.com&hl=en-US&gl=US&ceid=US%3Aen",
        "https://feeds.foxnews.com/foxnews/tech": "https://news.google.com/rss/search?q=site%3Afoxnews.com+tech&hl=en-US&gl=US&ceid=US%3Aen",
    });

    function normalizeFeedUrl(url) {
        return URL_ALIASES[url] || url;
    }

    async function fetchWithTimeout(url, init = {}, timeoutMs = FETCH_TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
        } finally {
            clearTimeout(timer);
        }
    }

    // Google News search RSS: keyword injected as query
    function buildGoogleNewsUrl(keyword, source) {
        const langMap = {
            "https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr": { hl: "fr", gl: "FR", ceid: "FR:fr" },
            "https://news.google.com/rss?hl=en&gl=US&ceid=US:en": { hl: "en", gl: "US", ceid: "US:en" },
        };
        const params = langMap[source];
        if (params) {
            return `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${params.hl}&gl=${params.gl}&ceid=${params.ceid}`;
        }
        // Existing Google News site: search URL -> inject keyword into query
        if (source.startsWith("https://news.google.com/rss/search?")) {
            try {
                const u = new URL(source);
                const existing = u.searchParams.get("q") || "";
                u.searchParams.set("q", keyword + " " + existing);
                return u.toString();
            } catch { return null; }
        }
        return null;
    }

    // Parse RSS XML into array of {title, link, pubDate, description, author}
    function parseRssXml(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, "text/xml");
        if (doc.querySelector("parsererror")) {
            throw new Error("Invalid RSS XML");
        }

        const items = doc.querySelectorAll("item");
        const results = [];

        items.forEach((item) => {
            results.push({
                title: item.querySelector("title")?.textContent || "",
                link: item.querySelector("link")?.textContent || "",
                pubDate: item.querySelector("pubDate")?.textContent || "",
                description: item.querySelector("description")?.textContent || "",
                author: item.querySelector("source")?.textContent ||
                    item.querySelector("dc\\:creator")?.textContent || "",
            });
        });

        if (results.length > 0) return results;

        // Atom fallback for feeds exposing <entry> instead of <item>.
        const entries = doc.querySelectorAll("entry");
        entries.forEach((entry) => {
            const linkEl = entry.querySelector("link[href]");
            results.push({
                title: entry.querySelector("title")?.textContent || "",
                link: linkEl?.getAttribute("href") || entry.querySelector("link")?.textContent || "",
                pubDate: entry.querySelector("published")?.textContent ||
                    entry.querySelector("updated")?.textContent || "",
                description: entry.querySelector("summary")?.textContent ||
                    entry.querySelector("content")?.textContent || "",
                author: entry.querySelector("author > name")?.textContent ||
                    entry.querySelector("author")?.textContent || "",
            });
        });

        return results;
    }

    function parseRss2JsonItems(items) {
        if (!Array.isArray(items)) return [];
        return items.map((item) => ({
            title: item.title || "",
            link: item.link || "",
            pubDate: item.pubDate || item.published || "",
            description: item.description || item.content || "",
            author: item.author || "",
        }));
    }

    async function fetchViaAllOriginsRaw(rssUrl) {
        const url = ALLORIGINS_RAW + encodeURIComponent(rssUrl);
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error("allorigins(raw) HTTP " + res.status);
        return parseRssXml(await res.text());
    }

    async function fetchViaAllOriginsGet(rssUrl) {
        const url = ALLORIGINS_GET + encodeURIComponent(rssUrl);
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error("allorigins(get) HTTP " + res.status);
        const data = await res.json();
        return parseRssXml(data.contents || "");
    }

    async function fetchViaCorsproxy(rssUrl) {
        const url = "https://corsproxy.io/?url=" + encodeURIComponent(rssUrl);
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error("corsproxy HTTP " + res.status);
        return parseRssXml(await res.text());
    }

    async function fetchViaCodetabs(rssUrl) {
        const url = "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(rssUrl);
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error("codetabs HTTP " + res.status);
        return parseRssXml(await res.text());
    }

    async function fetchViaRss2Json(rssUrl) {
        const url = RSS2JSON_API + encodeURIComponent(rssUrl);
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error("rss2json HTTP " + res.status);
        const data = await res.json();
        if (data.status && data.status !== "ok") {
            throw new Error("rss2json: " + (data.message || "API error"));
        }
        return parseRss2JsonItems(data.items);
    }

    function buildCandidateUrls(url) {
        const normalized = normalizeFeedUrl(url);
        if (!normalized.toLowerCase().startsWith("http://")) {
            return [normalized];
        }
        return [normalized.replace(/^http:\/\//i, "https://"), normalized];
    }

    async function fetchRss(rssUrl) {
        const candidates = buildCandidateUrls(rssUrl);
        const providers = [
            { name: "rss2json", fn: fetchViaRss2Json },
            { name: "corsproxy.io", fn: fetchViaCorsproxy },
            { name: "allorigins(raw)", fn: fetchViaAllOriginsRaw },
            { name: "allorigins(get)", fn: fetchViaAllOriginsGet },
            { name: "codetabs", fn: fetchViaCodetabs },
        ];

        // Fire all providers in parallel; first success wins
        const attempts = [];
        for (const candidate of candidates) {
            for (const provider of providers) {
                attempts.push(
                    provider.fn(candidate).then((items) => {
                        console.log("[NewsRadar]", provider.name, "OK -", items.length, "items");
                        return items;
                    }, (err) => {
                        console.warn("[NewsRadar]", provider.name, "failed:", err?.message || err);
                        throw err;
                    })
                );
            }
        }

        try {
            return await Promise.any(attempts);
        } catch (agg) {
            // All providers failed; surface last error
            const errors = agg.errors || [];
            throw errors[errors.length - 1] || new Error("Feed unavailable");
        }
    }

    function toTimestamp(dateString) {
        const ts = Date.parse(dateString || "");
        return Number.isFinite(ts) ? ts : 0;
    }

    function dedupeArticles(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = ((item.link || "") + "|" + (item.title || "") + "|" + (item.pubDate || ""))
                .trim()
                .toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function scoreArticle(item, kw) {
        const title = (item.title || "").toLowerCase();
        const desc = stripHtml(item.description || "").toLowerCase();
        let score = 0;
        if (title.includes(kw)) score += 5;
        if (title.startsWith(kw)) score += 2;
        if (desc.includes(kw)) score += 2;
        return score;
    }

    function pickTopArticles(items, keyword, useServerFilter) {
        const deduped = dedupeArticles(items);

        if (useServerFilter) {
            return deduped
                .sort((a, b) => toTimestamp(b.pubDate) - toTimestamp(a.pubDate))
                .slice(0, MAX_ARTICLES);
        }

        const kw = keyword.toLowerCase();
        return deduped
            .map((item) => ({ item, score: scoreArticle(item, kw) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || toTimestamp(b.item.pubDate) - toTimestamp(a.item.pubDate))
            .slice(0, MAX_ARTICLES)
            .map((entry) => entry.item);
    }

    async function fetchFeed(keyword) {
        if (!keyword.trim()) { showToast(t("enterKeyword")); return; }

        let rssUrl = selectedValue;
        let useServerFilter = false;
        if (rssUrl !== "custom" && !allowedSources.has(rssUrl)) {
            rssUrl = DEFAULT_SOURCE;
            selectedValue = DEFAULT_SOURCE;
            localStorage.setItem("pa_newsSource", DEFAULT_SOURCE);
        }

        if (rssUrl === "custom") {
            rssUrl = sanitizeHttpUrl(customUrlInput.value, { blockPrivateHosts: true });
            if (!rssUrl) { showToast(t("invalidCustomUrl")); return; }
        } else {
            const gnUrl = buildGoogleNewsUrl(keyword, rssUrl);
            if (gnUrl) {
                rssUrl = gnUrl;
                useServerFilter = true;
            }
        }
        rssUrl = normalizeFeedUrl(rssUrl);

        $("spinner").classList.add("active");
        $("statusText").textContent = t("loading");
        $("statusCount").textContent = "";

        try {
            let items;
            try { items = await fetchRss(rssUrl); }
            catch { items = await fetchRss(rssUrl); } // silent retry on transient failure
            const articles = pickTopArticles(items, keyword, useServerFilter);

            localStorage.setItem("pa_newsCache", JSON.stringify(articles));
            localStorage.setItem("pa_newsKeyword", keyword);

            $("statusText").textContent = articles.length === 0
                ? t("noResults") + ' "' + keyword + '"'
                : "";

            renderArticles(articles);
        } catch (err) {
            console.error("[NewsRadar] fetch error:", err);
            const reason = String(err?.message || err || "");
            const isNetwork = /Failed to fetch|NetworkError|AbortError|Load failed|timed out/i.test(reason);
            const note = isNetwork
                ? (currentLang === "fr" ? "connexion ou source indisponible" : "connection or source unavailable")
                : (currentLang === "fr" ? "source indisponible ou bloquée" : "source unavailable or blocked");
            $("statusText").textContent = t("error") + " \u2014 " + note;
            renderArticles([]);
        } finally {
            $("spinner").classList.remove("active");
        }
    }

    // Events
    $("searchBtn").addEventListener("click", () => fetchFeed($("keywordInput").value.trim()));
    $("keywordInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") fetchFeed($("keywordInput").value.trim());
    });

    // Restore from localStorage
    function restoreState() {
        const savedSource = localStorage.getItem("pa_newsSource");
        if (savedSource) {
            const migratedSource = normalizeFeedUrl(savedSource);
            selectedValue = allowedSources.has(migratedSource) ? migratedSource : DEFAULT_SOURCE;
            if (selectedValue !== savedSource) localStorage.setItem("pa_newsSource", selectedValue);
            const opt = customSelectList.querySelector(`[data-value="${CSS.escape(selectedValue)}"]`);
            if (opt) {
                customSelectLabel.textContent = opt.textContent.trim();
                customSelectList.querySelectorAll(".custom-select-option").forEach((o) => o.classList.remove("selected"));
                opt.classList.add("selected");
            }
            if (selectedValue === "custom") {
                customUrlInput.classList.add("visible");
                const savedCustom = localStorage.getItem("pa_newsCustomUrl") || "";
                const sanitizedCustom = sanitizeHttpUrl(savedCustom, { blockPrivateHosts: true });
                customUrlInput.value = sanitizedCustom;
                if (savedCustom && !sanitizedCustom) localStorage.removeItem("pa_newsCustomUrl");
            }
        }

        const savedKw = localStorage.getItem("pa_newsKeyword");
        if (savedKw) $("keywordInput").value = savedKw;

        const cached = localStorage.getItem("pa_newsCache");
        if (cached) {
            try {
                const articles = JSON.parse(cached);
                if (Array.isArray(articles) && articles.length > 0) {
                    renderArticles(articles.slice(0, MAX_ARTICLES));
                    $("statusText").textContent = t("cached");
                }
            } catch { /* noop */ }
        }
    }

    // Init
    updateThemeUI();
    updateLangUI();
    restoreState();
})();
