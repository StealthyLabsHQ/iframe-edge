(() => {
    "use strict";

    /* -------------------------------------------------------------------------
     *  CONSTANTS & STATE
     * ------------------------------------------------------------------------*/
    const LRCLIB_BASE = "https://lrclib.net/api/get";
    const LRCLIB_SEARCH = "https://lrclib.net/api/search";
    const DEFAULT_AUTH_WORKER_URL = "https://spotify-auth-worker.code-39c.workers.dev";
    const POLL_MS = 1500;
    const CONNECTING_OVERLAY_FAILURES = 4;
    const OFFLINE_OVERLAY_FAILURES = 10;
    const LYRICS_CACHE_LIMIT = 24;
    const LYRICS_FETCH_TIMEOUT_MS = 8000;

    const LS = {
        THEME: "pa_theme",
        CID: "pa_spotify_client_id",
        RTOKEN: "pa_spotify_refresh_token",
        RTOKEN_ICUE: "pa_spotify_refresh_token_icue",
        PAIRING_CODE: "pa_spotify_pairing_code",
        SESSION_TOKEN: "pa_spotify_session_token",
        AUTH_WORKER_URL: "pa_spotify_auth_worker_url",
        LAST_TRACK: "pa_spotify_last_track",
        LYRICS_CACHE: "pa_spotify_lyrics_cache_v1",
    };
    const $ = id => document.getElementById(id);

    let state = {
        isPlaying: false,
        trackId: null,
        progressMs: 0,
        durationMs: 0,
        lastPollTime: 0,
        pollTimer: null,
        progressTimer: null,
        lyricsData: [],       // [{timeMs, text}]
        lyricsTrackId: null,
        lyricsLoadingTrackId: null,
        shuffleOn: false,          // Spotify shuffle state
        repeatMode: "off",         // "off" | "context" | "track"
        autoScroll: true,          // auto-follow active lyric line
        autoScrollResumeTimer: null,
        sizeClass: '',             // 'sz-m' | 'sz-l' | 'sz-xl'
        connectionFailures: 0,
        pairingCode: localStorage.getItem(LS.PAIRING_CODE) || "",
        sessionToken: localStorage.getItem(LS.SESSION_TOKEN) || "",
        authWorkerUrl: DEFAULT_AUTH_WORKER_URL,
        theme: localStorage.getItem(LS.THEME) || "dark", // "dark" | "light" | "blur"
        lang: "en",
        volume: 100,
        volumeBeforeMute: 100,     // last non-zero volume for mute toggle
        volumeDebounce: null,
        volumeDragging: false,     // true while user is dragging the slider
        resetPairingSeen: false,
        clientId: localStorage.getItem(LS.CID) || "",
    };

    function getPairingCode() {
        return state.pairingCode || "";
    }

    function getSessionToken() {
        return state.sessionToken || "";
    }

    function getClientId() {
        return state.clientId || "";
    }

    function getAuthWorkerUrl() {
        return DEFAULT_AUTH_WORKER_URL;
    }

    function setPairingCode(value) {
        const code = String(value || "").trim().toUpperCase();
        state.pairingCode = code;
        if (code) localStorage.setItem(LS.PAIRING_CODE, code);
        else localStorage.removeItem(LS.PAIRING_CODE);
    }

    function clearPairingCode() {
        setPairingCode("");
    }

    function setSessionToken(value) {
        const token = String(value || "").trim();
        state.sessionToken = token;
        if (token) localStorage.setItem(LS.SESSION_TOKEN, token);
        else localStorage.removeItem(LS.SESSION_TOKEN);
    }

    function clearSessionToken() {
        setSessionToken("");
    }

    function setClientId(value) {
        const clientId = String(value || "").trim();
        if (clientId === state.clientId) return false;
        state.clientId = clientId;
        if (clientId) localStorage.setItem(LS.CID, clientId);
        else localStorage.removeItem(LS.CID);
        clearSessionToken();
        clearPairingCode();
        return true;
    }

    function setAuthWorkerUrl(value) {
        state.authWorkerUrl = DEFAULT_AUTH_WORKER_URL;
        localStorage.removeItem(LS.AUTH_WORKER_URL);
    }

    function readIcueProperty(name) {
        if (!["spotifyClientId", "spotifyResetPairing"].includes(name)) {
            return { found: false, value: undefined };
        }
        if (typeof window !== "undefined" && Object.prototype.hasOwnProperty.call(window, name)) {
            return { found: true, value: window[name] };
        }
        return { found: false, value: undefined };
    }

    function readIcueString(name) {
        const prop = readIcueProperty(name);
        if (!prop.found) return null;
        return String(prop.value || "").trim();
    }

    function resetServerPairing(sessionToken, pairingCode) {
        const token = sessionToken || "";
        const code = pairingCode || "";
        if (!token && !code) return;
        const param = token
            ? "session_token=" + encodeURIComponent(token)
            : "pairing_code=" + encodeURIComponent(code);
        fetch(getAuthWorkerUrl() + "/pairings/reset?" + param, {
            method: "POST",
            cache: "no-store"
        }).catch(() => { });
    }

    function resetPairingState() {
        resetServerPairing(getSessionToken(), getPairingCode());
        clearSessionToken();
        clearPairingCode();
        clearLegacySpotifySecrets();
        state.connectionFailures = 0;
        stopPolling();
        showOverlay("KEY", t("setupTitle"), t("setupSub"), t("authorizeSpotify"), startSpotifyAuthorization);
    }

    function setIcuePairing(clientIdValue, pairingValue, workerUrlValue, resetValue) {
        let changed = false;
        const clientId = clientIdValue === undefined || clientIdValue === null ? null : String(clientIdValue || "").trim();
        if (clientId !== null && setClientId(clientId)) changed = true;
        const resetPairing = String(resetValue || "").trim().toUpperCase() === "RESET";
        if (resetPairing && !state.resetPairingSeen) {
            state.resetPairingSeen = true;
            resetPairingState();
            return true;
        }
        if (!resetPairing) state.resetPairingSeen = false;
        const pairing = pairingValue === undefined || pairingValue === null ? null : String(pairingValue || "").trim();
        const workerUrl = workerUrlValue === undefined || workerUrlValue === null ? null : String(workerUrlValue || "").trim();
        if (workerUrl && workerUrl !== getAuthWorkerUrl()) {
            setAuthWorkerUrl(workerUrl);
            changed = true;
        }
        if (pairing !== null) {
            if (pairing) {
                if (pairing !== getPairingCode()) {
                    setPairingCode(pairing);
                    changed = true;
                }
            } else if (getPairingCode()) {
                clearPairingCode();
                changed = true;
            }
        }
        return changed;
    }

    function clearLegacySpotifySecrets() {
        localStorage.removeItem(LS.RTOKEN);
        localStorage.removeItem(LS.RTOKEN_ICUE);
        sessionStorage.removeItem("pa_spotify_refresh_token_session");
        localStorage.removeItem("pa_spotify_refresh_token_remember");
    }

    function syncIcueCredentials() {
        return setIcuePairing(readIcueString("spotifyClientId"), undefined, undefined, readIcueString("spotifyResetPairing"));
    }

    function syncIcueInlineBridge(options) {
        if (window.SpotifyVisualizerIcue && typeof window.SpotifyVisualizerIcue.syncFromIcue === "function") {
            return window.SpotifyVisualizerIcue.syncFromIcue(options);
        }
        return syncIcueCredentials(options);
    }

    function handleIcueSettingsUpdate(options) {
        const changed = syncIcueInlineBridge(options);
        if (getSessionToken() || getPairingCode()) {
            restoreLastTrackSnapshot();
            if (!state.pollTimer) startPolling();
            else if (changed) poll();
            return;
        }
        stopPolling();
        showCredentialSetupOverlay();
    }

    window.SpotifyVisualizerIcue = {
        onInitialized: function () { handleIcueSettingsUpdate({ clearEmpty: true }); },
        onDataUpdated: function () { handleIcueSettingsUpdate({ clearEmpty: false }); },
        setCredentials: function () { return false; },
        setPairing: setIcuePairing,
        resetPairing: resetPairingState,
    };

    /* -------------------------------------------------------------------------
     *  i18n
     * ------------------------------------------------------------------------*/
    const i18n = {
        en: {
            title: "Spotify",
            lyricsLbl: "Lyrics",
            noSong: "Play a song to see lyrics",
            noLyrics: "Lyrics not available",
            notPlaying: "Not playing",
            notPlayingSub: "Start playback on any Spotify device.",
            setupTitle: "Setup Required",
            setupSub: "Authorize Spotify to connect this widget.",
            setupClientIdSub: "Authorize Spotify to connect this widget.",
            setupTokenSub: "Authorize Spotify to connect this widget.",
            authorizeSpotify: "Authorize Spotify",
            toastError: "Spotify connection error",
            toastReauth: "Token expired - re-authorize in settings",
            sessionTitle: "Session expired",
            sessionSub: "Your Spotify authorization was revoked or expired. Reconnect to continue.",
            reconnect: "Reconnect",
            missingClientId: "Add your Client ID in iCUE settings first",
            connectingTitle: "Connecting to Spotify",
            connectingSub: "Reconnecting after widget switch...",
            offlineTitle: "Spotify connection unavailable",
            offlineSub: "Keeping the last track visible. Retrying automatically...",
        },
    };

    function t(key) { return (i18n[state.lang] || i18n.en)[key] || key; }

    /* -------------------------------------------------------------------------
     *  TOAST
     * ------------------------------------------------------------------------*/
    function showToast(msg, dur = 3000) {
        const el = $("toast");
        el.textContent = msg;
        el.classList.add("visible");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("visible"), dur);
    }

    // Cycle: dark -> light -> blur -> dark
    function applyTheme(th) {
        const valid = ["dark", "light", "blur"];
        state.theme = valid.includes(th) ? th : "dark";
        document.documentElement.setAttribute("data-theme", state.theme);
        const icons = { dark: "DARK", light: "LIGHT", blur: "BLUR" };
        $("themeToggle").textContent = icons[state.theme];
        // Show/hide blur background depending on mode
        refreshBgBlur();
    }

    function refreshBgBlur() {
        const bgImg = $("bgImg");
        if (!bgImg) return;
        if (state.theme === "blur" && bgImg.src && bgImg.complete && bgImg.naturalWidth > 0) {
            bgImg.style.opacity = "1";
        } else {
            bgImg.style.opacity = "0";
        }
    }

    $("themeToggle").addEventListener("click", () => {
        const cycle = { dark: "light", light: "blur", blur: "dark" };
        applyTheme(cycle[state.theme] || "dark");
        localStorage.setItem(LS.THEME, state.theme);
    });

    /* -------------------------------------------------------------------------
     *  LANGUAGE
     * ------------------------------------------------------------------------*/
    function applyLang() {
        state.lang = "en";
        updateStaticStrings();
    }

    function updateStaticStrings() {
        const el = (id, key) => { const e = $(id); if (e) e.textContent = t(key); };
        el("t-lyrics", "lyricsLbl");
        el("t-no-song", "noSong");
    }

    /* -------------------------------------------------------------------------
     *  STORAGE SYNC (cross-widget)
     * ------------------------------------------------------------------------*/
    window.addEventListener("storage", e => {
        if (e.key === LS.THEME && e.newValue) applyTheme(e.newValue);
    });

    /* -------------------------------------------------------------------------
     *  EXTERNAL AUTH LINK
     * ------------------------------------------------------------------------*/
    function hasLinkProvider() {
        return window.plugins && window.plugins.Linkprovider && typeof pluginLinkprovider_initialized !== "undefined" && pluginLinkprovider_initialized;
    }

    function waitForLinkProvider(timeoutMs = 1200) {
        if (hasLinkProvider()) return Promise.resolve(true);
        return new Promise(resolve => {
            const started = Date.now();
            const timer = setInterval(() => {
                if (hasLinkProvider()) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - started >= timeoutMs) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, 100);
        });
    }

    async function openExternalLink(url) {
        if (await waitForLinkProvider()) {
            window.plugins.Linkprovider.open(url);
            return true;
        }
        window.open(url, "_blank", "noopener,noreferrer");
        return false;
    }

    async function createPairing() {
        const clientId = getClientId();
        if (!clientId) throw new Error("missing_client_id");
        const resp = await fetch(getAuthWorkerUrl() + "/pairings?_=" + Date.now(), {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: clientId })
        });
        if (!resp.ok) throw new Error("pairing_failed");
        const data = await resp.json();
        if (!data.pairing_code || !data.authorize_url) throw new Error("pairing_invalid");
        setPairingCode(data.pairing_code);
        return data;
    }

    async function checkPairingSession() {
        if (getSessionToken()) return true;
        const code = getPairingCode();
        if (!code) return false;
        const resp = await fetch(getAuthWorkerUrl() + "/session?pairing_code=" + encodeURIComponent(code) + "&_=" + Date.now(), { cache: "no-store" });
        if (!resp.ok) return false;
        const data = await resp.json();
        if (data.session_token) {
            setSessionToken(data.session_token);
            clearPairingCode();
        }
        return !!data.connected;
    }

    async function pairingExists() {
        const code = getPairingCode();
        if (!code) return false;
        try {
            const resp = await fetch(getAuthWorkerUrl() + "/session?pairing_code=" + encodeURIComponent(code) + "&_=" + Date.now(), { cache: "no-store" });
            return resp.ok;
        } catch (_) {
            return false;
        }
    }

    async function startSpotifyAuthorization() {
        syncIcueInlineBridge();
        if (!getClientId()) {
            showToast(t("missingClientId"));
            showCredentialSetupOverlay();
            return;
        }
        try {
            const code = await pairingExists() ? getPairingCode() : "";
            const pairing = code
                ? { authorize_url: "/auth/start?pairing_code=" + encodeURIComponent(code) }
                : await createPairing();
            const authUrl = pairing.authorize_url.startsWith("http")
                ? pairing.authorize_url
                : getAuthWorkerUrl() + pairing.authorize_url;
            const openedExternally = await openExternalLink(authUrl);
            showOverlay("...", t("connectingTitle"), "Waiting for Spotify authorization...");
            if (!openedExternally) showToast("Open Spotify authorization in your browser");
            state.connectionFailures = 0;
            if (!state.pollTimer) startPolling();
        } catch (_) {
            showToast(t("toastError"));
        }
    }

    function showCredentialSetupOverlay() {
        syncIcueInlineBridge();
        if (!getClientId()) {
            showOverlay("KEY", t("setupTitle"), t("missingClientId"));
            return;
        }
        showOverlay("KEY", t("setupTitle"), t("setupSub"), t("authorizeSpotify"), startSpotifyAuthorization);
    }

    /* -------------------------------------------------------------------------
     *  STATE OVERLAY
     * ------------------------------------------------------------------------*/
    function showOverlay(icon, title, sub, btnLabel, btnCb) {
        $("stateIcon").textContent = icon;
        $("stateTitle").textContent = title;
        $("stateSub").textContent = sub;
        const btn = $("stateAction");
        if (btnLabel) {
            btn.textContent = btnLabel;
            btn.classList.remove("ui-hidden");
            btn.onclick = btnCb;
        } else {
            btn.classList.add("ui-hidden");
        }
        $("stateOverlay").classList.remove("hidden");
    }

    function hideOverlay() {
        $("stateOverlay").classList.add("hidden");
    }

    function lyricsPaneVisible() {
        const el = $("colRight");
        return !!el && getComputedStyle(el).display !== "none";
    }

    /* -------------------------------------------------------------------------
     *  SPOTIFY API - currently playing
     * ------------------------------------------------------------------------*/
    async function fetchCurrentlyPlaying() {
        let sessionToken = getSessionToken();
        if (!sessionToken && await checkPairingSession()) sessionToken = getSessionToken();
        if (sessionToken) {
            try {
                const url = getAuthWorkerUrl() + "/spotify/player?session_token=" + encodeURIComponent(sessionToken) + "&_=" + Date.now();
                const resp = await fetch(url, { cache: "no-store" });
                if (resp.status === 204) return { is_playing: false };
                if (!resp.ok) {
                    const body = await resp.json().catch(() => ({}));
                    return { spotifyError: true, status: resp.status, code: body.error || "spotify_player_error" };
                }
                return await resp.json();
            } catch (_) {
                return { spotifyError: true, status: 0, code: "network_error" };
            }
        }
        return { spotifyError: true, status: 401, code: "missing_session" };
    }

    /* -------------------------------------------------------------------------
     *  SPOTIFY API - playback controls
     * ------------------------------------------------------------------------*/
    async function spotifyAction(method, endpoint) {
        let sessionToken = getSessionToken();
        if (!sessionToken && await checkPairingSession()) sessionToken = getSessionToken();
        if (sessionToken) {
            try {
                const url = getAuthWorkerUrl() + "/spotify/action?session_token=" + encodeURIComponent(sessionToken) +
                    "&method=" + encodeURIComponent(method) + "&endpoint=" + encodeURIComponent(endpoint) + "&_=" + Date.now();
                await fetch(url, { method: "POST", cache: "no-store" });
                poll();
                pollUntilTrackChanges();
            } catch (_) { }
            return;
        }
    }

    // After a skip, poll at short intervals until Spotify reflects the new track.
    // Each scheduled poll bails out early if the track already changed, avoiding wasted calls.
    function pollUntilTrackChanges() {
        const prevId = state.trackId;
        [150, 400, 800, 1300, 2100, 3200, 5000].forEach(ms => {
            setTimeout(() => {
                if (state.trackId !== prevId) return; // already updated
                poll();
            }, ms);
        });
    }

    // Keep current track visible while Spotify applies the skip.
    function clearOnSkip() {
        state.progressMs = 0;
        renderProgress();
    }

    $("prevBtn").addEventListener("click", () => { clearOnSkip(); spotifyAction("POST", "/me/player/previous"); });
    $("nextBtn").addEventListener("click", () => { clearOnSkip(); spotifyAction("POST", "/me/player/next"); });
    $("playBtn").addEventListener("click", () => {
        if (state.isPlaying) {
            spotifyAction("PUT", "/me/player/pause");
        } else {
            spotifyAction("PUT", "/me/player/play");
        }
    });

    // Shuffle: toggle on/off
    $("shuffleBtn").addEventListener("click", async () => {
        const newState = !state.shuffleOn;
        await spotifyAction("PUT", `/me/player/shuffle?state=${newState}`);
        state.shuffleOn = newState;
        updateShuffleRepeat();
    });

    // Repeat: cycle off -> context (all) -> track (one) -> off
    $("repeatBtn").addEventListener("click", async () => {
        const modes = ["off", "context", "track"];
        const idx = modes.indexOf(state.repeatMode || "off");
        const next = modes[(idx + 1) % modes.length];
        await spotifyAction("PUT", `/me/player/repeat?state=${next}`);
        state.repeatMode = next;
        updateShuffleRepeat();
    });

    function updateShuffleRepeat() {
        const sBtn = $("shuffleBtn");
        const rBtn = $("repeatBtn");
        if (!sBtn || !rBtn) return;
        // Shuffle
        sBtn.classList.toggle("shuffle-on", !!state.shuffleOn);
        // Repeat
        const mode = state.repeatMode || "off";
        rBtn.classList.toggle("repeat-on", mode !== "off");
        rBtn.dataset.mode = mode;
        // Tooltip showing current state
        rBtn.title = mode === "off" ? "Repeat: off" : mode === "context" ? "Repeat: all" : "Repeat: one";
    }

    /* -------------------------------------------------------------------------
     *  VOLUME CONTROL
     * ------------------------------------------------------------------------*/
    function updateVolumeIcon(vol) {
        const icon = $("volumeIcon");
        if (!icon) return;
        if (vol === 0) {
            icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
                '<line x1="23" y1="9" x2="17" y2="15"/>' +
                '<line x1="17" y1="9" x2="23" y2="15"/>';
        } else if (vol < 50) {
            icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
                '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
        } else {
            icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
                '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
                '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';
        }
    }

    function setVolume(vol) {
        state.volume = vol;
        $("volumeSlider").value = vol;
        updateVolumeIcon(vol);
    }

    function sendVolumeToSpotify(vol) {
        clearTimeout(state.volumeDebounce);
        state.volumeDebounce = setTimeout(async () => {
            if (getSessionToken() || getPairingCode()) {
                spotifyAction("PUT", "/me/player/volume?volume_percent=" + Math.round(vol));
                return;
            }
        }, 250);
    }

    $("volumeSlider").addEventListener("mousedown", () => { state.volumeDragging = true; });
    $("volumeSlider").addEventListener("touchstart", () => { state.volumeDragging = true; }, { passive: true });
    window.addEventListener("mouseup", () => { state.volumeDragging = false; });
    window.addEventListener("touchend", () => { state.volumeDragging = false; });

    $("volumeSlider").addEventListener("input", e => {
        const vol = parseInt(e.target.value, 10);
        state.volume = vol;
        if (vol > 0) state.volumeBeforeMute = vol;
        updateVolumeIcon(vol);
        sendVolumeToSpotify(vol);
    });

    $("volumeBtn").addEventListener("click", () => {
        if (state.volume > 0) {
            state.volumeBeforeMute = state.volume;
            setVolume(0);
        } else {
            setVolume(state.volumeBeforeMute || 100);
        }
        sendVolumeToSpotify(state.volume);
    });

    /* -------------------------------------------------------------------------
     *  PROGRESS BAR interpolation
     * ------------------------------------------------------------------------*/
    function formatMs(ms) {
        const s = Math.floor(ms / 1000);
        return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }

    function startProgressTick() {
        stopProgressTick();
        state.progressTimer = setInterval(() => {
            if (!state.isPlaying) return;
            state.progressMs = Math.min(state.progressMs + 1000, state.durationMs);
            renderProgress();
            highlightLyricLine();
        }, 1000);
    }

    function stopProgressTick() {
        clearInterval(state.progressTimer);
        state.progressTimer = null;
    }

    function renderProgress() {
        const pct = state.durationMs > 0 ? (state.progressMs / state.durationMs) * 100 : 0;
        $("progressFill").style.width = pct + "%";
        $("timeElapsed").textContent = formatMs(state.progressMs);
        $("timeTotal").textContent = formatMs(state.durationMs);
    }

    // Click on progress bar to seek
    $("progressBar").addEventListener("click", async e => {
        if (state.durationMs === 0) return;
        const rect = $("progressBar").getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const posMs = Math.round(pct * state.durationMs);
        if (getSessionToken() || getPairingCode()) {
            spotifyAction("PUT", "/me/player/seek?position_ms=" + posMs);
            state.progressMs = posMs;
            renderProgress();
            highlightLyricLine();
            return;
        }
    });

    /* -------------------------------------------------------------------------
     *  LRCLIB - fetch synced lyrics
     * ------------------------------------------------------------------------*/
    function lyricsCacheKey(artist, title, durationSec) {
        return [artist || "", title || "", Math.round(durationSec || 0)].join("|").toLowerCase();
    }

    function readLyricsCache() {
        try { return JSON.parse(localStorage.getItem(LS.LYRICS_CACHE) || "{}"); }
        catch (_) { return {}; }
    }

    function getCachedLyrics(key) {
        const entry = readLyricsCache()[key];
        if (!entry || !Array.isArray(entry.lines)) return null;
        return entry.lines;
    }

    function setCachedLyrics(key, lines) {
        try {
            const cache = readLyricsCache();
            cache[key] = { ts: Date.now(), lines: Array.isArray(lines) ? lines : [] };
            Object.keys(cache)
                .sort((a, b) => (cache[b].ts || 0) - (cache[a].ts || 0))
                .slice(LYRICS_CACHE_LIMIT)
                .forEach(k => delete cache[k]);
            localStorage.setItem(LS.LYRICS_CACHE, JSON.stringify(cache));
        } catch (_) { }
    }

    function fetchLyricsUrl(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), LYRICS_FETCH_TIMEOUT_MS);
        return fetch(url.toString(), { signal: controller.signal })
            .finally(() => clearTimeout(timer));
    }

    async function fetchLyricsExact(artist, title, album, durationSec) {
        try {
            const url = new URL(LRCLIB_BASE);
            url.searchParams.set("artist_name", artist);
            url.searchParams.set("track_name", title);
            url.searchParams.set("album_name", album || "");
            url.searchParams.set("duration", Math.round(durationSec));
            const resp = await fetchLyricsUrl(url);
            if (!resp.ok) return [];
            const data = await resp.json();
            return data.syncedLyrics ? parseLRC(data.syncedLyrics) : [];
        } catch (_) {
            return [];
        }
    }

    async function fetchLyricsSearch(artist, title, durationSec) {
        try {
            const searchUrl = new URL(LRCLIB_SEARCH);
            searchUrl.searchParams.set("artist_name", artist);
            searchUrl.searchParams.set("track_name", title);
            const searchResp = await fetchLyricsUrl(searchUrl);
            if (!searchResp.ok) return [];
            const results = await searchResp.json();
            if (!Array.isArray(results) || results.length === 0) return [];
            const withSynced = results.filter(r => r.syncedLyrics);
            if (withSynced.length === 0) return [];
            withSynced.sort((a, b) =>
                Math.abs((a.duration || 0) - durationSec) - Math.abs((b.duration || 0) - durationSec)
            );
            return parseLRC(withSynced[0].syncedLyrics);
        } catch (_) {
            return [];
        }
    }

    function firstNonEmptyLyrics(promises) {
        return new Promise(resolve => {
            let pending = promises.length;
            const done = lines => {
                if (Array.isArray(lines) && lines.length) {
                    resolve(lines);
                    return;
                }
                pending -= 1;
                if (pending === 0) resolve([]);
            };
            promises.forEach(p => p.then(done).catch(() => done([])));
        });
    }

    async function fetchLyrics(artist, title, album, durationSec) {
        const key = lyricsCacheKey(artist, title, durationSec);
        const cached = getCachedLyrics(key);
        if (cached) return cached;
        const exactPromise = fetchLyricsExact(artist, title, album, durationSec);
        const searchPromise = fetchLyricsSearch(artist, title, durationSec);
        const lines = await firstNonEmptyLyrics([exactPromise, searchPromise]);
        if (lines.length) setCachedLyrics(key, lines);
        return lines;
    }

    // Parse LRC format: [mm:ss.xx] text
    function parseLRC(raw) {
        return raw.split("\n")
            .map(line => {
                const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
                if (!m) return null;
                const timeMs = (parseInt(m[1]) * 60 + parseFloat(m[2])) * 1000;
                return { timeMs, text: m[3].trim() };
            })
            .filter(Boolean)
            .sort((a, b) => a.timeMs - b.timeMs);
    }

    function renderLyricsLoading() {
        const scroll = $("lyricsScroll");
        scroll.innerHTML = "";
        const wrap = document.createElement("div");
        wrap.className = "lyrics-loading";
        for (let i = 0; i < 8; i++) {
            const bar = document.createElement("div");
            bar.className = "lyrics-loading-bar";
            wrap.appendChild(bar);
        }
        scroll.appendChild(wrap);
    }

    function renderLyrics(lines) {
        const scroll = $("lyricsScroll");
        const noLyrics = $("noLyrics");

        if (!lines || lines.length === 0) {
            scroll.innerHTML = "";
            const nl = document.createElement("div");
            nl.className = "no-lyrics";
            nl.id = "noLyrics";
            const icon = document.createElement("div");
            icon.className = "icon";
            icon.textContent = "MUSIC";
            const msg = document.createElement("div");
            msg.textContent = t("noLyrics");
            nl.appendChild(icon);
            nl.appendChild(msg);
            scroll.appendChild(nl);
            return;
        }

        scroll.innerHTML = "";
        lines.forEach((line, i) => {
            const el = document.createElement("div");
            el.className = "lyric-line";
            el.dataset.idx = i;
            el.textContent = line.text || ".";
            scroll.appendChild(el);
        });
    }

    function loadLyricsForTrack(trackId, artists, title, albumName, durationSec) {
        if (!trackId || state.lyricsLoadingTrackId === trackId) return;
        const cachedLyrics = getCachedLyrics(lyricsCacheKey(artists, title, durationSec));
        state.lyricsTrackId = trackId;
        if (cachedLyrics) {
            state.lyricsData = cachedLyrics;
            if (lyricsPaneVisible()) {
                renderLyrics(cachedLyrics);
                highlightLyricLine();
            }
            return;
        }
        state.lyricsData = [];
        state.lyricsLoadingTrackId = trackId;
        if (lyricsPaneVisible()) renderLyricsLoading();
        fetchLyrics(artists, title, albumName, durationSec)
            .then(lines => {
                if (state.lyricsTrackId !== trackId || state.trackId !== trackId) return;
                state.lyricsData = lines;
                if (lyricsPaneVisible()) {
                    renderLyrics(lines);
                    highlightLyricLine();
                }
            })
            .finally(() => {
                if (state.lyricsLoadingTrackId === trackId) state.lyricsLoadingTrackId = null;
            });
    }

    function highlightLyricLine() {
        if (!state.lyricsData || state.lyricsData.length === 0) return;
        const now = state.progressMs;
        let active = 0;
        for (let i = 0; i < state.lyricsData.length; i++) {
            if (state.lyricsData[i].timeMs <= now) active = i;
            else break;
        }
        const lines = $("lyricsScroll").querySelectorAll(".lyric-line");
        lines.forEach((el, i) => {
            const dist = Math.abs(i - active);
            el.classList.toggle("active", i === active);
            el.classList.toggle("near", dist > 0 && dist <= 2);
        });
        // Auto-scroll: follow active line only if auto-scroll is on
        if (state.autoScroll && lines[active]) {
            lines[active].scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }

    /* -------------------------------------------------------------------------
     *  LYRICS SCROLL CONTROLS
     * ------------------------------------------------------------------------*/
    function setAutoScroll(on) {
        state.autoScroll = on;
        const btn = $("lyricsAutoBtn");
        if (btn) btn.classList.toggle("active", on);
        if (on) highlightLyricLine(); // snap back to current line
    }

    function pauseAutoScrollTemporarily() {
        if (!state.autoScroll) return;
        setAutoScroll(false);
        clearTimeout(state.autoScrollResumeTimer);
        state.autoScrollResumeTimer = setTimeout(() => setAutoScroll(true), 4000);
    }

    // Auto-scroll toggle button
    const autoBtn = $("lyricsAutoBtn");
    if (autoBtn) {
        autoBtn.addEventListener("click", () => {
            clearTimeout(state.autoScrollResumeTimer);
            setAutoScroll(!state.autoScroll);
        });
    }

    // Scroll arrows - scroll by ~3 lines
    const scrollUp = $("lyricsScrollUp");
    const scrollDown = $("lyricsScrollDown");
    const SCROLL_AMOUNT = 60; // px per arrow click
    if (scrollUp) scrollUp.addEventListener("click", () => { pauseAutoScrollTemporarily(); $("lyricsScroll").scrollBy({ top: -SCROLL_AMOUNT, behavior: "smooth" }); });
    if (scrollDown) scrollDown.addEventListener("click", () => { pauseAutoScrollTemporarily(); $("lyricsScroll").scrollBy({ top: SCROLL_AMOUNT, behavior: "smooth" }); });

    // Pause auto-scroll when user manually touches/wheels lyrics
    const lyricsEl = $("lyricsScroll");
    if (lyricsEl) {
        lyricsEl.addEventListener("wheel", () => pauseAutoScrollTemporarily(), { passive: true });
        lyricsEl.addEventListener("touchstart", () => pauseAutoScrollTemporarily(), { passive: true });
    }

    /* -------------------------------------------------------------------------
     *  UI UPDATE
     * ------------------------------------------------------------------------*/
    function updateAlbumArt(url) {
        const img = $("albumImg");
        const noArt = $("noArt");
        const bgImg = $("bgImg");

        if (url && url.startsWith("https://")) {
            img.onload = () => {
                img.classList.remove("ui-hidden");
                noArt.classList.add("ui-hidden");
                bgImg.src = url;
                bgImg.onload = () => { refreshBgBlur(); };
            };
            img.src = url;
        } else {
            img.classList.add("ui-hidden");
            noArt.classList.remove("ui-hidden");
            bgImg.style.opacity = "0";
        }
    }

    function setPlayIcon(playing) {
        $("playIcon").innerHTML = playing
            ? `<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>`
            : `<polygon points="5 3 19 12 5 21 5 3"/>`;
        $("widget").classList.toggle("is-playing", playing);
    }

    function saveLastTrackSnapshot(track, artists, album, artUrl) {
        if (!track || !track.id) return;
        try {
            localStorage.setItem(LS.LAST_TRACK, JSON.stringify({
                id: track.id,
                name: track.name || "",
                artists: artists || "",
                album: album.name || "",
                artUrl: artUrl || "",
                progressMs: state.progressMs || 0,
                durationMs: state.durationMs || 0,
                isPlaying: !!state.isPlaying,
                savedAt: Date.now(),
            }));
        } catch (_) { }
    }

    function restoreLastTrackSnapshot() {
        try {
            const snap = JSON.parse(localStorage.getItem(LS.LAST_TRACK) || "null");
            if (!snap || !snap.id || Date.now() - (snap.savedAt || 0) > 30 * 60 * 1000) return false;
            const elapsed = snap.isPlaying ? Date.now() - (snap.savedAt || Date.now()) : 0;
            state.trackId = snap.id;
            state.durationMs = snap.durationMs || 0;
            state.progressMs = Math.min((snap.progressMs || 0) + elapsed, state.durationMs || 0);
            state.isPlaying = !!snap.isPlaying;
            $("trackName").textContent = snap.name || "-";
            $("trackArtist").textContent = snap.artists || "-";
            $("trackAlbum").textContent = snap.album || "";
            updateAlbumArt(snap.artUrl || null);
            renderProgress();
            setPlayIcon(state.isPlaying);
            if (state.isPlaying) startProgressTick();
            hideOverlay();
            return true;
        } catch (_) {
            return false;
        }
    }

    /* -------------------------------------------------------------------------
     *  POLL - main loop
     * ------------------------------------------------------------------------*/
    async function poll() {
        if (!getSessionToken() && !getPairingCode()) {
            stopPolling();
            showCredentialSetupOverlay();
            return;
        }

        const data = await fetchCurrentlyPlaying();

        if (data && data.spotifyError) {
            if (data.status === 401) {
                state.connectionFailures = 0;
                showOverlay("KEY", t("setupTitle"), t("setupSub"), t("authorizeSpotify"), startSpotifyAuthorization);
                return;
            }
            if (data.status === 404 || data.status === 410) {
                clearSessionToken();
                clearPairingCode();
                state.connectionFailures = 0;
                stopPolling();
                showCredentialSetupOverlay();
                return;
            }
            state.connectionFailures += 1;
            if (state.trackId) {
                hideOverlay();
                stopProgressTick();
                state.isPlaying = false;
                setPlayIcon(false);
                return;
            }
            if (state.connectionFailures >= OFFLINE_OVERLAY_FAILURES) {
                showOverlay("WARN", t("offlineTitle"), t("offlineSub"));
            } else if (state.connectionFailures >= CONNECTING_OVERLAY_FAILURES) {
                showOverlay("...", t("connectingTitle"), t("connectingSub"));
            }
            return;
        }

        state.connectionFailures = 0;

        if (!data.item) {
            hideOverlay();
            stopProgressTick();
            state.isPlaying = false;
            setPlayIcon(false);
            return;
        }

        hideOverlay();

        const track = data.item;
        const trackId = track.id;
        const album = track.album || {};
        const artists = (track.artists || []).map(a => a.name).join(", ");
        const artUrl = album.images && album.images[0] ? album.images[0].url : null;

        // Update progress
        state.progressMs = data.progress_ms || 0;
        state.durationMs = track.duration_ms || 0;
        state.isPlaying = data.is_playing;
        state.lastPollTime = Date.now();

        renderProgress();
        setPlayIcon(state.isPlaying);

        // Shuffle / repeat state
        if (data.shuffle_state !== undefined) state.shuffleOn = data.shuffle_state;
        if (data.repeat_state !== undefined) state.repeatMode = data.repeat_state;
        updateShuffleRepeat();

        // Volume sync - only update when user is not dragging
        if (data.device && data.device.volume_percent !== undefined && !state.volumeDragging) {
            setVolume(data.device.volume_percent);
            if (data.device.volume_percent > 0) state.volumeBeforeMute = data.device.volume_percent;
        }

        if (state.isPlaying) startProgressTick();
        else stopProgressTick();
        saveLastTrackSnapshot(track, artists, album, artUrl);

        // Only re-render track info / art if track changed
        if (trackId !== state.trackId) {
            state.trackId = trackId;

            $("trackName").textContent = track.name || "-";
            $("trackArtist").textContent = artists || "-";
            $("trackAlbum").textContent = album.name || "";

            updateAlbumArt(artUrl);

            loadLyricsForTrack(trackId, artists, track.name, album.name, (track.duration_ms || 0) / 1000);
        } else {
            if (lyricsPaneVisible() && state.lyricsTrackId !== trackId) {
                loadLyricsForTrack(trackId, artists, track.name, album.name, (track.duration_ms || 0) / 1000);
            }
            // Same track - just sync lyrics highlight
            highlightLyricLine();
        }
    }

    function startPolling() {
        stopPolling();
        state.connectionFailures = 0;
        poll(); // immediate
        state.pollTimer = setInterval(poll, POLL_MS);
    }

    function stopPolling() {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }

    function resumePollingAfterWidgetSwitch() {
        syncIcueInlineBridge();
        if (!getSessionToken() && !getPairingCode()) return;
        restoreLastTrackSnapshot();
        state.connectionFailures = 0;
        if (!state.pollTimer) startPolling();
        else poll();
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) resumePollingAfterWidgetSwitch();
    });
    window.addEventListener("focus", resumePollingAfterWidgetSwitch);

    /* -------------------------------------------------------------------------
     *  RESPONSIVE SIZE DETECTION via ResizeObserver on the widget element
     *  sz-m  : < 700 px  -> full-bleed album art
     *  sz-l  : 700-1399  -> row: album + track info + controls
     *  sz-xl : >= 1400 px -> left panel + full lyrics column
     * ------------------------------------------------------------------------*/
    function applySize(sz) {
        if (state.sizeClass === sz) return;
        if (state.sizeClass) document.documentElement.classList.remove(state.sizeClass);
        document.documentElement.classList.add(sz);
        state.sizeClass = sz;
        // Fetch lyrics when entering a lyrics-capable layout
        if (lyricsPaneVisible() && state.trackId && state.lyricsData.length > 0) {
            renderLyrics(state.lyricsData);
            highlightLyricLine();
        } else if (lyricsPaneVisible() && state.trackId && state.lyricsData.length === 0) {
            const tn = $("trackName").textContent;
            const ar = $("trackArtist").textContent;
            const al = $("trackAlbum").textContent;
            fetchLyrics(ar, tn, al, state.durationMs / 1000).then(lines => {
                state.lyricsData = lines;
                renderLyrics(lines);
                highlightLyricLine();
            });
        }
    }

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(entries => {
            const w = entries[0].contentRect.width;
            if (w < 1200) applySize('sz-m');
            else if (w < 2000) applySize('sz-l');
            else applySize('sz-xl');
        });
        ro.observe($('widget'));
    } else {
        const fb = () => {
            const w = $('widget').offsetWidth || window.innerWidth;
            if (w < 1200) applySize('sz-m');
            else if (w < 2000) applySize('sz-l');
            else applySize('sz-xl');
        };
        window.addEventListener('resize', fb);
        fb();
    }


    /* -------------------------------------------------------------------------
     *  INIT
     * ------------------------------------------------------------------------*/
    function init() {
        clearLegacySpotifySecrets();
        syncIcueCredentials({ clearEmpty: true });
        applyTheme(state.theme);
        applyLang();
        updateStaticStrings();

        if (!getSessionToken() && !getPairingCode()) {
            showCredentialSetupOverlay();
        } else {
            restoreLastTrackSnapshot();
            startPolling();
        }
    }

    init();
})();
