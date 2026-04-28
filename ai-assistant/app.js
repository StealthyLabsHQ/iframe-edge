(() => {
    "use strict";

    /* ─────────────────────────────────────────────────────────────────
     *  CONSTANTS
     * ────────────────────────────────────────────────────────────────*/
    const LS = {
        THEME: "pa_theme",
        PROVIDER: "pa_ai_provider",
        KEY_GEMINI: "pa_ai_key_gemini",
        KEY_CLAUDE: "pa_ai_key_claude",
        KEY_OPENAI: "pa_ai_key_openai",
        MODEL_GEMINI: "pa_ai_model_gemini",
        MODEL_CLAUDE: "pa_ai_model_claude",
        MODEL_OPENAI: "pa_ai_model_openai",
        PROXY: "pa_ai_proxy_url",
        SYSTEM: "pa_ai_system_prompt",
        CONVS: "pa_ai_conversations",
        GEMINI_TEMP: "pa_ai_gemini_temp",
        GEMINI_TOPP: "pa_ai_gemini_topp",
        GEMINI_OUTPUT_LEN: "pa_ai_gemini_output_len",
        GEMINI_STOP: "pa_ai_gemini_stop",
        GEMINI_MEDIA: "pa_ai_gemini_media",
        GEMINI_THINKING: "pa_ai_gemini_thinking",
        GEMINI_CODE_EXEC: "pa_ai_gemini_code_exec",
        GEMINI_SEARCH: "pa_ai_gemini_search",
        GEMINI_MAPS: "pa_ai_gemini_maps",
        GEMINI_URL_CTX: "pa_ai_gemini_url_ctx",
        GEMINI_STRUCTURED: "pa_ai_gemini_structured",
        GEMINI_FUNC_CALL: "pa_ai_gemini_func_call",
    };
    const SS = {
        KEY_GEMINI: "pa_ai_key_gemini_session",
        KEY_CLAUDE: "pa_ai_key_claude_session",
        KEY_OPENAI: "pa_ai_key_openai_session",
    };

    const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
    const CLAUDE_BASE = "https://api.anthropic.com";
    const CLAUDE_VERSION = "2023-06-01";
    const OPENAI_BASE = "https://api.openai.com";
    const MAX_CONVS = 20;

    const $ = id => document.getElementById(id);

    function pathValue(root, keys) {
        let current = root;
        for (const key of keys) {
            if (current == null) return undefined;
            current = current[key];
        }
        return current;
    }

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
        lang: "en",
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
        if (provider === "gemini") return SS.KEY_GEMINI;
        if (provider === "openai") return SS.KEY_OPENAI;
        return SS.KEY_CLAUDE;
    }

    function legacyKeyForProvider(provider) {
        if (provider === "gemini") return LS.KEY_GEMINI;
        if (provider === "openai") return LS.KEY_OPENAI;
        return LS.KEY_CLAUDE;
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
        getApiKey("openai");
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
            footerOpenAI: "ChatGPT may be wrong. Verify important information.",
            openaiKeyLbl: "OpenAI API Key",
            openaiKeyHint: "platform.openai.com → API Keys",
            modelOpenAI: "Model",
            s1: "Explain a complex concept simply",
            s2: "Help me write a professional email",
            s3: "Analyze and improve this code",
            s4: "Write a short creative poem",
            geminiTemp: "Temperature",
            geminiMedia: "Media resolution",
            geminiThinking: "Thinking level",
            geminiTools: "Tools",
            geminiStructured: "Structured outputs",
            geminiCodeExec: "Code execution",
            geminiFuncCall: "Function calling",
            geminiSearch: "Grounding with Google Search",
            geminiMaps: "Grounding with Google Maps",
            geminiUrl: "URL context",
            geminiAdvanced: "Advanced settings",
            geminiStop: "Add stop sequence",
            geminiStopPh: "Add stop...",
            geminiOutputLen: "Output length",
            geminiTopP: "Top P",
            mediaDefault: "Default",
            mediaLow: "Low",
            mediaMedium: "Medium",
            mediaHigh: "High",
            thinkingNone: "None",
            thinkingLow: "Low",
            thinkingMedium: "Medium",
            thinkingHigh: "High",
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
    function applyLang() {
        state.lang = "en";
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
        el("t-openai-key-lbl", "openaiKeyLbl");
        // t-openai-key-hint — static HTML link, not overwritten
        el("t-model-gemini-lbl", "modelGemini");
        el("t-model-claude-lbl", "modelClaude");
        el("t-model-openai-lbl", "modelOpenAI");
        el("t-proxy-lbl-text", "proxyLbl");
        el("t-proxy-hint", "proxyHint");
        el("t-system-lbl-text", "systemLbl");
        el("t-optional", "optional");
        el("t-optional-2", "optional");
        el("t-save", "save");
        el("t-clear", "clear");
        el("t-welcome-title", "welcomeTitle");

        // Gemini settings labels
        el("t-gemini-temp-lbl", "geminiTemp");
        el("t-gemini-media-lbl", "geminiMedia");
        el("t-gemini-thinking-lbl", "geminiThinking");
        el("t-gemini-tools-lbl", "geminiTools");
        el("t-gemini-structured", "geminiStructured");
        el("t-gemini-code-exec", "geminiCodeExec");
        el("t-gemini-func-call", "geminiFuncCall");
        el("t-gemini-search", "geminiSearch");
        el("t-gemini-maps", "geminiMaps");
        el("t-gemini-url", "geminiUrl");
        el("t-gemini-advanced-lbl", "geminiAdvanced");
        el("t-gemini-stop-lbl", "geminiStop");
        el("t-gemini-output-lbl", "geminiOutputLen");
        el("t-gemini-topp-lbl", "geminiTopP");

        // Gemini placeholders
        const stopInput = $("inputGeminiStop");
        if (stopInput) stopInput.placeholder = t("geminiStopPh");

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
        if (footer) footer.textContent = t(
            state.provider === "gemini" ? "footerGemini" :
                state.provider === "openai" ? "footerOpenAI" : "footerClaude"
        );

        updateModelBadge();
    }

    window.addEventListener("storage", e => {
        if (e.key === LS.THEME && e.newValue) applyTheme(e.newValue);
    });

    /* ─────────────────────────────────────────────────────────────────
     *  MODEL BADGE
     * ────────────────────────────────────────────────────────────────*/
    function updateModelBadge() {
        const badge = $("modelBadge");
        if (!badge) return;
        const model = state.provider === "gemini"
            ? (localStorage.getItem(LS.MODEL_GEMINI) || "gemini-2.0-flash")
            : state.provider === "openai"
                ? (localStorage.getItem(LS.MODEL_OPENAI) || "gpt-4o")
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
        if (min < 1) return "Just now";
        if (min < 60) return `${min}m ago`;
        if (hr < 24) return `${hr}h ago`;
        if (day < 2) return "Yesterday";
        if (day < 7) return `${day}d ago`;
        return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
            del.setAttribute("aria-label", "Delete");
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
            "en-US",
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
    function readGeminiConfig() {
        const temperature = parseFloat(localStorage.getItem(LS.GEMINI_TEMP)) || 1;
        const topP = parseFloat(localStorage.getItem(LS.GEMINI_TOPP) || "0.95");
        const maxOutputTokens = parseInt(localStorage.getItem(LS.GEMINI_OUTPUT_LEN), 10) || 65536;
        const stopRaw = (localStorage.getItem(LS.GEMINI_STOP) || "").trim();
        const stopSequences = stopRaw ? stopRaw.split(",").map(s => s.trim()).filter(Boolean) : [];
        const mediaResolution = localStorage.getItem(LS.GEMINI_MEDIA) || "default";
        const thinkingLevel = localStorage.getItem(LS.GEMINI_THINKING) || "high";
        return {
            temperature, topP, maxOutputTokens, stopSequences, mediaResolution, thinkingLevel,
            codeExecution: localStorage.getItem(LS.GEMINI_CODE_EXEC) === "1",
            googleSearch: localStorage.getItem(LS.GEMINI_SEARCH) === "1",
            googleMaps: localStorage.getItem(LS.GEMINI_MAPS) === "1",
            urlContext: localStorage.getItem(LS.GEMINI_URL_CTX) === "1",
            structuredOutputs: localStorage.getItem(LS.GEMINI_STRUCTURED) === "1",
            functionCalling: localStorage.getItem(LS.GEMINI_FUNC_CALL) === "1",
        };
    }

    async function streamGemini(contents, systemPrompt, model, key, signal, onChunk) {
        const safeModel = encodeURIComponent(model);
        const url = `${GEMINI_BASE}/${safeModel}:streamGenerateContent?alt=sse`;
        const cfg = readGeminiConfig();

        const generationConfig = {
            maxOutputTokens: cfg.maxOutputTokens,
            temperature: cfg.temperature,
            topP: cfg.topP,
        };
        if (cfg.stopSequences.length > 0) {
            generationConfig.stopSequences = cfg.stopSequences;
        }
        if (cfg.mediaResolution !== "default") {
            const mediaMap = { low: "MEDIA_RESOLUTION_LOW", medium: "MEDIA_RESOLUTION_MEDIUM", high: "MEDIA_RESOLUTION_HIGH" };
            generationConfig.mediaResolution = mediaMap[cfg.mediaResolution];
        }
        if (cfg.structuredOutputs) {
            generationConfig.responseMimeType = "application/json";
        }

        // Thinking config
        const thinkingBudgets = { none: 0, low: 1024, medium: 8192, high: 24576 };
        if (cfg.thinkingLevel in thinkingBudgets) {
            generationConfig.thinkingConfig = { thinkingBudget: thinkingBudgets[cfg.thinkingLevel] };
        }

        const body = { contents, generationConfig };

        // Tools
        const tools = [];
        if (cfg.codeExecution) tools.push({ codeExecution: {} });
        if (cfg.googleSearch) tools.push({ googleSearch: {} });
        if (cfg.googleMaps) tools.push({ googleSearch: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC" } } });
        if (cfg.urlContext) tools.push({ urlContext: {} });
        if (tools.length > 0) body.tools = tools;

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
            throw new Error(pathValue(err, ["error", "message"]) || `Gemini HTTP ${resp.status}`);
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
                    const text = pathValue(json, ["candidates", 0, "content", "parts", 0, "text"]);
                    if (text) onChunk(text);
                } catch (_) { /* partial JSON — skip */ }
            }
        }
        // Flush remaining buffer
        if (buffer.startsWith("data: ")) {
            try {
                const json = JSON.parse(buffer.slice(6));
                const text = pathValue(json, ["candidates", 0, "content", "parts", 0, "text"]);
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
            throw new Error(pathValue(err, ["error", "message"]) || `Claude HTTP ${resp.status}`);
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
                    if (json.type === "content_block_delta" && json.delta && json.delta.type === "text_delta") {
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
     *  OPENAI STREAMING
     *  Standard SSE via /v1/chat/completions with stream: true
     * ────────────────────────────────────────────────────────────────*/
    async function streamOpenAI(messages, systemPrompt, model, key, signal, onChunk) {
        const url = `${OPENAI_BASE}/v1/chat/completions`;
        const msgs = [];
        if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
        msgs.push(...messages);

        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`,
            },
            body: JSON.stringify({ model, messages: msgs, stream: true, max_completion_tokens: 8192 }),
            signal,
            referrerPolicy: "no-referrer",
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(pathValue(err, ["error", "message"]) || `OpenAI HTTP ${resp.status}`);
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
                    const text = pathValue(json, ["choices", 0, "delta", "content"]);
                    if (text) onChunk(text);
                } catch (_) { }
            }
        }
    }

    function buildOpenAIMessages(messages) {
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
            } else if (provider === "openai") {
                const key = getApiKey("openai");
                const model = localStorage.getItem(LS.MODEL_OPENAI) || "gpt-4o";
                const msgs = buildOpenAIMessages(conv.messages);
                await streamOpenAI(msgs, systemP, model, key, state.abortCtrl.signal, onChunk);
            } else {
                const key = getApiKey("claude");
                const model = localStorage.getItem(LS.MODEL_CLAUDE) || "claude-sonnet-4-6";
                const proxy = normalizeProxyUrl(localStorage.getItem(LS.PROXY) || "");
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
                const isProxyErr = err && err.message === "invalid_proxy_url";
                contentEl.textContent = isProxyErr ? t("toastInvalidProxy") : (err.message || t("toastError"));
                const label = document.createElement("div");
                label.className = "msg-error-label";
                label.textContent = "⚠ " + (isProxyErr ? "Invalid configuration" : "API Error");
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
            if (state.abortCtrl) state.abortCtrl.abort();
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
    function openSidebar() { $("widget").classList.add("sidebar-open"); }
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
        $("inputOpenAIKey").value = getApiKey("openai");
        $("inputProxyUrl").value = localStorage.getItem(LS.PROXY) || "";
        $("inputSystem").value = localStorage.getItem(LS.SYSTEM) || "";
        $("selectGeminiModel").value = localStorage.getItem(LS.MODEL_GEMINI) || "gemini-2.0-flash";
        $("selectClaudeModel").value = localStorage.getItem(LS.MODEL_CLAUDE) || "claude-sonnet-4-6";
        $("selectOpenAIModel").value = localStorage.getItem(LS.MODEL_OPENAI) || "gpt-4o";

        // Gemini settings
        const gTemp = parseFloat(localStorage.getItem(LS.GEMINI_TEMP)) || 1;
        $("geminiTemp").value = gTemp;
        $("geminiTempVal").value = gTemp;
        const gTopP = parseFloat(localStorage.getItem(LS.GEMINI_TOPP) || "0.95");
        $("geminiTopP").value = gTopP;
        $("geminiTopPVal").value = gTopP;
        $("inputGeminiOutputLen").value = localStorage.getItem(LS.GEMINI_OUTPUT_LEN) || "65536";
        $("inputGeminiStop").value = localStorage.getItem(LS.GEMINI_STOP) || "";
        $("selectGeminiMedia").value = localStorage.getItem(LS.GEMINI_MEDIA) || "default";
        $("selectGeminiThinking").value = localStorage.getItem(LS.GEMINI_THINKING) || "high";
        $("chkCodeExec").checked = localStorage.getItem(LS.GEMINI_CODE_EXEC) === "1";
        $("chkGoogleSearch").checked = localStorage.getItem(LS.GEMINI_SEARCH) === "1";
        $("chkGoogleMaps").checked = localStorage.getItem(LS.GEMINI_MAPS) === "1";
        $("chkUrlContext").checked = localStorage.getItem(LS.GEMINI_URL_CTX) === "1";
        $("chkStructured").checked = localStorage.getItem(LS.GEMINI_STRUCTURED) === "1";
        $("chkFuncCall").checked = localStorage.getItem(LS.GEMINI_FUNC_CALL) === "1";

        // Sync custom dropdowns to the values above
        syncCustomSelect($("selectGeminiModel"));
        syncCustomSelect($("selectClaudeModel"));
        syncCustomSelect($("selectOpenAIModel"));
        syncCustomSelect($("selectGeminiMedia"));
        syncCustomSelect($("selectGeminiThinking"));

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
        $("fieldsOpenAI").classList.toggle("hidden", provider !== "openai");
        // Temporarily update state for badge preview
        state.provider = provider;
        updateModelBadge();
        updateStaticStrings();
    }

    $("saveBtn").addEventListener("click", () => {
        const activeProviderTab = document.querySelector(".provider-tab.active");
        const provider = activeProviderTab ? activeProviderTab.dataset.provider : "gemini";
        let proxy = "";
        try {
            proxy = normalizeProxyUrl($("inputProxyUrl").value);
        } catch (_) {
            showToast(t("toastInvalidProxy"), 4000);
            return;
        }

        // Resolve __custom__ sentinel for all three providers
        const rawGeminiModel = $("selectGeminiModel").value;
        const geminiModel = rawGeminiModel === "__custom__"
            ? (($("inputGeminiCustomModel") && $("inputGeminiCustomModel").value.trim()) || "gemini-2.0-flash")
            : rawGeminiModel;

        const rawClaudeModel = $("selectClaudeModel").value;
        const claudeModel = rawClaudeModel === "__custom__"
            ? (($("inputClaudeCustomModel") && $("inputClaudeCustomModel").value.trim()) || "claude-sonnet-4-6")
            : rawClaudeModel;

        const rawOpenAIModel = $("selectOpenAIModel").value;
        const openaiModel = rawOpenAIModel === "__custom__"
            ? (($("inputOpenAICustomModel") && $("inputOpenAICustomModel").value.trim()) || "gpt-4o")
            : rawOpenAIModel;

        localStorage.setItem(LS.PROVIDER, provider);
        setApiKey("gemini", $("inputGeminiKey").value);
        setApiKey("claude", $("inputClaudeKey").value);
        setApiKey("openai", $("inputOpenAIKey").value);
        localStorage.setItem(LS.PROXY, proxy);
        localStorage.setItem(LS.SYSTEM, $("inputSystem").value.trim());
        localStorage.setItem(LS.MODEL_GEMINI, geminiModel);
        localStorage.setItem(LS.MODEL_CLAUDE, claudeModel);
        localStorage.setItem(LS.MODEL_OPENAI, openaiModel);

        // Gemini settings
        localStorage.setItem(LS.GEMINI_TEMP, $("geminiTempVal").value);
        localStorage.setItem(LS.GEMINI_TOPP, $("geminiTopPVal").value);
        localStorage.setItem(LS.GEMINI_OUTPUT_LEN, $("inputGeminiOutputLen").value);
        localStorage.setItem(LS.GEMINI_STOP, $("inputGeminiStop").value.trim());
        localStorage.setItem(LS.GEMINI_MEDIA, $("selectGeminiMedia").value);
        localStorage.setItem(LS.GEMINI_THINKING, $("selectGeminiThinking").value);
        localStorage.setItem(LS.GEMINI_CODE_EXEC, $("chkCodeExec").checked ? "1" : "0");
        localStorage.setItem(LS.GEMINI_SEARCH, $("chkGoogleSearch").checked ? "1" : "0");
        localStorage.setItem(LS.GEMINI_MAPS, $("chkGoogleMaps").checked ? "1" : "0");
        localStorage.setItem(LS.GEMINI_URL_CTX, $("chkUrlContext").checked ? "1" : "0");
        localStorage.setItem(LS.GEMINI_STRUCTURED, $("chkStructured").checked ? "1" : "0");
        localStorage.setItem(LS.GEMINI_FUNC_CALL, $("chkFuncCall").checked ? "1" : "0");

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
     *  SLIDER SYNC (range ↔ number input)
     * ────────────────────────────────────────────────────────────────*/
    function linkSlider(rangeId, numId) {
        const range = $(rangeId);
        const num = $(numId);
        if (!range || !num) return;
        range.addEventListener("input", () => { num.value = range.value; });
        num.addEventListener("input", () => {
            const v = parseFloat(num.value);
            if (!isNaN(v)) range.value = Math.min(Math.max(v, parseFloat(range.min)), parseFloat(range.max));
        });
    }
    linkSlider("geminiTemp", "geminiTempVal");
    linkSlider("geminiTopP", "geminiTopPVal");

    /* ─────────────────────────────────────────────────────────────────
     *  COLLAPSIBLE SECTIONS
     * ────────────────────────────────────────────────────────────────*/
    document.querySelectorAll(".section-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const body = btn.nextElementSibling;
            const isOpen = body.classList.contains("open");
            body.classList.toggle("open", !isOpen);
            btn.setAttribute("aria-expanded", !isOpen);
        });
    });

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
            valueSpan.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";

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

            // Build options list — support <optgroup>
            const list = document.createElement("div");
            list.className = "custom-select-options";

            // Resolve the custom input associated with this select (if any)
            const customInput = sel.parentNode.querySelector(".custom-model-input");

            // Helper: toggle custom model input visibility
            function toggleCustomInput(isCustom) {
                if (!customInput) return;
                if (isCustom) customInput.classList.remove("ui-hidden");
                else customInput.classList.add("ui-hidden");
            }

            // Iterate children of select: optgroup or option
            Array.from(sel.children).forEach(child => {
                if (child.tagName === "OPTGROUP") {
                    // Group label
                    const label = document.createElement("div");
                    label.className = "custom-select-group-label";
                    label.textContent = child.label;
                    list.appendChild(label);

                    // Group options
                    Array.from(child.children).forEach(opt => {
                        if (opt.disabled) return;
                        const item = document.createElement("div");
                        item.className = "custom-select-option" + (opt.selected ? " selected" : "");
                        item.textContent = opt.text;
                        item.dataset.value = opt.value;
                        item.addEventListener("click", e => {
                            e.stopPropagation();
                            sel.value = opt.value;
                            valueSpan.textContent = opt.value === "__custom__"
                                ? ((customInput && customInput.value) || opt.text)
                                : opt.text;
                            list.querySelectorAll(".custom-select-option").forEach(o => o.classList.remove("selected"));
                            item.classList.add("selected");
                            wrapper.classList.remove("open");
                            toggleCustomInput(opt.value === "__custom__");
                            if (opt.value === "__custom__" && customInput) setTimeout(() => customInput.focus(), 50);
                            sel.dispatchEvent(new Event("change"));
                        });
                        list.appendChild(item);
                    });
                } else if (child.tagName === "OPTION") {
                    if (child.disabled) return;
                    const item = document.createElement("div");
                    item.className = "custom-select-option" + (child.selected ? " selected" : "");
                    item.textContent = child.text;
                    item.dataset.value = child.value;
                    item.addEventListener("click", e => {
                        e.stopPropagation();
                        sel.value = child.value;
                        valueSpan.textContent = child.text;
                        list.querySelectorAll(".custom-select-option").forEach(o => o.classList.remove("selected"));
                        item.classList.add("selected");
                        wrapper.classList.remove("open");
                        toggleCustomInput(child.value === "__custom__");
                        if (child.value === "__custom__" && customInput) setTimeout(() => customInput.focus(), 50);
                        sel.dispatchEvent(new Event("change"));
                    });
                    list.appendChild(item);
                }
            });

            // Update trigger label when custom input is typed
            if (customInput) {
                customInput.addEventListener("input", () => {
                    if (sel.value === "__custom__") valueSpan.textContent = customInput.value || "Custom…";
                });
            }

            wrapper.appendChild(trigger);
            wrapper.appendChild(list);

            // Toggle open on trigger click
            trigger.addEventListener("click", e => {
                e.stopPropagation();
                const isOpen = wrapper.classList.contains("open");
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

            // Initialise custom input visibility
            toggleCustomInput(sel.value === "__custom__");
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
        // Note: enforceSameOriginFrame() intentionally not called —
        // this widget runs inside iCUE's native WebView (cross-origin by nature).
        migrateLegacyApiKeys();
        applyTheme(state.theme);
        applyLang();

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
