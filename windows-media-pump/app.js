(() => {
    "use strict";

    const POLL_MS = 1500;
    const $ = id => document.getElementById(id);
    let pollTimer = null;
    let requestId = 1;
    let responseConnected = false;
    const pending = new Map();

    function mediaPlugin() {
        return window.plugins && window.plugins.Mediadataprovider;
    }

    function mediaReady() {
        return !!mediaPlugin();
    }

    function handleAsyncResponse(id, value) {
        const resolve = pending.get(id);
        if (!resolve) return;
        pending.delete(id);
        resolve(String(value || ""));
    }

    function connectMediaEvents() {
        const plugin = mediaPlugin();
        if (!plugin || responseConnected) return;
        if (plugin.asyncResponse && plugin.asyncResponse.connect) {
            plugin.asyncResponse.connect(handleAsyncResponse);
            responseConnected = true;
        }
    }

    function request(method) {
        return new Promise(resolve => {
            connectMediaEvents();
            if (!mediaReady() || typeof mediaPlugin()[method] !== "function") {
                resolve("");
                return;
            }
            const id = requestId++;
            pending.set(id, resolve);
            try {
                mediaPlugin()[method](id);
            } catch (_) {
                pending.delete(id);
                resolve("");
            }
            setTimeout(() => {
                if (!pending.has(id)) return;
                pending.delete(id);
                resolve("");
            }, 900);
        });
    }

    window.pluginMediadataproviderEvents = { onInitialized: function () { connectMediaEvents(); poll(); } };

    function showOverlay(title, sub) {
        $("stateTitle").textContent = title;
        $("stateSub").textContent = sub;
        $("stateOverlay").classList.add("visible");
    }

    function hideOverlay() {
        $("stateOverlay").classList.remove("visible");
    }

    function render(title, artist) {
        const hasMedia = !!(title || artist);
        $("trackName").textContent = title || "Windows Media";
        $("trackArtist").textContent = artist || "Play media on Windows";
        $("source").textContent = "iCUE";
        $("albumImg").hidden = true;
        $("fallbackOrb").hidden = false;
        if (hasMedia) hideOverlay();
        else showOverlay("Ready", "Start playback in YouTube, browser, or another media app.");
    }

    async function poll() {
        if (!mediaReady()) {
            showOverlay("Media", "Waiting for native iCUE media provider.");
            return;
        }
        connectMediaEvents();
        const plugin = mediaPlugin();
        const directTitle = String(plugin.songName || "");
        const directArtist = String(plugin.artist || "");
        const [title, artist] = directTitle || directArtist
            ? [directTitle, directArtist]
            : await Promise.all([request("getSongName"), request("getArtist")]);
        render(title.trim(), artist.trim());
    }

    function start() {
        if (pollTimer) return;
        connectMediaEvents();
        poll();
        pollTimer = setInterval(poll, POLL_MS);
    }

    window.WindowsMediaPump = { start, poll };
    window.icueEvents = { onICUEInitialized: start, onDataUpdated: poll };
    start();
})();
