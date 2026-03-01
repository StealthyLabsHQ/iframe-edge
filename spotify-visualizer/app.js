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
    const POLL_MS = 5000;

    const LS = {
        THEME: "pa_theme",
        LANG: "pa_lang",
        CID: "pa_spotify_client_id",
        RTOKEN: "pa_spotify_refresh_token",
        RTOKEN_REMEMBER: "pa_spotify_refresh_token_remember",
    };
    const HASH_PREFIX = "#cfg=";
    const SS = {
        RTOKEN: "pa_spotify_refresh_token_session",
    };

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
        progressTimer: null,
        lyricsData: [],       // [{timeMs, text}]
        lyricsTrackId: null,
        shuffleOn: false,          // Spotify shuffle state
        repeatMode: "off",         // "off" | "context" | "track"
        autoScroll: true,          // auto-follow active lyric line
        autoScrollResumeTimer: null,
        sizeClass: '',             // 'sz-m' | 'sz-l' | 'sz-xl'
        theme: localStorage.getItem(LS.THEME) || "dark",
        lang: localStorage.getItem(LS.LANG) || "fr",
    };

    function isRefreshTokenPersistent() {
        return localStorage.getItem(LS.RTOKEN_REMEMBER) === "1";
    }

    function getRefreshToken() {
        const sessionToken = sessionStorage.getItem(SS.RTOKEN) || "";
        if (sessionToken) return sessionToken;
        if (isRefreshTokenPersistent()) return localStorage.getItem(LS.RTOKEN) || "";
        // Defensive cleanup in case an old persisted token remains.
        localStorage.removeItem(LS.RTOKEN);
        return "";
    }

    function setRefreshToken(token, persist) {
        const value = token || "";
        if (!value) {
            clearRefreshToken();
            return;
        }
        sessionStorage.setItem(SS.RTOKEN, value);
        if (persist) localStorage.setItem(LS.RTOKEN, value);
        else localStorage.removeItem(LS.RTOKEN);
    }

    function clearRefreshToken() {
        sessionStorage.removeItem(SS.RTOKEN);
        localStorage.removeItem(LS.RTOKEN);
    }

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
            // Mark as persistent so token survives iCUE session reloads
            localStorage.setItem(LS.RTOKEN_REMEMBER, "1");
            setRefreshToken(cfg.r, true);
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

    function buildConfigUrl() {
        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = getRefreshToken();
        const encoded = encodeConfig(cid, rtkn);
        return window.location.origin + window.location.pathname + HASH_PREFIX + encoded;
    }

    function buildIcueUrl() {
        return buildConfigUrl();
    }

    function buildIframeTag() {
        return `<iframe src="${buildIcueUrl()}"></iframe>`;
    }

    function migrateRefreshTokenStorage() {
        const legacy = localStorage.getItem(LS.RTOKEN);
        if (!legacy) return;

        const remember = localStorage.getItem(LS.RTOKEN_REMEMBER);
        sessionStorage.setItem(SS.RTOKEN, legacy);

        if (remember === "1") {
            return;
        }

        // Hardening: default legacy installs to session-only unless user explicitly opted in.
        localStorage.setItem(LS.RTOKEN_REMEMBER, "0");
        localStorage.removeItem(LS.RTOKEN);
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  i18n
     * ────────────────────────────────────────────────────────────────────────*/
    const i18n = {
        fr: {
            title: "Spotify",
            settings: "⚙️ Paramètres",
            clientIdLbl: "Spotify Client ID",
            clientHint: "Depuis votre tableau de bord Spotify Developer. Voir le README.",
            authBtn: "Autoriser & obtenir le Refresh Token",
            refreshLbl: "Refresh Token",
            tokenHint: "Après autorisation, copiez le token depuis la page callback et collez-le ici.",
            rememberTokenLbl: "Mémoriser ce token sur cet appareil",
            rememberTokenHint: "Désactivé = stockage en session (plus sûr, non persistant).",
            save: "Enregistrer",
            lyricsLbl: "Paroles",
            noSong: "Lancez une chanson pour voir les paroles",
            noLyrics: "Paroles non disponibles",
            notPlaying: "En attente...",
            notPlayingSub: "Démarrez la lecture sur Spotify.",
            setupTitle: "Configuration requise",
            setupSub: "Ouvrez les paramètres pour ajouter votre Client ID et Refresh Token Spotify.",
            openSettings: "Ouvrir les paramètres",
            toastSaved: "✓ Paramètres enregistrés",
            toastSavedCopied: "✓ Enregistré — URL iCUE copiée ! Collez-la dans les paramètres du widget iCUE.",
            toastError: "Erreur de connexion Spotify",
            toastReauth: "⚠️ Token expiré — ré-autorisez dans les paramètres",
            sessionTitle: "Session expirée",
            sessionSub: "Votre autorisation Spotify a été révoquée ou est expirée. Reconnectez-vous pour continuer.",
            reconnect: "Se reconnecter",
            copyUrlBtn: "Copier l'URL pour iCUE",
            icueHint: "L'URL ci-dessous contient vos identifiants. Collez-la dans iCUE comme src du widget — ils seront restaurés automatiquement même après un changement de widget.",
            icueUrlPh: "Sauvegardez vos identifiants pour générer l'URL…",
            toastUrlCopied: "✓ URL copiée — collez-la dans iCUE",
        },
        en: {
            title: "Spotify",
            settings: "⚙️ Settings",
            clientIdLbl: "Spotify Client ID",
            clientHint: "From your Spotify Developer Dashboard. See README for setup guide.",
            authBtn: "Authorize & get Refresh Token",
            refreshLbl: "Refresh Token",
            tokenHint: "After authorization, copy the token from the callback page and paste it here.",
            rememberTokenLbl: "Remember this token on this device",
            rememberTokenHint: "Disabled = session-only storage (safer, not persistent).",
            save: "Save",
            lyricsLbl: "Lyrics",
            noSong: "Play a song to see lyrics",
            noLyrics: "Lyrics not available",
            notPlaying: "Not playing",
            notPlayingSub: "Start playback on any Spotify device.",
            setupTitle: "Setup Required",
            setupSub: "Open settings to add your Spotify Client ID and Refresh Token.",
            openSettings: "Open Settings",
            toastSaved: "✓ Settings saved",
            toastSavedCopied: "✓ Saved — iCUE URL copied! Paste it in your iCUE widget settings.",
            toastError: "Spotify connection error",
            toastReauth: "⚠️ Token expired — re-authorize in settings",
            sessionTitle: "Session expired",
            sessionSub: "Your Spotify authorization was revoked or expired. Reconnect to continue.",
            reconnect: "Reconnect",
            copyUrlBtn: "Copy URL for iCUE",
            icueHint: "This URL contains your credentials. Paste it in iCUE as the widget src — they will be restored automatically even after switching widgets.",
            icueUrlPh: "Save your credentials to generate the URL…",
            toastUrlCopied: "✓ URL copied — paste it in iCUE",
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  THEME
     * ────────────────────────────────────────────────────────────────────────*/
    function applyTheme(th) {
        state.theme = (th === "light") ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", state.theme);
        $("themeToggle").textContent = state.theme === "dark" ? "🌙" : "☀️";
    }

    $("themeToggle").addEventListener("click", () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
        localStorage.setItem(LS.THEME, state.theme);
    });

    /* ─────────────────────────────────────────────────────────────────────────
     *  LANGUAGE
     * ────────────────────────────────────────────────────────────────────────*/
    function applyLang(lang) {
        state.lang = (lang === "en") ? "en" : "fr";
        $("langToggle").textContent = state.lang.toUpperCase();
        updateStaticStrings();
    }

    function updateStaticStrings() {
        const el = (id, key) => { const e = $(id); if (e) e.textContent = t(key); };
        el("t-title", "title");
        el("t-settings", "settings");
        el("t-client-id", "clientIdLbl");
        el("t-client-hint", "clientHint");
        el("t-auth-btn", "authBtn");
        el("t-refresh-token", "refreshLbl");
        el("t-token-hint", "tokenHint");
        el("t-remember-token", "rememberTokenLbl");
        el("t-remember-token-hint", "rememberTokenHint");
        el("t-lyrics", "lyricsLbl");
        el("t-no-song", "noSong");
        el("t-icue-hint", "icueHint");
        el("t-copy-url", "copyUrlBtn");

        const saveBtn = $("saveBtn");
        if (saveBtn) saveBtn.textContent = t("save");

        const inp = $("inputClientId");
        if (inp) inp.setAttribute("placeholder", t("clientHint").substring(0, 30) + "…");
    }

    $("langToggle").addEventListener("click", () => {
        applyLang(state.lang === "fr" ? "en" : "fr");
        localStorage.setItem(LS.LANG, state.lang);
    });

    /* ─────────────────────────────────────────────────────────────────────────
     *  STORAGE SYNC (cross-widget)
     * ────────────────────────────────────────────────────────────────────────*/
    window.addEventListener("storage", e => {
        if (e.key === LS.THEME && e.newValue) applyTheme(e.newValue);
        if (e.key === LS.LANG && e.newValue) applyLang(e.newValue);
    });

    /* ─────────────────────────────────────────────────────────────────────────
     *  SETTINGS PANEL
     * ────────────────────────────────────────────────────────────────────────*/
    function openSettings() {
        $("settingsPanel").classList.add("open");
        $("inputClientId").value = localStorage.getItem(LS.CID) || "";
        $("inputRefreshToken").value = getRefreshToken();
        const remember = $("rememberToken");
        if (remember) remember.checked = isRefreshTokenPersistent();
        refreshIcueUrlField();
    }

    function refreshIcueUrlField() {
        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = getRefreshToken();
        const field = $("iCueUrl");
        if (cid && rtkn) {
            field.value = buildIframeTag();
        } else {
            field.value = "";
        }
    }

    function closeSettings() {
        $("settingsPanel").classList.remove("open");
    }

    $("settingsToggle").addEventListener("click", openSettings);
    $("closeSettings").addEventListener("click", closeSettings);

    $("authBtn").addEventListener("click", () => {
        const cid = $("inputClientId").value.trim();
        if (!cid) {
            showToast("⚠️ Enter your Client ID first");
            $("inputClientId").focus();
            return;
        }
        const url = LOGIN_URL + "?client_id=" + encodeURIComponent(cid);
        window.open(url, "_blank", "noopener,noreferrer");
    });

    $("saveBtn").addEventListener("click", () => {
        const cid = $("inputClientId").value.trim();
        const rtkn = $("inputRefreshToken").value.trim();
        const remember = !!($("rememberToken") && $("rememberToken").checked);
        localStorage.setItem(LS.CID, cid);
        localStorage.setItem(LS.RTOKEN_REMEMBER, remember ? "1" : "0");
        setRefreshToken(rtkn, remember);
        // Keep URL hash in sync — iCUE will persist the config across widget switches
        updateHashConfig(cid, rtkn);
        refreshIcueUrlField();
        closeSettings();
        // Reset token so we re-fetch
        state.accessToken = null;
        state.tokenExpiry = 0;
        startPolling();
        showToast(t("toastSaved"));
    });

    $("copyUrlBtn").addEventListener("click", () => {
        const url = buildIframeTag();
        navigator.clipboard.writeText(url).then(() => {
            const btn = $("copyUrlBtn");
            btn.classList.add("copied");
            showToast(t("toastUrlCopied"));
            setTimeout(() => btn.classList.remove("copied"), 2500);
        }).catch(() => showToast(t("toastUrlCopied")));
    });

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

    /* ─────────────────────────────────────────────────────────────────────────
     *  SPOTIFY AUTH — refresh access token via refresh_token (PKCE, no secret)
     * ────────────────────────────────────────────────────────────────────────*/
    async function refreshAccessToken() {
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
            const data = await resp.json();
            if (!resp.ok) {
                if (resp.status === 400 && data.error === "invalid_grant") {
                    // Token revoked/expired — clear it and show persistent reconnect banner
                    stopPolling();
                    clearRefreshToken();
                    state.accessToken = null;
                    state.tokenExpiry = 0;
                    showOverlay("🔒", t("sessionTitle"), t("sessionSub"), t("reconnect"), () => {
                        hideOverlay();
                        openSettings();
                    });
                }
                return false;
            }
            state.accessToken = data.access_token;
            state.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
            // Spotify sometimes returns a new refresh_token — persist it immediately
            if (data.refresh_token) setRefreshToken(data.refresh_token, isRefreshTokenPersistent());
            return true;
        } catch (_) {
            return false;
        }
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
        [300, 700, 1300, 2200, 3500].forEach(ms => {
            setTimeout(() => {
                if (state.trackId !== prevId) return; // already updated
                poll();
            }, ms);
        });
    }

    // Optimistic UI clear on skip: wipe track info instantly so the user sees the change immediately
    function clearOnSkip() {
        // Lyrics
        state.lyricsData = [];
        state.lyricsTrackId = null; // sentinel — blocks in-flight fetch from previous track
        const needsLyrics = (state.sizeClass === 'sz-xl' || state.sizeClass === 'sz-l');
        if (needsLyrics) renderLyricsLoading();

        // Track info — keep state.trackId intact so poll can detect the real new track ID
        $("trackName").textContent = "—";
        $("trackArtist").textContent = "—";
        $("trackAlbum").textContent = "";
        updateAlbumArt(null);

        // Progress reset
        state.progressMs = 0;
        state.durationMs = 0;
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
    async function fetchLyrics(artist, title, album, durationSec) {
        try {
            // 1. Exact match — fastest, requires album name + duration to match LRCLib exactly
            const url = new URL(LRCLIB_BASE);
            url.searchParams.set("artist_name", artist);
            url.searchParams.set("track_name", title);
            url.searchParams.set("album_name", album || "");
            url.searchParams.set("duration", Math.round(durationSec));
            const resp = await fetch(url.toString());
            if (resp.ok) {
                const data = await resp.json();
                if (data.syncedLyrics) return parseLRC(data.syncedLyrics);
            }

            // 2. Fallback search — no album/duration required, picks the result whose
            //    duration is closest to the actual track so we get the right version
            const searchUrl = new URL(LRCLIB_SEARCH);
            searchUrl.searchParams.set("artist_name", artist);
            searchUrl.searchParams.set("track_name", title);
            const searchResp = await fetch(searchUrl.toString());
            if (!searchResp.ok) return [];
            const results = await searchResp.json();
            if (!Array.isArray(results) || results.length === 0) return [];

            const withSynced = results.filter(r => r.syncedLyrics);
            if (withSynced.length === 0) return [];

            // Pick the entry whose duration is closest to the Spotify track duration
            withSynced.sort((a, b) =>
                Math.abs((a.duration || 0) - durationSec) - Math.abs((b.duration || 0) - durationSec)
            );
            return parseLRC(withSynced[0].syncedLyrics);
        } catch (_) {
            return [];
        }
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
                // Only animate in background after image loads
                bgImg.src = url;
                bgImg.onload = () => { bgImg.style.opacity = "1"; };
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

    /* ─────────────────────────────────────────────────────────────────────────
     *  POLL — main loop
     * ────────────────────────────────────────────────────────────────────────*/
    async function poll() {
        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = getRefreshToken();

        if (!cid || !rtkn) {
            stopPolling();
            showOverlay("⚙️", t("setupTitle"), t("setupSub"), t("openSettings"), () => {
                hideOverlay();
                openSettings();
            });
            return;
        }

        const data = await fetchCurrentlyPlaying();

        if (data === null) {
            // Network error or auth failure — still show last known state
            return;
        }

        if (!data.is_playing || !data.item) {
            showOverlay("🎵", t("notPlaying"), t("notPlayingSub"), null, null);
            stopProgressTick();
            state.isPlaying = false;
            state.trackId = null;
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

        if (state.isPlaying) startProgressTick();
        else stopProgressTick();

        // Only re-render track info / art if track changed
        if (trackId !== state.trackId) {
            state.trackId = trackId;

            $("trackName").textContent = track.name || "—";
            $("trackArtist").textContent = artists || "—";
            $("trackAlbum").textContent = album.name || "";

            updateAlbumArt(artUrl);

            // Fetch lyrics for new track (L and XL layouts)
            const needsLyrics = (state.sizeClass === 'sz-xl' || state.sizeClass === 'sz-l');
            if (needsLyrics) {
                state.lyricsData = [];
                state.lyricsTrackId = trackId;
                renderLyricsLoading(); // show skeleton while fetching
                fetchLyrics(artists, track.name, album.name, (track.duration_ms || 0) / 1000)
                    .then(lines => {
                        if (state.lyricsTrackId !== trackId) return; // stale — skip if song changed again
                        state.lyricsData = lines;
                        renderLyrics(lines);
                        highlightLyricLine();
                    });
            } else {
                // Even in non-lyrics layout, reset state so lyrics are fresh on next resize
                state.lyricsData = [];
                state.lyricsTrackId = null;
            }
        } else {
            // Same track — just sync lyrics highlight
            highlightLyricLine();
        }
    }

    function startPolling() {
        stopPolling();
        poll(); // immediate
        state.pollTimer = setInterval(poll, POLL_MS);
    }

    function stopPolling() {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
    }

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
        const needsLyrics = (sz === 'sz-xl' || sz === 'sz-l');
        if (needsLyrics && state.trackId && state.lyricsData.length === 0) {
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
            if (w < 700) applySize('sz-m');
            else if (w < 1400) applySize('sz-l');
            else applySize('sz-xl');
        });
        ro.observe($('widget'));
    } else {
        const fb = () => {
            const w = $('widget').offsetWidth || window.innerWidth;
            if (w < 700) applySize('sz-m');
            else if (w < 1400) applySize('sz-l');
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
        applyTheme(state.theme);
        applyLang(state.lang);
        updateStaticStrings();

        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = getRefreshToken();

        if (!cid || !rtkn) {
            showOverlay("⚙️", t("setupTitle"), t("setupSub"), t("openSettings"), () => {
                hideOverlay();
                openSettings();
            });
        } else {
            startPolling();
        }
    }

    init();
})();
