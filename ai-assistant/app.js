(() => {
    "use strict";

    /* ─────────────────────────────────────────────────────────────────
     *  CONSTANTS
     * ────────────────────────────────────────────────────────────────*/
    const LS = {
        THEME: "pa_theme",
        LANG: "pa_lang",
        PROVIDER: "pa_ai_provider",
        KEY_GEMINI: "pa_ai_key_gemini",
        KEY_CLAUDE: "pa_ai_key_claude",
        MODEL_GEMINI: "pa_ai_model_gemini",
        MODEL_CLAUDE: "pa_ai_model_claude",
        PROXY: "pa_ai_proxy_url",
        SYSTEM: "pa_ai_system_prompt",
        CONVS: "pa_ai_conversations",
    };
    const SS = {
        KEY_GEMINI: "pa_ai_key_gemini_session",
        KEY_CLAUDE: "pa_ai_key_claude_session",
    };

    const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
    const CLAUDE_BASE = "https://api.anthropic.com";
    const CLAUDE_VERSION = "2023-06-01";
    const MAX_CONVS = 20;

    const $ = id => document.getElementById(id);

    function enforceSameOriginFrame() {
        if (window.top === window.self) return;
        try {
            const topOrigin = window.top.location.origin;
            if (topOrigin !== window.location.origin) {
                throw new Error("cross_origin_frame");
            }
        } catch (_) {
            document.body.textContent = "Blocked: cross-origin framing is not allowed.";
            throw new Error("blocked_cross_origin_frame");
        }
    }

    /* ─────────────────────────────────────────────────────────────────
     *  STATE
     * ────────────────────────────────────────────────────────────────*/
    let state = {
        theme: localStorage.getItem(LS.THEME) || "dark",
        lang: localStorage.getItem(LS.LANG) || "fr",
        provider: localStorage.getItem(LS.PROVIDER) || "gemini",
        sizeClass: "",
        conversations: [],
        currentConvId: null,
        isStreaming: false,
        abortCtrl: null,
    };

    function safeGet(storage, key) {
        try { return storage.getItem(key) || ""; } catch (_) { return ""; }
    }

    function safeSet(storage, key, value) {
        try { storage.setItem(key, value); } catch (_) { }
    }

    function safeRemove(storage, key) {
        try { storage.removeItem(key); } catch (_) { }
    }

    function sessionKeyForProvider(provider) {
        return provider === "gemini" ? SS.KEY_GEMINI : SS.KEY_CLAUDE;
    }

    function legacyKeyForProvider(provider) {
        return provider === "gemini" ? LS.KEY_GEMINI : LS.KEY_CLAUDE;
    }

    function getApiKey(provider = state.provider) {
        const sessionKey = sessionKeyForProvider(provider);
        const legacyKey = legacyKeyForProvider(provider);
        const fromSession = safeGet(sessionStorage, sessionKey);
        if (fromSession) return fromSession.trim();

        // One-time migration from persistent localStorage to sessionStorage.
        const fromLocal = safeGet(localStorage, legacyKey);
        if (fromLocal) {
            safeSet(sessionStorage, sessionKey, fromLocal.trim());
            safeRemove(localStorage, legacyKey);
            return fromLocal.trim();
        }
        return "";
    }

    function setApiKey(provider, value) {
        const trimmed = (value || "").trim();
        const sessionKey = sessionKeyForProvider(provider);
        const legacyKey = legacyKeyForProvider(provider);
        if (trimmed) safeSet(sessionStorage, sessionKey, trimmed);
        else safeRemove(sessionStorage, sessionKey);
        // Ensure no persistent copy remains.
        safeRemove(localStorage, legacyKey);
    }

    function migrateLegacyApiKeys() {
        getApiKey("gemini");
        getApiKey("claude");
    }

    function normalizeProxyUrl(raw) {
        const value = (raw || "").trim();
        if (!value) return "";

        let parsed;
        try {
            parsed = new URL(value);
        } catch (_) {
            throw new Error("invalid_proxy_url");
        }

        if (parsed.protocol !== "https:") throw new Error("invalid_proxy_url");
        if (parsed.username || parsed.password) throw new Error("invalid_proxy_url");
        if (parsed.search || parsed.hash) throw new Error("invalid_proxy_url");

        const pathname = parsed.pathname.replace(/\/+$/, "");
        const normalizedPath = pathname === "/" ? "" : pathname;
        return `${parsed.origin}${normalizedPath}`;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  i18n
     * ────────────────────────────────────────────────────────────────*/
    const i18n = {
        fr: {
            title: "AI Assistant",
            history: "Historique",
            settings: "⚙️ Paramètres",
            providerLbl: "Fournisseur IA",
            geminiKeyLbl: "Clé API Gemini",
            geminiKeyHint: "Google AI Studio → Get API key",
            claudeKeyLbl: "Clé API Claude",
            claudeKeyHint: "console.anthropic.com → API Keys",
            modelGemini: "Modèle",
            modelClaude: "Modèle",
            proxyLbl: "URL Proxy",
            proxyHint: "Si vide, requête directe (header CORS Anthropic). Sinon, proxy HTTPS.",
            systemLbl: "Prompt système",
            optional: "optionnel",
            systemPh: "Tu es un assistant utile et concis…",
            proxyPh: "https://mon-proxy.exemple.com",
            save: "Enregistrer",
            clear: "Effacer l'historique",
            welcomeTitle: "Comment puis-je vous aider ?",
            setupTitle: "Configuration requise",
            setupSub: "Configurez votre clé API pour commencer.",
            openSettings: "Ouvrir les paramètres",
            newConv: "Nouvelle conversation",
            you: "Vous",
            ai: "IA",
            aborted: "— Génération interrompue",
            toastSaved: "✓ Paramètres enregistrés",
            toastCleared: "✓ Historique effacé",
            toastError: "Erreur — vérifiez votre clé API",
            toastInvalidProxy: "URL proxy invalide (HTTPS requis, sans auth/query/hash).",
            footerGemini: "Gemini peut se tromper. Vérifiez les informations importantes.",
            footerClaude: "Claude peut se tromper. Vérifiez les informations importantes.",
            s1: "Explique un concept complexe simplement",
            s2: "Aide-moi à rédiger un email professionnel",
            s3: "Analyse et améliore ce code",
            s4: "Écris un court poème créatif",
        },
        en: {
            title: "AI Assistant",
            history: "History",
            settings: "⚙️ Settings",
            providerLbl: "AI Provider",
            geminiKeyLbl: "Gemini API Key",
            geminiKeyHint: "Google AI Studio → Get API key",
            claudeKeyLbl: "Claude API Key",
            claudeKeyHint: "console.anthropic.com → API Keys",
            modelGemini: "Model",
            modelClaude: "Model",
            proxyLbl: "Proxy URL",
            proxyHint: "If empty, direct request (Anthropic CORS header). Otherwise, HTTPS proxy.",
            systemLbl: "System Prompt",
            optional: "optional",
            systemPh: "You are a helpful and concise assistant…",
            proxyPh: "https://my-proxy.example.com",
            save: "Save",
            clear: "Clear history",
            welcomeTitle: "How can I help you?",
            setupTitle: "Setup Required",
            setupSub: "Configure your API key to get started.",
            openSettings: "Open Settings",
            newConv: "New conversation",
            you: "You",
            ai: "AI",
            aborted: "— Generation stopped",
            toastSaved: "✓ Settings saved",
            toastCleared: "✓ History cleared",
            toastError: "Error — check your API key",
            toastInvalidProxy: "Invalid proxy URL (HTTPS only, no auth/query/hash).",
            footerGemini: "Gemini may be wrong. Verify important information.",
            footerClaude: "Claude may be wrong. Verify important information.",
            s1: "Explain a complex concept simply",
            s2: "Help me write a professional email",
            s3: "Analyze and improve this code",
            s4: "Write a short creative poem",
        },
    };

    function t(key) { return (i18n[state.lang] || i18n.en)[key] || key; }

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
        const valid = ["dark", "light"];
        state.theme = valid.includes(th) ? th : "dark";
        document.documentElement.setAttribute("data-theme", state.theme);
        const icons = { dark: "🌙", light: "☀️" };
        $("themeToggle").textContent = icons[state.theme];
    }

    $("themeToggle").addEventListener("click", () => {
        const cycle = { dark: "light", light: "dark" };
        applyTheme(cycle[state.theme] || "dark");
        localStorage.setItem(LS.THEME, state.theme);
    });

    /* ─────────────────────────────────────────────────────────────────
     *  LANGUAGE
     * ────────────────────────────────────────────────────────────────*/
    function applyLang(lang) {
        state.lang = lang === "en" ? "en" : "fr";
        $("langToggle").textContent = state.lang.toUpperCase();
        updateStaticStrings();
    }

    function updateStaticStrings() {
        const el = (id, key) => { const e = $(id); if (e) e.textContent = t(key); };
        el("t-title", "title");
        el("t-history", "history");
        el("t-settings", "settings");
        el("t-provider-lbl", "providerLbl");
        el("t-gemini-key-lbl", "geminiKeyLbl");
        // t-gemini-key-hint — static HTML link, not overwritten
        el("t-claude-key-lbl", "claudeKeyLbl");
        // t-claude-key-hint — static HTML link, not overwritten
        el("t-model-gemini-lbl", "modelGemini");
        el("t-model-claude-lbl", "modelClaude");
        el("t-proxy-lbl-text", "proxyLbl");
        el("t-proxy-hint", "proxyHint");
        el("t-system-lbl-text", "systemLbl");
        el("t-optional", "optional");
        el("t-optional-2", "optional");
        el("t-save", "save");
        el("t-clear", "clear");
        el("t-welcome-title", "welcomeTitle");

        // Placeholders (language-sensitive)
        const sysArea = $("inputSystem");
        if (sysArea) sysArea.placeholder = t("systemPh");
        const proxyInput = $("inputProxyUrl");
        if (proxyInput) proxyInput.placeholder = t("proxyPh");

        // Suggestion chips
        ["s1", "s2", "s3", "s4"].forEach(k => {
            const chip = document.querySelector(`.suggestion-chip[data-prompt-key="${k}"]`);
            if (chip) chip.textContent = t(k);
        });

        // Input footer
        const footer = $("inputFooter");
        if (footer) footer.textContent = t(state.provider === "gemini" ? "footerGemini" : "footerClaude");

        updateModelBadge();
    }

    $("langToggle").addEventListener("click", () => {
        applyLang(state.lang === "fr" ? "en" : "fr");
        localStorage.setItem(LS.LANG, state.lang);
    });

    window.addEventListener("storage", e => {
        if (e.key === LS.THEME && e.newValue) applyTheme(e.newValue);
        if (e.key === LS.LANG && e.newValue) applyLang(e.newValue);
    });

    /* ─────────────────────────────────────────────────────────────────
     *  MODEL BADGE
     * ────────────────────────────────────────────────────────────────*/
    function updateModelBadge() {
        const badge = $("modelBadge");
        if (!badge) return;
        const model = state.provider === "gemini"
            ? (localStorage.getItem(LS.MODEL_GEMINI) || "gemini-2.0-flash")
            : (localStorage.getItem(LS.MODEL_CLAUDE) || "claude-sonnet-4-6");
        const fmt = model
            .replace("gemini-", "")
            .replace("claude-", "")
            .replace("-4-6", " 4.6")
            .replace("-4-5-20251001", " 4.5")
            .replace(/-preview-\d{2}-\d{2}/, " Preview")
            .replace(/-preview/, " Preview")
            .replace(/-latest/, " Latest")
            .replace(/-lite/, " Lite")
            .replace(/-/g, " ");
        badge.textContent = (state.provider === "gemini" ? "✦ " : "◆ ") + fmt;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  CONVERSATION MANAGEMENT
     * ────────────────────────────────────────────────────────────────*/
    function loadConversations() {
        try {
            const raw = localStorage.getItem(LS.CONVS);
            state.conversations = raw ? JSON.parse(raw) : [];
        } catch (_) {
            state.conversations = [];
        }
    }

    function saveConversations() {
        try {
            // Keep only the most recent MAX_CONVS
            state.conversations = state.conversations.slice(0, MAX_CONVS);
            localStorage.setItem(LS.CONVS, JSON.stringify(state.conversations));
        } catch (_) { /* localStorage full — fail silently */ }
    }

    function createConversation() {
        const conv = {
            id: "conv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
            title: "",
            createdAt: Date.now(),
            messages: [],
        };
        state.conversations.unshift(conv);
        state.currentConvId = conv.id;
        saveConversations();
        return conv;
    }

    function currentConv() {
        return state.conversations.find(c => c.id === state.currentConvId) || null;
    }

    function switchConversation(id) {
        const conv = state.conversations.find(c => c.id === id);
        if (!conv || state.isStreaming) return;
        state.currentConvId = id;
        renderMessages();
        renderHistory();
        showChatState();
    }

    function deleteConversation(id) {
        state.conversations = state.conversations.filter(c => c.id !== id);
        if (state.currentConvId === id) {
            state.currentConvId = null;
            clearMessages();
        }
        saveConversations();
        renderHistory();
        showChatState();
    }

    /* ─────────────────────────────────────────────────────────────────
     *  RELATIVE DATE
     * ────────────────────────────────────────────────────────────────*/
    function formatRelDate(ts) {
        const diff = Date.now() - ts;
        const min = Math.floor(diff / 60000);
        const hr = Math.floor(diff / 3600000);
        const day = Math.floor(diff / 86400000);
        const fr = state.lang === "fr";
        if (min < 1) return fr ? "À l'instant" : "Just now";
        if (min < 60) return fr ? `Il y a ${min}m` : `${min}m ago`;
        if (hr < 24) return fr ? `Il y a ${hr}h` : `${hr}h ago`;
        if (day < 2) return fr ? "Hier" : "Yesterday";
        if (day < 7) return fr ? `Il y a ${day}j` : `${day}d ago`;
        return new Date(ts).toLocaleDateString(fr ? "fr-FR" : "en-US", { month: "short", day: "numeric" });
    }

    /* ─────────────────────────────────────────────────────────────────
     *  HISTORY SIDEBAR
     * ────────────────────────────────────────────────────────────────*/
    function renderHistory() {
        const list = $("historyList");
        list.innerHTML = "";
        state.conversations.forEach(conv => {
            const el = document.createElement("div");
            el.className = "history-item" + (conv.id === state.currentConvId ? " active" : "");
            el.setAttribute("role", "listitem");
            el.dataset.convId = conv.id;

            const title = document.createElement("div");
            title.className = "history-title";
            title.textContent = conv.title || t("newConv");

            const date = document.createElement("div");
            date.className = "history-date";
            date.textContent = formatRelDate(conv.createdAt);

            const del = document.createElement("button");
            del.className = "history-del";
            del.textContent = "×";
            del.setAttribute("aria-label", state.lang === "fr" ? "Supprimer" : "Delete");
            del.addEventListener("click", e => { e.stopPropagation(); deleteConversation(conv.id); });

            el.appendChild(title);
            el.appendChild(date);
            el.appendChild(del);
            el.addEventListener("click", () => switchConversation(conv.id));
            list.appendChild(el);
        });
    }

    /* ─────────────────────────────────────────────────────────────────
     *  OVERLAY / WELCOME / CHAT STATE
     * ────────────────────────────────────────────────────────────────*/
    function showChatState() {
        const hasKey = hasApiKey();
        const conv = currentConv();
        const hasMsgs = conv && conv.messages.length > 0;

        const overlay = $("stateOverlay");
        const welcome = $("welcomeWrap");
        const msgWrap = $("messagesWrap");
        const inputW = $("inputWrap");

        if (!hasKey) {
            overlay.classList.remove("hidden");
            welcome.classList.add("hidden");
            msgWrap.style.display = "none";
            inputW.style.display = "none";
        } else if (!hasMsgs) {
            overlay.classList.add("hidden");
            welcome.classList.remove("hidden");
            msgWrap.style.display = "";   // keep in flex flow so inputWrap stays at bottom
            inputW.style.display = "";
        } else {
            overlay.classList.add("hidden");
            welcome.classList.add("hidden");
            msgWrap.style.display = "";
            inputW.style.display = "";
        }
    }

    function hasApiKey() {
        const key = getApiKey(state.provider);
        return !!(key && key.trim());
    }

    /* ─────────────────────────────────────────────────────────────────
     *  MESSAGES UI
     * ────────────────────────────────────────────────────────────────*/
    function clearMessages() {
        $("messages").innerHTML = "";
    }

    function renderMessages() {
        clearMessages();
        const conv = currentConv();
        if (!conv) return;
        conv.messages.forEach(msg => {
            addMessageEl(msg.role, msg.content, false);
        });
        scrollToBottom();
    }

    function scrollToBottom() {
        const wrap = $("messagesWrap");
        wrap.scrollTop = wrap.scrollHeight;
    }

    // Renders a message bubble; returns the content element for streaming updates
    function addMessageEl(role, content, streaming = false) {
        const container = $("messages");

        const msg = document.createElement("div");
        msg.className = `msg ${role}`;

        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.textContent = role === "user" ? "👤" : "✦";
        avatar.setAttribute("aria-hidden", "true");

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";

        const body = document.createElement("div");
        body.className = "msg-body";

        const contentEl = document.createElement("div");
        contentEl.className = "msg-content" + (streaming ? " streaming" : "");

        if (streaming) {
            // Raw text during stream
            contentEl.textContent = content || "";
        } else {
            // Full markdown render
            contentEl.innerHTML = parseMarkdown(content || "");
        }

        const time = document.createElement("div");
        time.className = "msg-time";
        time.textContent = new Date().toLocaleTimeString(
            state.lang === "fr" ? "fr-FR" : "en-US",
            { hour: "2-digit", minute: "2-digit" }
        );

        body.appendChild(contentEl);
        bubble.appendChild(body);
        bubble.appendChild(time);
        msg.appendChild(avatar);
        msg.appendChild(bubble);
        container.appendChild(msg);

        scrollToBottom();
        return contentEl;
    }

    function addTypingIndicator() {
        const container = $("messages");
        const msg = document.createElement("div");
        msg.className = "msg ai";
        msg.id = "typingMsg";

        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.textContent = "✦";
        avatar.setAttribute("aria-hidden", "true");

        const bubble = document.createElement("div");
        bubble.className = "msg-bubble";

        const body = document.createElement("div");
        body.className = "msg-body";

        const dots = document.createElement("div");
        dots.className = "typing-indicator";
        for (let i = 0; i < 3; i++) {
            const d = document.createElement("div");
            d.className = "typing-dot";
            dots.appendChild(d);
        }

        body.appendChild(dots);
        bubble.appendChild(body);
        msg.appendChild(avatar);
        msg.appendChild(bubble);
        container.appendChild(msg);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const el = $("typingMsg");
        if (el) el.remove();
    }

    /* ─────────────────────────────────────────────────────────────────
     *  MARKDOWN PARSER (lightweight, for AI output)
     * ────────────────────────────────────────────────────────────────*/
    function parseMarkdown(text) {
        if (!text) return "";

        // Escape HTML to prevent XSS
        let s = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Fenced code blocks — preserve internal newlines
        s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code${lang ? ` data-lang="${lang}"` : ""}>${code.trimEnd()}</code></pre>`
        );

        // Inline code
        s = s.replace(/`([^`\n]{1,200})`/g, "<code>$1</code>");

        // Bold + italic (combined)
        s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>");
        s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

        // Headings (whole-line)
        s = s.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
        s = s.replace(/^### (.+)$/gm, "<h4>$1</h4>");
        s = s.replace(/^## (.+)$/gm, "<h3>$1</h3>");
        s = s.replace(/^# (.+)$/gm, "<h2>$1</h2>");

        // Horizontal rule
        s = s.replace(/^---+$/gm, "<hr>");

        // Unordered list items
        s = s.replace(/^[ \t]*[-*+] (.+)$/gm, "<li data-ul>$1</li>");
        // Numbered list items
        s = s.replace(/^[ \t]*\d+\. (.+)$/gm, "<li data-ol>$1</li>");

        // Wrap consecutive list items
        s = s.replace(/((<li data-ul>[^\n]*<\/li>\n?)+)/g,
            m => `<ul>${m.replace(/ data-ul/g, "").trimEnd()}</ul>`);
        s = s.replace(/((<li data-ol>[^\n]*<\/li>\n?)+)/g,
            m => `<ol>${m.replace(/ data-ol/g, "").trimEnd()}</ol>`);

        // Paragraphs — split on blank lines
        const blocks = s.split(/\n\n+/);
        s = blocks.map(block => {
            const tr = block.trim();
            if (!tr) return "";
            // Don't wrap block elements in <p>
            if (/^<(h[2-4]|pre|ul|ol|hr|blockquote)/.test(tr)) return tr;
            return "<p>" + tr.replace(/\n/g, "<br>") + "</p>";
        }).join("\n");

        return s;
    }

    /* ─────────────────────────────────────────────────────────────────
     *  GEMINI API (streaming via SSE)
     * ────────────────────────────────────────────────────────────────*/
    async function streamGemini(contents, systemPrompt, model, key, signal, onChunk) {
        const safeModel = encodeURIComponent(model);
        const url = `${GEMINI_BASE}/${safeModel}:streamGenerateContent?alt=sse`;
        const body = {
            contents,
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        };
        if (systemPrompt) {
            body.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": key,
            },
            body: JSON.stringify(body),
            signal,
            referrerPolicy: "no-referrer",
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.error?.message || `Gemini HTTP ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") return;
                try {
                    const json = JSON.parse(data);
                    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) onChunk(text);
                } catch (_) { /* partial JSON — skip */ }
            }
        }
        // Flush remaining buffer
        if (buffer.startsWith("data: ")) {
            try {
                const json = JSON.parse(buffer.slice(6));
                const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) onChunk(text);
            } catch (_) { }
        }
    }

    function buildGeminiContents(messages) {
        return messages.map(m => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
        }));
    }

    /* ─────────────────────────────────────────────────────────────────
     *  CLAUDE API (streaming via SSE)
     *  Uses anthropic-dangerous-direct-browser-access header for
     *  direct browser calls. Falls back to user-configured proxy URL.
     * ────────────────────────────────────────────────────────────────*/
    async function streamClaude(messages, systemPrompt, model, key, proxyUrl, signal, onChunk) {
        const base = proxyUrl ? normalizeProxyUrl(proxyUrl) : CLAUDE_BASE;
        const url = `${base}/v1/messages`;
        const body = { model, max_tokens: 8192, messages, stream: true };
        if (systemPrompt) body.system = systemPrompt;

        const headers = {
            "Content-Type": "application/json",
            "anthropic-version": CLAUDE_VERSION,
            "x-api-key": key,
            // Allows direct browser requests without a proxy
            "anthropic-dangerous-direct-browser-access": "true",
        };

        const resp = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal,
            referrerPolicy: "no-referrer",
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.error?.message || `Claude HTTP ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") return;
                try {
                    const json = JSON.parse(data);
                    if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                        onChunk(json.delta.text);
                    }
                } catch (_) { }
            }
        }
    }

    function buildClaudeMessages(messages) {
        return messages.map(m => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
        }));
    }

    /* ─────────────────────────────────────────────────────────────────
     *  SEND MESSAGE — core logic
     * ────────────────────────────────────────────────────────────────*/
    async function sendMessage() {
        if (state.isStreaming) return;

        const input = $("msgInput");
        const text = input.value.trim();
        if (!text) return;

        // Ensure we have a conversation
        let conv = currentConv();
        if (!conv) {
            conv = createConversation();
            renderHistory();
        }

        // Set title from first user message
        if (!conv.title) {
            conv.title = text.slice(0, 52) + (text.length > 52 ? "…" : "");
        }

        // Save user message to state
        const userMsg = { role: "user", content: text, ts: Date.now() };
        conv.messages.push(userMsg);
        saveConversations();

        // Render user bubble
        showChatState();
        addMessageEl("user", text, false);

        // Clear input
        input.value = "";
        input.style.height = "auto";

        // Start streaming
        state.isStreaming = true;
        state.abortCtrl = new AbortController();
        updateSendBtn();

        // Typing indicator while waiting for first chunk
        addTypingIndicator();

        const provider = state.provider;
        const systemP = localStorage.getItem(LS.SYSTEM) || "";
        let streamBuf = "";
        let contentEl = null;
        let firstChunk = true;

        const onChunk = chunk => {
            if (firstChunk) {
                firstChunk = false;
                removeTypingIndicator();
                // Add AI bubble in streaming mode
                contentEl = addMessageEl("ai", "", true);
            }
            streamBuf += chunk;
            // Live update — raw text (fast, no markdown flicker)
            contentEl.textContent = streamBuf;
            scrollToBottom();
        };

        try {
            if (provider === "gemini") {
                const key = getApiKey("gemini");
                const model = localStorage.getItem(LS.MODEL_GEMINI) || "gemini-2.0-flash";
                const contents = buildGeminiContents(conv.messages);
                await streamGemini(contents, systemP, model, key, state.abortCtrl.signal, onChunk);
            } else {
                const key = getApiKey("claude");
                const model = localStorage.getItem(LS.MODEL_CLAUDE) || "claude-sonnet-4-6";
                const proxy = normalizeProxyUrl(localStorage.getItem(LS.PROXY) || "");
                // Exclude last assistant message from context if streaming
                const msgs = buildClaudeMessages(conv.messages);
                await streamClaude(msgs, systemP, model, key, proxy, state.abortCtrl.signal, onChunk);
            }

            // Streaming complete — finalize with markdown render
            if (contentEl && streamBuf) {
                contentEl.classList.remove("streaming");
                contentEl.innerHTML = parseMarkdown(streamBuf);
            }

            // Save AI response
            if (streamBuf) {
                conv.messages.push({ role: "assistant", content: streamBuf, ts: Date.now() });
                saveConversations();
                renderHistory();
            }

        } catch (err) {
            removeTypingIndicator();

            if (err.name === "AbortError") {
                // User stopped generation
                if (contentEl && streamBuf) {
                    contentEl.classList.remove("streaming");
                    contentEl.innerHTML = parseMarkdown(streamBuf);
                    const label = document.createElement("div");
                    label.className = "msg-aborted-label";
                    label.textContent = t("aborted");
                    contentEl.closest(".msg-bubble").appendChild(label);
                }
                if (streamBuf) {
                    conv.messages.push({ role: "assistant", content: streamBuf, ts: Date.now() });
                    saveConversations();
                    renderHistory();
                }
            } else {
                // API error
                removeTypingIndicator();
                if (!contentEl) {
                    contentEl = addMessageEl("ai", "", false);
                }
                const body = contentEl.closest(".msg-body");
                if (body) body.classList.add("error");
                contentEl.classList.remove("streaming");
                const isProxyErr = err?.message === "invalid_proxy_url";
                contentEl.textContent = isProxyErr ? t("toastInvalidProxy") : (err.message || t("toastError"));
                const label = document.createElement("div");
                label.className = "msg-error-label";
                label.textContent = "⚠ " + (state.lang === "fr"
                    ? (isProxyErr ? "Configuration invalide" : "Erreur API")
                    : (isProxyErr ? "Invalid configuration" : "API Error"));
                contentEl.closest(".msg-bubble").appendChild(label);
                showToast(isProxyErr ? t("toastInvalidProxy") : t("toastError"), 4000);
            }
        }

        state.isStreaming = false;
        state.abortCtrl = null;
        updateSendBtn();
        scrollToBottom();
    }

    function updateSendBtn() {
        const btn = $("sendBtn");
        const send = $("sendIcon");
        const stop = $("stopIcon");
        if (state.isStreaming) {
            btn.classList.add("streaming");
            send.classList.add("ui-hidden");
            stop.classList.remove("ui-hidden");
            btn.setAttribute("aria-label", "Stop generation");
            btn.title = "Stop";
        } else {
            btn.classList.remove("streaming");
            send.classList.remove("ui-hidden");
            stop.classList.add("ui-hidden");
            btn.setAttribute("aria-label", "Send message");
            btn.title = "Send (Enter)";
        }
    }

    /* ─────────────────────────────────────────────────────────────────
     *  INPUT HANDLERS
     * ────────────────────────────────────────────────────────────────*/
    const input = $("msgInput");

    input.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 130) + "px";
    });

    input.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (state.isStreaming) return;
            sendMessage();
        }
    });

    $("sendBtn").addEventListener("click", () => {
        if (state.isStreaming) {
            state.abortCtrl?.abort();
        } else {
            sendMessage();
        }
    });

    // Suggestion chips
    document.querySelectorAll(".suggestion-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const promptText = chip.textContent;
            $("msgInput").value = promptText;
            $("msgInput").dispatchEvent(new Event("input"));
            $("msgInput").focus();
        });
    });

    /* ─────────────────────────────────────────────────────────────────
     *  NEW CHAT
     * ────────────────────────────────────────────────────────────────*/
    function startNewChat() {
        if (state.isStreaming) return;
        state.currentConvId = null;
        clearMessages();
        showChatState();
        renderHistory();
        $("msgInput").focus();
    }

    $("newChatBtn").addEventListener("click", startNewChat);
    $("sidebarNewBtn").addEventListener("click", () => {
        startNewChat();
        if (state.size === "sz-m" || state.size === "sz-l") closeSidebar();
    });

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     *  SIDEBAR TOGGLE (collapsible drawer)
     * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€*/
    function openSidebar()  { $("widget").classList.add("sidebar-open"); }
    function closeSidebar() { $("widget").classList.remove("sidebar-open"); }
    function toggleSidebar() {
        if ($("widget").classList.contains("sidebar-open")) closeSidebar();
        else openSidebar();
    }

    function initSidebarState() {
        if (state.size === "sz-xl") openSidebar();
        else closeSidebar();
    }

    $("sidebarToggle").addEventListener("click", toggleSidebar);
    $("sidebarBackdrop").addEventListener("click", closeSidebar);

    // Auto-close drawer on history item click (M/L)
    document.addEventListener("click", e => {
        const item = e.target.closest(".history-item");
        if (item && (state.size === "sz-m" || state.size === "sz-l")) closeSidebar();
    });

    /* ─────────────────────────────────────────────────────────────────
     *  SETTINGS PANEL
     * ────────────────────────────────────────────────────────────────*/
    function openSettings() {
        const panel = $("settingsPanel");
        panel.classList.add("open");

        // Populate fields
        $("inputGeminiKey").value = getApiKey("gemini");
        $("inputClaudeKey").value = getApiKey("claude");
        $("inputProxyUrl").value = localStorage.getItem(LS.PROXY) || "";
        $("inputSystem").value = localStorage.getItem(LS.SYSTEM) || "";
        $("selectGeminiModel").value = localStorage.getItem(LS.MODEL_GEMINI) || "gemini-2.0-flash";
        $("selectClaudeModel").value = localStorage.getItem(LS.MODEL_CLAUDE) || "claude-sonnet-4-6";

        // Sync custom dropdowns to the values above
        syncCustomSelect($("selectGeminiModel"));
        syncCustomSelect($("selectClaudeModel"));

        activateProviderTab(state.provider);
    }

    function closeSettings() {
        $("settingsPanel").classList.remove("open");
    }

    $("settingsToggle").addEventListener("click", openSettings);
    $("closeSettings").addEventListener("click", closeSettings);

    // Provider tab switching
    document.querySelectorAll(".provider-tab").forEach(tab => {
        tab.addEventListener("click", () => activateProviderTab(tab.dataset.provider));
    });

    function activateProviderTab(provider) {
        document.querySelectorAll(".provider-tab").forEach(t => {
            t.classList.toggle("active", t.dataset.provider === provider);
        });
        $("fieldsGemini").classList.toggle("hidden", provider !== "gemini");
        $("fieldsClaude").classList.toggle("hidden", provider !== "claude");
        // Temporarily update state for badge preview
        state.provider = provider;
        updateModelBadge();
        updateStaticStrings();
    }

    $("saveBtn").addEventListener("click", () => {
        const provider = document.querySelector(".provider-tab.active")?.dataset.provider || "gemini";
        let proxy = "";
        try {
            proxy = normalizeProxyUrl($("inputProxyUrl").value);
        } catch (_) {
            showToast(t("toastInvalidProxy"), 4000);
            return;
        }

        localStorage.setItem(LS.PROVIDER, provider);
        setApiKey("gemini", $("inputGeminiKey").value);
        setApiKey("claude", $("inputClaudeKey").value);
        localStorage.setItem(LS.PROXY, proxy);
        localStorage.setItem(LS.SYSTEM, $("inputSystem").value.trim());
        localStorage.setItem(LS.MODEL_GEMINI, $("selectGeminiModel").value);
        localStorage.setItem(LS.MODEL_CLAUDE, $("selectClaudeModel").value);

        state.provider = provider;
        updateModelBadge();
        updateStaticStrings();
        closeSettings();
        showChatState();
        showToast(t("toastSaved"));
    });

    $("clearHistoryBtn").addEventListener("click", () => {
        if (state.isStreaming) return;
        state.conversations = [];
        state.currentConvId = null;
        saveConversations();
        clearMessages();
        renderHistory();
        showChatState();
        showToast(t("toastCleared"));
    });

    // Setup overlay action button
    $("stateAction").addEventListener("click", () => {
        openSettings();
    });

    /* ─────────────────────────────────────────────────────────────────
     *  RESPONSIVE SIZE DETECTION
     * ────────────────────────────────────────────────────────────────*/
    function applySize(sz) {
        if (state.sizeClass === sz) return;
        if (state.sizeClass) document.documentElement.classList.remove(state.sizeClass);
        document.documentElement.classList.add(sz);
        state.sizeClass = sz;
    }

    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(entries => {
            const w = entries[0].contentRect.width;
            if (w < 700) applySize("sz-m");
            else if (w < 1400) applySize("sz-l");
            else applySize("sz-xl");
        });
        ro.observe($("widget"));
    } else {
        const fb = () => {
            const w = $("widget").offsetWidth || window.innerWidth;
            if (w < 700) applySize("sz-m");
            else if (w < 1400) applySize("sz-l");
            else applySize("sz-xl");
        };
        window.addEventListener("resize", fb);
        fb();
    }

    /* ─────────────────────────────────────────────────────────────────
     *  SETUP OVERLAY WIRING
     * ────────────────────────────────────────────────────────────────*/
    function refreshSetupOverlay() {
        const overlay = $("stateOverlay");
        const icon = $("stateIcon");
        const title = $("stateTitle");
        const sub = $("stateSub");
        const action = $("stateAction");

        if (!hasApiKey()) {
            icon.textContent = "🤖";
            title.textContent = t("setupTitle");
            sub.textContent = t("setupSub");
            action.textContent = t("openSettings");
            action.classList.remove("ui-hidden");
            overlay.classList.remove("hidden");
        } else {
            overlay.classList.add("hidden");
        }
    }

    /* ─────────────────────────────────────────────────────────────────
     *  CUSTOM SELECT — WebView-safe dropdown replacement
     * ────────────────────────────────────────────────────────────────*/
    function syncCustomSelect(sel) {
        if (!sel || !sel._csValue) return;
        const selectedOpt = sel.options[sel.selectedIndex];
        sel._csValue.textContent = selectedOpt ? selectedOpt.text : "";
        if (sel._csList) {
            sel._csList.querySelectorAll(".custom-select-option").forEach(o => {
                o.classList.toggle("selected", o.dataset.value === sel.value);
            });
        }
    }

    function initCustomSelects() {
        document.querySelectorAll(".field select").forEach(sel => {
            // Build wrapper
            const wrapper = document.createElement("div");
            wrapper.className = "custom-select";

            // Build trigger
            const trigger = document.createElement("div");
            trigger.className = "custom-select-trigger";
            trigger.setAttribute("tabindex", "0");

            const valueSpan = document.createElement("span");
            valueSpan.className = "custom-select-value";
            valueSpan.textContent = sel.options[sel.selectedIndex]?.text || "";

            // Chevron SVG
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "10"); svg.setAttribute("height", "10");
            svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
            svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2.5");
            svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
            svg.classList.add("custom-select-arrow");
            const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            poly.setAttribute("points", "6 9 12 15 18 9");
            svg.appendChild(poly);

            trigger.appendChild(valueSpan);
            trigger.appendChild(svg);

            // Build options list
            const list = document.createElement("div");
            list.className = "custom-select-options";

            Array.from(sel.options).forEach(opt => {
                // Skip optgroup-style comments (text nodes)
                if (opt.disabled) return;
                const item = document.createElement("div");
                item.className = "custom-select-option" + (opt.selected ? " selected" : "");
                item.textContent = opt.text;
                item.dataset.value = opt.value;

                item.addEventListener("click", e => {
                    e.stopPropagation();
                    sel.value = opt.value;
                    valueSpan.textContent = opt.text;
                    list.querySelectorAll(".custom-select-option").forEach(o => o.classList.remove("selected"));
                    item.classList.add("selected");
                    wrapper.classList.remove("open");
                    sel.dispatchEvent(new Event("change"));
                });

                list.appendChild(item);
            });

            wrapper.appendChild(trigger);
            wrapper.appendChild(list);

            // Toggle open on trigger click
            trigger.addEventListener("click", e => {
                e.stopPropagation();
                const isOpen = wrapper.classList.contains("open");
                // Close all other custom selects
                document.querySelectorAll(".custom-select.open").forEach(cs => cs.classList.remove("open"));
                if (!isOpen) wrapper.classList.add("open");
            });

            // Keyboard support
            trigger.addEventListener("keydown", e => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); trigger.click(); }
                if (e.key === "Escape") wrapper.classList.remove("open");
            });

            // Store refs for syncCustomSelect
            sel._csValue = valueSpan;
            sel._csList = list;

            // Hide native select, insert custom select after it
            sel.parentNode.insertBefore(wrapper, sel.nextSibling);
        });

        // Global close on outside click
        document.addEventListener("click", () => {
            document.querySelectorAll(".custom-select.open").forEach(cs => cs.classList.remove("open"));
        });
    }

    /* ─────────────────────────────────────────────────────────────────
     *  INIT
     * ────────────────────────────────────────────────────────────────*/
    function init() {
        enforceSameOriginFrame();
        migrateLegacyApiKeys();
        applyTheme(state.theme);
        applyLang(state.lang);

        loadConversations();

        // Auto-select most recent conversation on load
        if (state.conversations.length > 0) {
            state.currentConvId = state.conversations[0].id;
            renderMessages();
        }

        updateModelBadge();
        updateStaticStrings();
        initCustomSelects();   // replace native selects with WebView-safe dropdowns
        initSidebarState();    // open sidebar on XL, closed on M/L by default
        refreshSetupOverlay();
        renderHistory();
        showChatState();

        // Focus input if ready
        if (hasApiKey()) {
            setTimeout(() => $("msgInput").focus(), 100);
        }
    }

    init();
})();
