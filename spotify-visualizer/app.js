(() => {
    "use strict";

    /* ─────────────────────────────────────────────────────────────────────────
     *  CONSTANTS & STATE
     * ────────────────────────────────────────────────────────────────────────*/
    const LOGIN_URL = "https://stealthylabshq.github.io/iframe-edge/spotify-visualizer/auth/login.html";
    const TOKEN_URL = "https://accounts.spotify.com/api/token";
    const API_BASE = "https://api.spotify.com/v1";
    const LRCLIB_BASE = "https://lrclib.net/api/get";
    const LRCLIB_SEARCH = "https://lrclib.net/api/search";
    const POLL_MS = 3000;
    const CONNECTING_OVERLAY_FAILURES = 4;
    const OFFLINE_OVERLAY_FAILURES = 10;
    const LYRICS_CACHE_LIMIT = 24;

    const LS = {
        THEME: "pa_theme",
        CID: "pa_spotify_client_id",
        RTOKEN: "pa_spotify_refresh_token",
        RTOKEN_ICUE: "pa_spotify_refresh_token_icue",
        LAST_TRACK: "pa_spotify_last_track",
        LYRICS_CACHE: "pa_spotify_lyrics_cache_v1",
    };
    const HASH_PREFIX = "#cfg=";

    const $ = id => document.getElementById(id);

    let state = {
        accessToken: null,
        tokenExpiry: 0,        // Date.now() ms
        isPlaying: false,
        trackId: null,
        progressMs: 0,
        durationMs: 0,
        lastPollTime: 0,
        pollTimer: null,
        tokenRefreshPromise: null,
        progressTimer: null,
        lyricsData: [],       // [{timeMs, text}]
        lyricsTrackId: null,
        shuffleOn: false,          // Spotify shuffle state
        repeatMode: "off",         // "off" | "context" | "track"
        autoScroll: true,          // auto-follow active lyric line
        autoScrollResumeTimer: null,
        sizeClass: '',             // 'sz-m' | 'sz-l' | 'sz-xl'
        connectionFailures: 0,
        theme: localStorage.getItem(LS.THEME) || "dark", // "dark" | "light" | "blur"
        lang: "en",
        volume: 100,
        volumeBeforeMute: 100,     // last non-zero volume for mute toggle
        volumeDebounce: null,
        volumeDragging: false,     // true while user is dragging the slider
    };

    // Token is always persisted in localStorage — never session-only.
    function getRefreshToken() {
        return localStorage.getItem(LS.RTOKEN) || "";
    }

    function setRefreshToken(token, source) {
        const value = token || "";
        if (!value) {
            clearRefreshToken();
            return;
        }
        localStorage.setItem(LS.RTOKEN, value);
        if (source === "icue") localStorage.setItem(LS.RTOKEN_ICUE, value);
    }

    function clearRefreshToken() {
        localStorage.removeItem(LS.RTOKEN);
        localStorage.removeItem(LS.RTOKEN_ICUE);
    }

    // Migration: if token was stored under old session/remember system, pull it into localStorage.
    function migrateRefreshTokenStorage() {
        // Old session key → move to localStorage if nothing there yet
        const sessionToken = sessionStorage.getItem("pa_spotify_refresh_token_session") || "";
        if (sessionToken && !getRefreshToken()) {
            localStorage.setItem(LS.RTOKEN, sessionToken);
        }
        sessionStorage.removeItem("pa_spotify_refresh_token_session");
        // Clean up old remember flag
        localStorage.removeItem("pa_spotify_refresh_token_remember");
    }

    function readIcueProperty(name) {
        if (name !== "spotifyClientId" && name !== "spotifyRefreshToken") {
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

    function setIcueCredentials(cidValue, rtknValue, options) {
        const clearEmpty = !!(options && options.clearEmpty);
        const cid = cidValue === undefined || cidValue === null ? null : String(cidValue || "").trim();
        const rtkn = rtknValue === undefined || rtknValue === null ? null : String(rtknValue || "").trim();
        let changed = false;

        if (cid !== null) {
            const currentCid = localStorage.getItem(LS.CID) || "";
            if (cid && cid !== currentCid) {
                localStorage.setItem(LS.CID, cid);
                changed = true;
            } else if (!cid && (clearEmpty || !currentCid)) {
                localStorage.removeItem(LS.CID);
                if (currentCid) changed = true;
                if (clearEmpty) {
                    clearRefreshToken();
                    state.accessToken = null;
                    state.tokenExpiry = 0;
                }
            }
        }

        if (rtkn !== null) {
            const currentRtkn = getRefreshToken();
            const lastIcueRtkn = localStorage.getItem(LS.RTOKEN_ICUE) || "";
            if (rtkn) {
                if (currentRtkn && currentRtkn !== rtkn && lastIcueRtkn === rtkn) {
                    return changed;
                }
                if (currentRtkn !== rtkn) {
                    setRefreshToken(rtkn, "icue");
                    changed = true;
                } else {
                    localStorage.setItem(LS.RTOKEN_ICUE, rtkn);
                }
            } else if (clearEmpty || cid || !currentRtkn) {
                clearRefreshToken();
                if (currentRtkn) changed = true;
            }
        }

        return changed;
    }

    function syncIcueCredentials(options) {
        const cid = readIcueString("spotifyClientId");
        const rtkn = readIcueString("spotifyRefreshToken");
        return setIcueCredentials(cid, rtkn, options);
    }

    function getNativeIcueRefreshToken() {
        return readIcueString("spotifyRefreshToken") || "";
    }

    function syncIcueInlineBridge(options) {
        if (window.SpotifyVisualizerIcue && typeof window.SpotifyVisualizerIcue.syncFromIcue === "function") {
            return window.SpotifyVisualizerIcue.syncFromIcue(options);
        }
        return syncIcueCredentials(options);
    }

    function handleIcueSettingsUpdate(options) {
        const changed = syncIcueInlineBridge(options);
        if (localStorage.getItem(LS.CID) && getRefreshToken()) {
            if (changed) {
                state.accessToken = null;
                state.tokenExpiry = 0;
            }
            restoreLastTrackSnapshot();
            hideOverlay();
            if (!state.pollTimer) startPolling();
            else if (changed) poll();
        } else {
            stopPolling();
            showCredentialSetupOverlay();
        }
    }

    window.SpotifyVisualizerIcue = {
        onInitialized: function () { handleIcueSettingsUpdate({ clearEmpty: true }); },
        onDataUpdated: function () { handleIcueSettingsUpdate({ clearEmpty: false }); },
        setCredentials: setIcueCredentials,
    };

    /* ─────────────────────────────────────────────────────────────────────────
     *  URL HASH CONFIG — survives iCUE widget switching
     * ────────────────────────────────────────────────────────────────────────*/
    function encodeConfig(cid, rtkn) {
        try { return btoa(JSON.stringify({ c: cid || "", r: rtkn || "" })); }
        catch (_) { return ""; }
    }

    function decodeConfig(encoded) {
        try { return JSON.parse(atob(encoded)); }
        catch (_) { return null; }
    }

    // On startup: restore from URL hash (iCUE source of truth — always wins)
    function loadFromHash() {
        const hash = window.location.hash;
        if (!hash.startsWith(HASH_PREFIX)) return;
        const cfg = decodeConfig(hash.slice(HASH_PREFIX.length));
        if (!cfg) return;
        if (cfg.c) {
            localStorage.setItem(LS.CID, cfg.c);
        }
        if (cfg.r) {
            setRefreshToken(cfg.r, "hash");
        }
    }

    // After save: keep URL hash in sync so iCUE always has the latest config
    function updateHashConfig(cid, rtkn) {
        try {
            const encoded = encodeConfig(cid, rtkn);
            if (encoded) {
                const url = window.location.pathname + window.location.search + HASH_PREFIX + encoded;
                window.history.replaceState(null, "", url);
            }
        } catch (_) { }
    }

    function buildAuthUrl(cid) {
        return LOGIN_URL + "?client_id=" + encodeURIComponent(cid || "");
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  i18n
     * ────────────────────────────────────────────────────────────────────────*/
    const i18n = {
        en: {
            title: "Spotify",
            lyricsLbl: "Lyrics",
            noSong: "Play a song to see lyrics",
            noLyrics: "Lyrics not available",
            notPlaying: "Not playing",
            notPlayingSub: "Start playback on any Spotify device.",
            setupTitle: "Setup Required",
            setupSub: "Use iCUE settings to add your Spotify Client ID and Refresh Token.",
            setupClientIdSub: "Add your Spotify Client ID in the native iCUE settings panel.",
            setupTokenSub: "Authorize Spotify, then paste the refresh token into iCUE settings.",
            authorizeSpotify: "Authorize Spotify",
            toastError: "Spotify connection error",
            toastReauth: "⚠️ Token expired — re-authorize in settings",
            sessionTitle: "Session expired",
            sessionSub: "Your Spotify authorization was revoked or expired. Reconnect to continue.",
            reconnect: "Reconnect",
            missingClientId: "⚠️ Add your Client ID in iCUE settings first",
            connectingTitle: "Connecting to Spotify",
            connectingSub: "Reconnecting after widget switch...",
            offlineTitle: "Spotify connection unavailable",
            offlineSub: "Keeping the last track visible. Retrying automatically...",
        },
    };

    function t(key) { return (i18n[state.lang] || i18n.en)[key] || key; }

    /* ─────────────────────────────────────────────────────────────────────────
     *  TOAST
     * ────────────────────────────────────────────────────────────────────────*/
    function showToast(msg, dur = 3000) {
        const el = $("toast");
        el.textContent = msg;
        el.classList.add("visible");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("visible"), dur);
    }

    // Cycle: dark → light → blur → dark
    function applyTheme(th) {
        const valid = ["dark", "light", "blur"];
        state.theme = valid.includes(th) ? th : "dark";
        document.documentElement.setAttribute("data-theme", state.theme);
        const icons = { dark: "🌙", light: "☀️", blur: "🎨" };
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  LANGUAGE
     * ────────────────────────────────────────────────────────────────────────*/
    function applyLang() {
        state.lang = "en";
        updateStaticStrings();
    }

    function updateStaticStrings() {
        const el = (id, key) => { const e = $(id); if (e) e.textContent = t(key); };
        el("t-lyrics", "lyricsLbl");
        el("t-no-song", "noSong");
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  STORAGE SYNC (cross-widget)
     * ────────────────────────────────────────────────────────────────────────*/
    window.addEventListener("storage", e => {
        if (e.key === LS.THEME && e.newValue) applyTheme(e.newValue);
    });

    /* ─────────────────────────────────────────────────────────────────────────
     *  EXTERNAL AUTH LINK
     * ────────────────────────────────────────────────────────────────────────*/
    function openExternalLink(url) {
        if (window.plugins && window.plugins.Linkprovider && typeof pluginLinkprovider_initialized !== "undefined" && pluginLinkprovider_initialized) {
            window.plugins.Linkprovider.open(url);
        } else {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    }

    function startSpotifyAuthorization() {
        syncIcueInlineBridge();
        const cid = localStorage.getItem(LS.CID) || "";
        if (!cid) {
            showToast(t("missingClientId"));
            return;
        }
        openExternalLink(buildAuthUrl(cid));
    }

    function showCredentialSetupOverlay() {
        syncIcueInlineBridge();
        const cid = localStorage.getItem(LS.CID) || "";
        if (!cid) {
            showOverlay("⚙️", t("setupTitle"), t("setupClientIdSub"), t("authorizeSpotify"), startSpotifyAuthorization);
            return;
        }
        showOverlay("🔑", t("setupTitle"), t("setupTokenSub"), t("authorizeSpotify"), startSpotifyAuthorization);
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  STATE OVERLAY
     * ────────────────────────────────────────────────────────────────────────*/
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  SPOTIFY AUTH — refresh access token via refresh_token (PKCE, no secret)
     * ────────────────────────────────────────────────────────────────────────*/
    async function refreshAccessTokenOnce(allowNativeFallback = true) {
        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = getRefreshToken();
        if (!cid || !rtkn) return false;

        try {
            const resp = await fetch(TOKEN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: rtkn,
                    client_id: cid,
                }),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                if (resp.status === 400 && data.error === "invalid_grant") {
                    const nativeRtkn = getNativeIcueRefreshToken();
                    if (allowNativeFallback && nativeRtkn && nativeRtkn !== rtkn) {
                        setRefreshToken(nativeRtkn, "icue");
                        state.accessToken = null;
                        state.tokenExpiry = 0;
                        return refreshAccessTokenOnce(false);
                    }
                    // Token revoked/expired — clear it and show persistent reconnect banner
                    stopPolling();
                    clearRefreshToken();
                    state.accessToken = null;
                    state.tokenExpiry = 0;
                    showOverlay("🔒", t("sessionTitle"), t("sessionSub"), t("reconnect"), startSpotifyAuthorization);
                }
                return false;
            }
            state.accessToken = data.access_token;
            state.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
            // Spotify sometimes returns a new refresh_token — persist it immediately
            if (data.refresh_token) setRefreshToken(data.refresh_token, "spotify");
            return true;
        } catch (_) {
            return false;
        }
    }

    async function refreshAccessToken() {
        if (state.tokenRefreshPromise) return state.tokenRefreshPromise;
        state.tokenRefreshPromise = refreshAccessTokenOnce().finally(() => {
            state.tokenRefreshPromise = null;
        });
        return state.tokenRefreshPromise;
    }

    async function getAccessToken() {
        if (state.accessToken && Date.now() < state.tokenExpiry) return state.accessToken;
        const ok = await refreshAccessToken();
        return ok ? state.accessToken : null;
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  SPOTIFY API — currently playing
     * ────────────────────────────────────────────────────────────────────────*/
    async function fetchCurrentlyPlaying() {
        const token = await getAccessToken();
        if (!token) return null;

        try {
            // /me/player returns shuffle_state + repeat_state; 204 = no active device
            const resp = await fetch(API_BASE + "/me/player?additional_types=track", {
                headers: { Authorization: "Bearer " + token },
            });
            if (resp.status === 204) return { is_playing: false };
            if (resp.status === 401) {
                // Access token rejected mid-session — force a refresh next call
                state.accessToken = null;
                state.tokenExpiry = 0;
                return null;
            }
            if (!resp.ok) return null;
            return await resp.json();
        } catch (_) {
            return null;
        }
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  SPOTIFY API — playback controls
     * ────────────────────────────────────────────────────────────────────────*/
    async function spotifyAction(method, endpoint) {
        const token = await getAccessToken();
        if (!token) return;
        try {
            await fetch(API_BASE + endpoint, {
                method,
                headers: { Authorization: "Bearer " + token },
            });
            pollUntilTrackChanges();
        } catch (_) { }
    }

    // After a skip, poll at short intervals until Spotify reflects the new track.
    // Each scheduled poll bails out early if the track already changed, avoiding wasted calls.
    function pollUntilTrackChanges() {
        const prevId = state.trackId;
        [150, 400, 800, 1300, 2100].forEach(ms => {
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  VOLUME CONTROL
     * ────────────────────────────────────────────────────────────────────────*/
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
            const token = await getAccessToken();
            if (!token) return;
            try {
                await fetch(API_BASE + "/me/player/volume?volume_percent=" + Math.round(vol), {
                    method: "PUT",
                    headers: { Authorization: "Bearer " + token },
                });
            } catch (_) { }
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  PROGRESS BAR interpolation
     * ────────────────────────────────────────────────────────────────────────*/
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
        const token = await getAccessToken();
        if (!token) return;
        try {
            await fetch(API_BASE + "/me/player/seek?position_ms=" + posMs, {
                method: "PUT",
                headers: { Authorization: "Bearer " + token },
            });
            state.progressMs = posMs;
            renderProgress();
            highlightLyricLine();
        } catch (_) { }
    });

    /* ─────────────────────────────────────────────────────────────────────────
     *  LRCLIB — fetch synced lyrics
     * ────────────────────────────────────────────────────────────────────────*/
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

    async function fetchLyricsExact(artist, title, album, durationSec) {
        try {
            const url = new URL(LRCLIB_BASE);
            url.searchParams.set("artist_name", artist);
            url.searchParams.set("track_name", title);
            url.searchParams.set("album_name", album || "");
            url.searchParams.set("duration", Math.round(durationSec));
            const resp = await fetch(url.toString());
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
            const searchResp = await fetch(searchUrl.toString());
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

    async function fetchLyrics(artist, title, album, durationSec) {
        const key = lyricsCacheKey(artist, title, durationSec);
        const cached = getCachedLyrics(key);
        if (cached) return cached;
        const exactPromise = fetchLyricsExact(artist, title, album, durationSec);
        const searchPromise = fetchLyricsSearch(artist, title, durationSec);
        const exact = await exactPromise;
        const lines = exact.length ? exact : await searchPromise;
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
            icon.textContent = "🎵";
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
            el.textContent = line.text || "·";
            scroll.appendChild(el);
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  LYRICS SCROLL CONTROLS
     * ────────────────────────────────────────────────────────────────────────*/
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

    // Scroll arrows — scroll by ~3 lines
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  UI UPDATE
     * ────────────────────────────────────────────────────────────────────────*/
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  POLL — main loop
     * ────────────────────────────────────────────────────────────────────────*/
    async function poll() {
        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = getRefreshToken();

        if (!cid || !rtkn) {
            stopPolling();
            showCredentialSetupOverlay();
            return;
        }

        const data = await fetchCurrentlyPlaying();

        if (data === null) {
            state.connectionFailures += 1;
            if (state.trackId) {
                return;
            }
            if (state.connectionFailures >= OFFLINE_OVERLAY_FAILURES) {
                showOverlay("⚠️", t("offlineTitle"), t("offlineSub"));
            } else if (state.connectionFailures >= CONNECTING_OVERLAY_FAILURES) {
                showOverlay("…", t("connectingTitle"), t("connectingSub"));
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

        // Volume sync — only update when user is not dragging
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

            $("trackName").textContent = track.name || "—";
            $("trackArtist").textContent = artists || "—";
            $("trackAlbum").textContent = album.name || "";

            updateAlbumArt(artUrl);

            const durationSec = (track.duration_ms || 0) / 1000;
            const cachedLyrics = getCachedLyrics(lyricsCacheKey(artists, track.name, durationSec));
            state.lyricsTrackId = trackId;
            if (cachedLyrics) {
                state.lyricsData = cachedLyrics;
                if (lyricsPaneVisible()) {
                    renderLyrics(cachedLyrics);
                    highlightLyricLine();
                }
            } else {
                state.lyricsData = [];
                if (lyricsPaneVisible()) renderLyricsLoading();
                fetchLyrics(artists, track.name, album.name, durationSec)
                    .then(lines => {
                        if (state.lyricsTrackId !== trackId || state.trackId !== trackId) return;
                        state.lyricsData = lines;
                        if (lyricsPaneVisible()) {
                            renderLyrics(lines);
                            highlightLyricLine();
                        }
                    });
            }
        } else {
            // Same track — just sync lyrics highlight
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
        if (!localStorage.getItem(LS.CID) || !getRefreshToken()) return;
        restoreLastTrackSnapshot();
        state.connectionFailures = 0;
        if (!state.pollTimer) startPolling();
        else poll();
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) resumePollingAfterWidgetSwitch();
    });
    window.addEventListener("focus", resumePollingAfterWidgetSwitch);

    /* ─────────────────────────────────────────────────────────────────────────
     *  RESPONSIVE SIZE DETECTION via ResizeObserver on the widget element
     *  sz-m  : < 700 px  → full-bleed album art
     *  sz-l  : 700–1399  → row: album + track info + controls
     *  sz-xl : ≥ 1400 px → left panel + full lyrics column
     * ────────────────────────────────────────────────────────────────────────*/
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


    /* ─────────────────────────────────────────────────────────────────────────
     *  INIT
     * ────────────────────────────────────────────────────────────────────────*/
    function init() {
        loadFromHash();          // restore credentials from URL hash if localStorage is empty
        migrateRefreshTokenStorage();
        syncIcueCredentials({ clearEmpty: true });
        applyTheme(state.theme);
        applyLang();
        updateStaticStrings();

        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = getRefreshToken();

        if (!cid || !rtkn) {
            showCredentialSetupOverlay();
        } else {
            restoreLastTrackSnapshot();
            startPolling();
        }
    }

    init();
})();
