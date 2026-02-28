(() => {
    "use strict";

    /* ─────────────────────────────────────────────────────────────────────────
     *  CONSTANTS & STATE
     * ────────────────────────────────────────────────────────────────────────*/
    const LOGIN_URL = "https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/auth/login.html";
    const TOKEN_URL = "https://accounts.spotify.com/api/token";
    const API_BASE = "https://api.spotify.com/v1";
    const LRCLIB_BASE = "https://lrclib.net/api/get";
    const POLL_MS = 5000;

    const LS = {
        THEME: "pa_theme",
        LANG: "pa_lang",
        CID: "pa_spotify_client_id",
        RTOKEN: "pa_spotify_refresh_token",
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
        lyricsData: [],       // [{time: ms, text: string}]
        lyricsTrackId: null,
        theme: localStorage.getItem(LS.THEME) || "dark",
        lang: localStorage.getItem(LS.LANG) || "fr",
    };

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
            toastError: "Erreur de connexion Spotify",
            toastReauth: "⚠️ Token expiré — ré-autorisez dans les paramètres",
        },
        en: {
            title: "Spotify",
            settings: "⚙️ Settings",
            clientIdLbl: "Spotify Client ID",
            clientHint: "From your Spotify Developer Dashboard. See README for setup guide.",
            authBtn: "Authorize & get Refresh Token",
            refreshLbl: "Refresh Token",
            tokenHint: "After authorization, copy the token from the callback page and paste it here.",
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
            toastError: "Spotify connection error",
            toastReauth: "⚠️ Token expired — re-authorize in settings",
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
        el("t-lyrics", "lyricsLbl");
        el("t-no-song", "noSong");

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
        $("inputRefreshToken").value = localStorage.getItem(LS.RTOKEN) || "";
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
        localStorage.setItem(LS.CID, cid);
        localStorage.setItem(LS.RTOKEN, rtkn);
        showToast(t("toastSaved"));
        closeSettings();
        // Reset token so we re-fetch
        state.accessToken = null;
        state.tokenExpiry = 0;
        startPolling();
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
            btn.style.display = "";
            btn.onclick = btnCb;
        } else {
            btn.style.display = "none";
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
        const rtkn = localStorage.getItem(LS.RTOKEN) || "";
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
                if (data.error === "invalid_grant") showToast(t("toastReauth"), 6000);
                return false;
            }
            state.accessToken = data.access_token;
            state.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
            // Spotify sometimes returns a new refresh_token
            if (data.refresh_token) localStorage.setItem(LS.RTOKEN, data.refresh_token);
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
            const resp = await fetch(API_BASE + "/me/player/currently-playing?additional_types=track", {
                headers: { Authorization: "Bearer " + token },
            });
            if (resp.status === 204) return { is_playing: false };
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
            // Re-poll sooner
            setTimeout(poll, 600);
        } catch (_) { }
    }

    $("prevBtn").addEventListener("click", () => spotifyAction("POST", "/me/player/previous"));
    $("nextBtn").addEventListener("click", () => spotifyAction("POST", "/me/player/next"));
    $("playBtn").addEventListener("click", () => {
        if (state.isPlaying) {
            spotifyAction("PUT", "/me/player/pause");
        } else {
            spotifyAction("PUT", "/me/player/play");
        }
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
    async function fetchLyrics(artist, title, album, durationSec) {
        try {
            const url = new URL(LRCLIB_BASE);
            url.searchParams.set("artist_name", artist);
            url.searchParams.set("track_name", title);
            url.searchParams.set("album_name", album || "");
            url.searchParams.set("duration", Math.round(durationSec));
            const resp = await fetch(url.toString());
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data.syncedLyrics) return [];
            return parseLRC(data.syncedLyrics);
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

    function renderLyrics(lines) {
        const scroll = $("lyricsScroll");
        const noLyrics = $("noLyrics");

        if (!lines || lines.length === 0) {
            scroll.innerHTML = "";
            const nl = document.createElement("div");
            nl.className = "no-lyrics";
            nl.id = "noLyrics";
            nl.innerHTML = `<div class="icon">🎵</div><div>${t("noLyrics")}</div>`;
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
        // Smooth scroll active line to center of the scroll container
        if (lines[active]) {
            lines[active].scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }

    /* ─────────────────────────────────────────────────────────────────────────
     *  UI UPDATE
     * ────────────────────────────────────────────────────────────────────────*/
    function updateAlbumArt(url) {
        const img = $("albumImg");
        const noArt = $("noArt");
        const bgImg = $("bgImg");

        if (url) {
            img.onload = () => {
                img.style.display = "";
                noArt.style.display = "none";
                // Only animate in background after image loads
                bgImg.src = url;
                bgImg.onload = () => { bgImg.style.opacity = "1"; };
            };
            img.src = url;
        } else {
            img.style.display = "none";
            noArt.style.display = "";
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
        const rtkn = localStorage.getItem(LS.RTOKEN) || "";

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

        if (state.isPlaying) startProgressTick();
        else stopProgressTick();

        // Only re-render track info / art if track changed
        if (trackId !== state.trackId) {
            state.trackId = trackId;

            $("trackName").textContent = track.name || "—";
            $("trackArtist").textContent = artists || "—";
            $("trackAlbum").textContent = album.name || "";

            updateAlbumArt(artUrl);

            // Fetch lyrics for new track (XL layout)
            const isXL = window.innerWidth >= 800;
            if (isXL) {
                state.lyricsData = [];
                state.lyricsTrackId = trackId;
                renderLyrics([]);
                fetchLyrics(artists, track.name, album.name, (track.duration_ms || 0) / 1000)
                    .then(lines => {
                        if (state.lyricsTrackId !== trackId) return; // stale
                        state.lyricsData = lines;
                        renderLyrics(lines);
                        highlightLyricLine();
                    });
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
     *  RESPONSIVE: re-fetch lyrics when resizing into XL
     * ────────────────────────────────────────────────────────────────────────*/
    let lastWidth = window.innerWidth;
    window.addEventListener("resize", () => {
        const w = window.innerWidth;
        if (w >= 800 && lastWidth < 800 && state.trackId) {
            // Entered XL — load lyrics
            const trackName = $("trackName").textContent;
            const artistName = $("trackArtist").textContent;
            const albumName = $("trackAlbum").textContent;
            fetchLyrics(artistName, trackName, albumName, state.durationMs / 1000).then(lines => {
                state.lyricsData = lines;
                renderLyrics(lines);
                highlightLyricLine();
            });
        }
        lastWidth = w;
    });

    /* ─────────────────────────────────────────────────────────────────────────
     *  INIT
     * ────────────────────────────────────────────────────────────────────────*/
    function init() {
        applyTheme(state.theme);
        applyLang(state.lang);
        updateStaticStrings();

        const cid = localStorage.getItem(LS.CID) || "";
        const rtkn = localStorage.getItem(LS.RTOKEN) || "";

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
