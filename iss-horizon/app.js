/* jshint esversion: 11 */
'use strict';

(function () {

    // ── Constants & Config ───────────────────────────────────────────
    const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';

    // YouTube & IBM Video sources (2026)
    const SOURCES = [
        { id: 'zPH5KtjJFaQ', name: 'HD Views', type: 'youtube' },
        { id: 'ffcV3jCwwPk', name: 'NASA ISS Update', type: 'youtube' },
        { id: '5TriOUb0leg', name: 'ISS 4K HDR Live', type: 'youtube' },
        { id: '21X5lGlDOfg', name: 'NASA Live', type: 'youtube' },
        { id: 'FV4Q9DryTG8', name: 'NASA ISS Live (Official)', type: 'youtube' },
        { id: 'fO9e9jnhYK8', name: 'Sen 4K Earth Live', type: 'youtube' },
        { id: '0FBiyFpV__g', name: 'ISS 24/7 Stream', type: 'youtube' },
        { id: 'vytmBNhc9ig', name: 'NASA Earth Live 24/7', type: 'youtube' },
        { id: '17074538', name: 'NASA HDEV (IBM)', type: 'ibm' }
    ];
    const query = new URLSearchParams(location.search);
    const forcedProvider = (query.get('provider') || '').toLowerCase();
    const allowUnstable = query.get('allowUnstable') === '1';
    const allowIcueBlocked = query.get('allowIcueBlocked') === '1';
    const IS_LOCAL_FILE = location.protocol === 'file:';
    const IS_ICUE_WEBVIEW = /icue|corsair/i.test(navigator.userAgent || '');
    const FORCE_IBM_ONLY = forcedProvider === 'ibm' || forcedProvider === 'safe';
    const FORCE_ICUE_SAFE = IS_ICUE_WEBVIEW && !allowIcueBlocked && forcedProvider !== 'youtube';
    const ALLOW_YOUTUBE = !IS_LOCAL_FILE && !FORCE_IBM_ONLY && !FORCE_ICUE_SAFE;
    const THEATER_DEFAULT = true;
    const KNOWN_UNSTABLE_YOUTUBE_IDS = new Set(['0FBiyFpV__g']);
    const ICUE_BLOCKED_YOUTUBE_IDS = new Set([
        'FV4Q9DryTG8', // NASA ISS Live (Official)
        'fO9e9jnhYK8', // Sen 4K Earth Live
        '0FBiyFpV__g', // ISS 24/7 Stream
        'vytmBNhc9ig'  // NASA Earth Live 24/7
    ]);
    const FALLBACK_IBM_SOURCE = SOURCES.find(s => s.type === 'ibm') || SOURCES[0];
    const PLAYABLE_SOURCES = ALLOW_YOUTUBE
        ? SOURCES.filter((s) => {
            if (s.type !== 'youtube') return true;
            if (!allowUnstable && KNOWN_UNSTABLE_YOUTUBE_IDS.has(s.id)) return false;
            if (IS_ICUE_WEBVIEW && !allowIcueBlocked && ICUE_BLOCKED_YOUTUBE_IDS.has(s.id)) return false;
            return true;
        })
        : SOURCES.filter(s => s.type === 'ibm');
    if (!PLAYABLE_SOURCES.length) PLAYABLE_SOURCES.push(...SOURCES);
    let currentSourceIdx = 0;

    const $ = (id) => document.getElementById(id);
    let issData = { lat: 0, lon: 0, alt: 408, vel: 7660 };

    // ── Video Player (YouTube / IBM iframe) ──────────────────────────
    const iframe = $('videoIframe');
    const btnMute = $('btnMute');
    const iconMute = $('iconMute');
    const btnSwitchSource = $('btnSwitchSource');
    const lbSource = $('lbSource');
    const videoZone = $('videoZone');
    const SVG_NS = 'http://www.w3.org/2000/svg';

    let isMuted = true;
    const EMBED_ORIGIN_FALLBACK = 'https://stealthylabshq.github.io';
    const YOUTUBE_EMBED_HOST = 'https://www.youtube-nocookie.com';

    function appendSvgElement(parent, tag, attrs) {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
        parent.appendChild(el);
    }

    function getEmbedIdentity() {
        const origin = (location.origin && location.origin !== 'null') ? location.origin : EMBED_ORIGIN_FALLBACK;
        const widgetReferrer = location.href && /^https?:\/\//.test(location.href)
            ? location.href
            : `${EMBED_ORIGIN_FALLBACK}/iframe-edge/iss-horizon/`;
        return { origin, widgetReferrer };
    }

    function buildIframeSrc(source, muted) {
        if (source.type === 'ibm') {
            const vol = muted ? 0 : 100;
            return `https://video.ibm.com/embed/${source.id}?autoplay=1&volume=${vol}&controls=0&showtitle=false`;
        }
        // YouTube: mute=1 means muted, mute=0 means unmuted
        const { origin, widgetReferrer } = getEmbedIdentity();
        const params = new URLSearchParams({
            autoplay: '1',
            mute: muted ? '1' : '0',
            controls: '0',
            modestbranding: '1',
            rel: '0',
            iv_load_policy: '3',
            disablekb: '1',
            fs: '0',
            playsinline: '1',
            enablejsapi: '1',
            origin,
            widget_referrer: widgetReferrer
        });
        return `${YOUTUBE_EMBED_HOST}/embed/${source.id}?${params.toString()}`;
    }

    function resolvePlayableSource(source) {
        if (!source) return PLAYABLE_SOURCES[0];
        if (!ALLOW_YOUTUBE && source.type === 'youtube') return FALLBACK_IBM_SOURCE;
        return source;
    }

    function loadSource(source) {
        const playable = resolvePlayableSource(source);
        iframe.src = buildIframeSrc(playable, isMuted);
        lbSource.textContent = playable.name;
        videoZone.classList.remove('is-error');
        const theaterOn = THEATER_DEFAULT && playable.type === 'youtube';
        document.body.classList.toggle('is-theater', theaterOn);
        return playable;
    }

    // Load saved settings
    try {
        const sm = localStorage.getItem('iss_mute');
        if (sm !== null) isMuted = (sm === 'true');

        const sid = localStorage.getItem('iss_source');
        if (sid) {
            const saved = SOURCES.find(s => s.id === sid);
            const playableSaved = resolvePlayableSource(saved);
            const idx = PLAYABLE_SOURCES.findIndex(s => s.id === playableSaved.id);
            if (idx >= 0) currentSourceIdx = idx;
        }
    } catch (e) { }

    // Init
    updateMuteIcon();
    loadSource(PLAYABLE_SOURCES[currentSourceIdx]);
    if (FORCE_ICUE_SAFE) {
        btnSwitchSource.title = 'iCUE-safe mode: IBM fallback active';
    } else if (IS_ICUE_WEBVIEW && !allowIcueBlocked && PLAYABLE_SOURCES.length > 1) {
        btnSwitchSource.title = 'iCUE-safe source list active';
    }
    if (PLAYABLE_SOURCES.length <= 1) {
        btnSwitchSource.style.pointerEvents = 'none';
        btnSwitchSource.style.opacity = '0.7';
        btnSwitchSource.title = 'Single compatible stream in this environment';
    }

    // Mute toggle
    btnMute.addEventListener('click', () => {
        isMuted = !isMuted;
        try { localStorage.setItem('iss_mute', isMuted); } catch (e) { }
        updateMuteIcon();
        // Reload iframe with new mute state
        loadSource(PLAYABLE_SOURCES[currentSourceIdx]);
    });

    function updateMuteIcon() {
        iconMute.replaceChildren();
        appendSvgElement(iconMute, 'polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' });
        if (isMuted) {
            appendSvgElement(iconMute, 'line', { x1: '23', y1: '9', x2: '17', y2: '15' });
            appendSvgElement(iconMute, 'line', { x1: '17', y1: '9', x2: '23', y2: '15' });
        } else {
            appendSvgElement(iconMute, 'path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' });
            appendSvgElement(iconMute, 'path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' });
        }
    }

    // Source toggle
    btnSwitchSource.addEventListener('click', () => {
        currentSourceIdx = (currentSourceIdx + 1) % PLAYABLE_SOURCES.length;
        const src = PLAYABLE_SOURCES[currentSourceIdx];
        try { localStorage.setItem('iss_source', src.id); } catch (e) { }
        loadSource(src);
    });

    // ── Day / Night Calculation ──────────────────────────────────────
    // A simplified solar declination algorithm to approximate if ISS is in sunlight
    function calculateDayNight(lat, lon, date = new Date()) {
        const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180));

        // Equation of time (approximate in minutes)
        const B = (360 / 365) * (dayOfYear - 81) * (Math.PI / 180);
        const eqTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

        // Solar time at longitude
        let tcFraction = 4 * lon + eqTime;
        let localSolarTime = date.getUTCHours() + date.getUTCMinutes() / 60 + tcFraction / 60;
        if (localSolarTime < 0) localSolarTime += 24;
        if (localSolarTime > 24) localSolarTime -= 24;

        // Hour angle
        let hourAngle = (localSolarTime - 12) * 15;

        // Calculate altitude of the sun
        const latRad = lat * (Math.PI / 180);
        const decRad = declination * (Math.PI / 180);
        const haRad = hourAngle * (Math.PI / 180);

        const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
        const sunAltitude = Math.asin(sinAlt) * (180 / Math.PI);

        // ISS altitude horizon depression (in degrees). At ~400km, you can see the sun even if it's "set" on the ground.
        // Approx formula: depression = acos(EarthRadius / (EarthRadius + ISSAltitude))
        // EarthRadius ~ 6371km. acos(6371/6771) ~ 19 degrees.
        // So the ISS sees the sun if sunAltitude > -19 degrees.
        return sunAltitude > -19;
    }

    function updateSolarBadge(lat, lon) {
        const isDay = calculateDayNight(lat, lon);
        const badge = $('solarBadge');
        if (isDay) {
            badge.className = 'solar-badge is-day';
            $('solarIcon').textContent = '☀️';
            $('solarText').textContent = 'SUNLIGHT';
        } else {
            badge.className = 'solar-badge is-night';
            $('solarIcon').textContent = '🌙';
            $('solarText').textContent = 'ECLIPSE';
        }
    }


    // ── Telemetry & API ──────────────────────────────────────────────
    function updateTelemetry(vel, alt, lat, lon) {
        $('valSpeed').textContent = Math.round(vel * 1000 / 3600) + ' m/s';
        $('valAlt').textContent = Math.round(alt) + ' km';
        $('valLat').textContent = (lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S');
        $('valLon').textContent = (lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W');

        updateSolarBadge(lat, lon);
    }

    async function fetchISS() {
        try {
            const r = await fetch(ISS_API);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();

            issData = { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity };

            try {
                localStorage.setItem('iss_cache', JSON.stringify(issData));
            } catch (e) { }

            updateTelemetry(d.velocity, d.altitude, d.latitude, d.longitude);
            updateLeafletMap(d.latitude, d.longitude);

        } catch (e) {
            console.warn('[ISS API] fetch error:', e);
        }
    }

    fetchISS();
    setInterval(fetchISS, 2000);


    // ── Orbital Ground Track (Math) ──────────────────────────────────
    const INCLINATION = 51.6;
    const ORBITAL_PERIOD = 92.68 * 60;
    const EARTH_ROT_RATE = 360 / 86400;
    const GROUND_TRACK_RATE = 360 / ORBITAL_PERIOD - EARTH_ROT_RATE;
    const ORBIT_RANGE = ORBITAL_PERIOD * 6;
    const ORBIT_STEP = 60;

    let prevLat = null;
    let isAscending = true;

    function computeOrbitTrack(lat, lon, ascending) {
        const inc = INCLINATION;
        const clampedLat = Math.max(-inc, Math.min(inc, lat));
        let phase0 = Math.asin(clampedLat / inc);
        if (!ascending) phase0 = Math.PI - phase0;

        const pastPts = [], futurePts = [];

        for (let dt = -ORBIT_RANGE; dt <= 0; dt += ORBIT_STEP) {
            const phase = phase0 + (2 * Math.PI / ORBITAL_PERIOD) * dt;
            const newLat = inc * Math.sin(phase);
            const newLon = lon + GROUND_TRACK_RATE * dt;
            pastPts.push([newLat, newLon]);
        }
        for (let dt = 0; dt <= ORBIT_RANGE; dt += ORBIT_STEP) {
            const phase = phase0 + (2 * Math.PI / ORBITAL_PERIOD) * dt;
            const newLat = inc * Math.sin(phase);
            const newLon = lon + GROUND_TRACK_RATE * dt;
            futurePts.push([newLat, newLon]);
        }
        return { pastPts, futurePts };
    }

    function createUnreachablePassPopup(clickLat) {
        const safeLat = Number.isFinite(clickLat) ? clickLat : 0;
        const container = document.createElement('div');

        const title = document.createElement('div');
        title.className = 'pass-popup-title';
        title.textContent = 'ISS Flyover';

        const status = document.createElement('div');
        status.className = 'pass-popup-unreachable';
        status.textContent = 'Unreachable';

        const detail = document.createElement('div');
        detail.className = 'pass-popup-detail';
        detail.append(`The ISS orbit (${INCLINATION} deg inclination)`);
        detail.appendChild(document.createElement('br'));
        detail.append(`does not reach this latitude (${Math.abs(safeLat).toFixed(1)} deg).`);

        container.append(title, status, detail);
        return container;
    }

    function createNextPassPopup(timeStr, dateStr, relStr, distKm) {
        const safeDist = Number.isFinite(distKm) ? Math.max(0, Math.round(distKm)) : 0;
        const container = document.createElement('div');

        const title = document.createElement('div');
        title.className = 'pass-popup-title';
        title.textContent = 'Next ISS Flyover';

        const time = document.createElement('div');
        time.className = 'pass-popup-time';
        time.textContent = String(timeStr || '--:--');

        const eta = document.createElement('div');
        eta.className = 'pass-popup-detail';
        eta.textContent = `${String(dateStr || '')} - in ~${String(relStr || '0min')}`;

        const distance = document.createElement('div');
        distance.className = 'pass-popup-detail';
        distance.textContent = `Closest approach: ~${safeDist} km`;

        container.append(title, time, eta, distance);
        return container;
    }


    // ── Leaflet Map Setup ────────────────────────────────────────────
    let leafletMap = null, issMapMarker = null;
    let pastPolylines = [], futurePolylines = [];
    let mapFollowISS = true;

    function initLeafletMap() {
        if (typeof L === 'undefined') return;

        leafletMap = L.map('issMap', {
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            minZoom: 2,
            maxZoom: 15,
            maxBounds: [[-85, -9999], [85, 9999]],
            maxBoundsViscosity: 1.0,
        }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            subdomains: 'abcd',
        }).addTo(leafletMap);

        const issIcon = L.divIcon({
            className: 'iss-map-marker',
            html: '<div class="iss-dot"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });
        issMapMarker = L.marker([0, 0], { icon: issIcon, zIndexOffset: 1000 }).addTo(leafletMap);

        leafletMap.on('dragstart', () => {
            // In follow mode, block drag — only the button can toggle follow off
            if (mapFollowISS) return;
        });

        // ── ISS Pass Prediction on Right-Click ───────────────
        leafletMap.on('contextmenu', (e) => {
            const clickLat = e.latlng.lat;
            const clickLon = e.latlng.lng;

            // ISS cannot pass over latitudes beyond ±inclination
            if (Math.abs(clickLat) > INCLINATION) {
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(createUnreachablePassPopup(clickLat))
                    .openOn(leafletMap);
                return;
            }

            const result = predictNextPass(clickLat, clickLon);
            if (result) {
                const passDate = new Date(Date.now() + result.dt * 1000);
                const timeStr = passDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = passDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
                const distKm = Math.round(result.dist);

                // Relative time
                const hoursAway = Math.floor(result.dt / 3600);
                const minsAway = Math.floor((result.dt % 3600) / 60);
                let relStr = '';
                if (hoursAway > 0) relStr += hoursAway + 'h ';
                relStr += minsAway + 'min';

                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(createNextPassPopup(timeStr, dateStr, relStr, distKm))
                    .openOn(leafletMap);
            }
        });

        setTimeout(() => leafletMap.invalidateSize(), 200);
    }

    // ── ISS Pass Prediction Algorithm ────────────────────────────────
    // Iterates forward in time using the same simplified orbital model
    // to find the next closest approach of the ISS ground track to a point.
    function predictNextPass(targetLat, targetLon) {
        if (!issData || isNaN(issData.lat)) return null;

        const currentLat = issData.lat;
        const currentLon = issData.lon;
        const inc = INCLINATION;
        const clampedLat = Math.max(-inc, Math.min(inc, currentLat));

        let phase0 = Math.asin(clampedLat / inc);
        if (!isAscending) phase0 = Math.PI - phase0;

        const SEARCH_RANGE = ORBITAL_PERIOD * 48; // search up to ~3 days ahead
        const COARSE_STEP = 30;                    // 30s coarse scan
        const FINE_STEP = 2;                       // 2s fine scan

        let bestDt = null;
        let bestDist = Infinity;

        // Earth radius in km
        const R = 6371;

        function haversine(lat1, lon1, lat2, lon2) {
            const toRad = (d) => d * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return 2 * R * Math.asin(Math.sqrt(a));
        }

        function issPositionAt(dt) {
            const phase = phase0 + (2 * Math.PI / ORBITAL_PERIOD) * dt;
            const lat = inc * Math.sin(phase);
            let lon = currentLon + GROUND_TRACK_RATE * dt;
            // Wrap to [-180, 180]
            lon = ((lon + 180) % 360 + 360) % 360 - 180;
            return { lat, lon };
        }

        // Coarse scan: find approximate closest approach windows
        const PASS_THRESHOLD = 500; // km — consider "near" if within 500km
        let candidates = [];

        for (let dt = 60; dt <= SEARCH_RANGE; dt += COARSE_STEP) {
            const pos = issPositionAt(dt);
            const dist = haversine(targetLat, targetLon, pos.lat, pos.lon);
            if (dist < PASS_THRESHOLD && (candidates.length === 0 || dt - candidates[candidates.length - 1].dt > ORBITAL_PERIOD * 0.3)) {
                candidates.push({ dt, dist });
            }
        }

        // Fine scan around each candidate
        for (const cand of candidates) {
            const start = Math.max(60, cand.dt - COARSE_STEP * 3);
            const end = cand.dt + COARSE_STEP * 3;
            for (let dt = start; dt <= end; dt += FINE_STEP) {
                const pos = issPositionAt(dt);
                const dist = haversine(targetLat, targetLon, pos.lat, pos.lon);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestDt = dt;
                }
            }
        }

        // If no candidate found in coarse scan, do a full fine scan on just the nearest coarse point
        if (bestDt === null) {
            for (let dt = 60; dt <= SEARCH_RANGE; dt += COARSE_STEP) {
                const pos = issPositionAt(dt);
                const dist = haversine(targetLat, targetLon, pos.lat, pos.lon);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestDt = dt;
                }
            }
        }

        return bestDt !== null ? { dt: bestDt, dist: bestDist } : null;
    }

    function syncPolylines(pool, segments, style) {
        segments.forEach((seg, i) => {
            if (pool[i]) pool[i].setLatLngs(seg);
            else pool[i] = L.polyline(seg, style).addTo(leafletMap);
        });
        for (let i = segments.length; i < pool.length; i++) {
            leafletMap.removeLayer(pool[i]);
        }
        pool.length = segments.length;
    }

    function updateLeafletMap(lat, lon) {
        if (!issMapMarker) return;
        issMapMarker.setLatLng([lat, lon]);

        if (prevLat !== null) {
            isAscending = lat > prevLat;
        }
        prevLat = lat;

        const { pastPts, futurePts } = computeOrbitTrack(lat, lon, isAscending);

        syncPolylines(pastPolylines, [pastPts], {
            color: '#5f6368',           // Muted grey for past
            weight: 2,
            opacity: 0.6,
            className: 'orbit-past-line',
        });

        syncPolylines(futurePolylines, [futurePts], {
            color: '#fc3d21',           // NASA Orange for future
            weight: 2,
            opacity: 0.8,
            dashArray: '6, 6',
            className: 'orbit-future-line',
        });

        if (mapFollowISS && leafletMap) {
            leafletMap.setView([lat, lon], leafletMap.getZoom(), { animate: true, duration: 0.8 });
        }
    }

    function setFollowMode(enabled) {
        mapFollowISS = enabled;
        $('btnFollow').classList.toggle('active', enabled);
        if (leafletMap) {
            if (enabled) {
                leafletMap.dragging.disable();
                leafletMap.setView([issData.lat, issData.lon], leafletMap.getZoom(), { animate: true });
            } else {
                leafletMap.dragging.enable();
            }
        }
    }

    $('btnFollow').addEventListener('click', () => {
        setFollowMode(!mapFollowISS);
    });

    initLeafletMap();

    // Instant render from cache
    try {
        const cached = JSON.parse(localStorage.getItem('iss_cache'));
        if (cached) {
            const lat = Number(cached.lat);
            const lon = Number(cached.lon);
            const alt = Number(cached.alt);
            const vel = Number(cached.vel);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                issData = {
                    lat,
                    lon,
                    alt: Number.isFinite(alt) ? alt : issData.alt,
                    vel: Number.isFinite(vel) ? vel : issData.vel
                };
                updateTelemetry(issData.vel, issData.alt, issData.lat, issData.lon);
                updateLeafletMap(issData.lat, issData.lon);
            }
        }
    } catch (_) { }

})();
