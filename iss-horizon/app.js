/* jshint esversion: 11 */
'use strict';

(function () {

    // ── Constants ────────────────────────────────────────────────────
    const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';
    // ── ISS Live Sources ──────────────────────────────────────────────
    const SOURCES = [
        { id: 'zPH5KtjJFaQ', name: 'HD Views' },
        { id: 'FV4Q9DryTG8', name: 'Live Video' },
        { id: '0FBiyFpV__g', name: '24/7 Stream' },
    ];
    let currentSource = 0;

    // ── State ────────────────────────────────────────────────────────
    let settings = {
        videoId: localStorage.getItem('iss_video_id') || SOURCES[0].id,
    };

    let issData = { lat: 0, lon: 0, alt: 408, vel: 7660 };

    // ── DOM refs ─────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);
    const ytIframe = $('ytIframe');
    const valSpeed = $('valSpeed');
    const valAlt = $('valAlt');
    const valLat = $('valLat');
    const valLon = $('valLon');
    const settingsPanel = $('settingsPanel');
    const inputVideoId = $('inputVideoId');

    // ── Toast ─────────────────────────────────────────────────────────
    let toastTimer;
    function showToast(msg) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
    }

    // ── YouTube iframe helpers ────────────────────────────────────────
    function buildYTUrl(videoId) {
        return 'https://www.youtube.com/embed/' + videoId +
            '?autoplay=1&mute=1&modestbranding=1&rel=0&playsinline=1';
    }

    function loadVideo(videoId) {
        ytIframe.src = buildYTUrl(videoId);
    }

    // ── Source switch button ──────────────────────────────────────────
    $('sourceBtn').addEventListener('click', () => {
        currentSource = (currentSource + 1) % SOURCES.length;
        const src = SOURCES[currentSource];
        settings.videoId = src.id;
        localStorage.setItem('iss_video_id', src.id);
        loadVideo(src.id);
        $('sourceName').textContent = src.name;
        showToast('📷 ' + src.name);
    });

    // Init: match saved ID to source index
    const savedIdx = SOURCES.findIndex(s => s.id === settings.videoId);
    if (savedIdx >= 0) {
        currentSource = savedIdx;
        $('sourceName').textContent = SOURCES[savedIdx].name;
    }

    // ── Settings panel ────────────────────────────────────────────────
    $('settingsToggle').addEventListener('click', () => {
        inputVideoId.value = settings.videoId;
        settingsPanel.classList.add('open');
    });
    $('closeSettings').addEventListener('click', () => settingsPanel.classList.remove('open'));

    $('saveBtn').addEventListener('click', () => {
        const newId = inputVideoId.value.trim() || SOURCES[0].id;

        if (newId !== settings.videoId) {
            settings.videoId = newId;
            localStorage.setItem('iss_video_id', newId);
            loadVideo(newId);
        }

        settingsPanel.classList.remove('open');
        showToast('✓ Settings saved');
    });

    inputVideoId.value = settings.videoId;

    // =====================================================================
    // ── TELEMETRY DISPLAY
    // =====================================================================
    function updateTelemetry(velocity, altitude, lat, lon) {
        valSpeed.textContent = Math.round(velocity * 1000 / 3600) + ' m/s';
        valAlt.textContent = Math.round(altitude) + ' km';
        valLat.textContent = (lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S');
        valLon.textContent = (lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W');
    }

    // =====================================================================
    // ── ISS API POLLING
    // =====================================================================
    async function fetchISS() {
        try {
            const r = await fetch(ISS_API);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();

            issData = { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity };

            // Update telemetry panel
            updateTelemetry(d.velocity, d.altitude, d.latitude, d.longitude);

            // Update 2D map
            updateLeafletMap(d.latitude, d.longitude);

        } catch (e) {
            console.warn('[ISS] fetch error:', e);
        }
    }

    fetchISS();
    setInterval(fetchISS, 2000);

    // =====================================================================
    // ── ORBITAL GROUND TRACK COMPUTATION
    // =====================================================================
    const INCLINATION = 51.6;                         // degrees
    const ORBITAL_PERIOD = 92.68 * 60;                // seconds (~92.68 min)
    const EARTH_ROT_RATE = 360 / 86400;               // deg/s
    const GROUND_TRACK_RATE = 360 / ORBITAL_PERIOD - EARTH_ROT_RATE; // deg/s eastward
    const ORBIT_RANGE = ORBITAL_PERIOD * 1.5;          // 1.5 orbits each way
    const ORBIT_STEP = 30;                             // seconds between points

    let prevLat = null;
    let isAscending = true;

    /**
     * Split a polyline at the antimeridian (±180°) to avoid wrap-around glitches.
     */
    function splitAtAntimeridian(points) {
        const segments = [];
        let seg = [];
        for (let i = 0; i < points.length; i++) {
            if (seg.length > 0) {
                const dLon = Math.abs(points[i][1] - seg[seg.length - 1][1]);
                if (dLon > 180) {
                    segments.push(seg);
                    seg = [];
                }
            }
            seg.push(points[i]);
        }
        if (seg.length > 1) segments.push(seg);
        return segments;
    }

    /**
     * Compute orbital ground track points relative to a known position.
     * Returns { pastPoints, futurePoints }.
     */
    function computeOrbitTrack(lat, lon, ascending) {
        const inc = INCLINATION;
        const clampedLat = Math.max(-inc, Math.min(inc, lat));

        // Determine current orbital phase from latitude
        let phase0 = Math.asin(clampedLat / inc);
        if (!ascending) phase0 = Math.PI - phase0;

        const pastPts = [];
        const futurePts = [];

        // Past orbit (going backward in time)
        for (let dt = -ORBIT_RANGE; dt <= 0; dt += ORBIT_STEP) {
            const phase = phase0 + (2 * Math.PI / ORBITAL_PERIOD) * dt;
            const newLat = inc * Math.sin(phase);
            let newLon = lon + GROUND_TRACK_RATE * dt;
            newLon = ((newLon + 540) % 360) - 180;  // normalize to [-180, 180]
            pastPts.push([newLat, newLon]);
        }

        // Future orbit (going forward in time)
        for (let dt = 0; dt <= ORBIT_RANGE; dt += ORBIT_STEP) {
            const phase = phase0 + (2 * Math.PI / ORBITAL_PERIOD) * dt;
            const newLat = inc * Math.sin(phase);
            let newLon = lon + GROUND_TRACK_RATE * dt;
            newLon = ((newLon + 540) % 360) - 180;
            futurePts.push([newLat, newLon]);
        }

        return { pastPts, futurePts };
    }

    // =====================================================================
    // ── LEAFLET 2D GROUND TRACK MAP
    // =====================================================================
    let leafletMap = null, issMapMarker = null;
    let pastTrackGroup = null, futureTrackGroup = null;
    let mapFollowISS = true;

    function initLeafletMap() {
        if (typeof L === 'undefined') {
            console.warn('[ISS] Leaflet not loaded');
            return;
        }

        leafletMap = L.map('issMap', {
            zoomControl: true,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            keyboard: true,
        }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            subdomains: 'abcd',
        }).addTo(leafletMap);

        // ISS marker
        const issIcon = L.divIcon({
            className: 'iss-map-marker',
            html: '<div class="iss-dot-outer"><div class="iss-dot-inner"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });
        issMapMarker = L.marker([0, 0], { icon: issIcon, zIndexOffset: 1000 }).addTo(leafletMap);

        // Layer groups for orbit tracks
        pastTrackGroup = L.layerGroup().addTo(leafletMap);
        futureTrackGroup = L.layerGroup().addTo(leafletMap);

        leafletMap.on('dragstart', () => {
            mapFollowISS = false;
            $('mapFollowBtn').classList.remove('active');
        });

        setTimeout(() => leafletMap.invalidateSize(), 200);
        console.log('[ISS] Leaflet map initialized OK');
    }

    function updateLeafletMap(lat, lon) {
        if (!issMapMarker) return;
        issMapMarker.setLatLng([lat, lon]);

        // Determine ascending / descending
        if (prevLat !== null) {
            isAscending = lat > prevLat;
        }
        prevLat = lat;

        // Compute orbital tracks
        const { pastPts, futurePts } = computeOrbitTrack(lat, lon, isAscending);

        // Render past orbit (white)
        pastTrackGroup.clearLayers();
        const pastSegments = splitAtAntimeridian(pastPts);
        pastSegments.forEach(seg => {
            L.polyline(seg, {
                color: '#ffffff',
                weight: 1.8,
                opacity: 0.45,
                dashArray: null,
                className: 'orbit-past-line',
            }).addTo(pastTrackGroup);
        });

        // Render future orbit (yellow)
        futureTrackGroup.clearLayers();
        const futureSegments = splitAtAntimeridian(futurePts);
        futureSegments.forEach(seg => {
            L.polyline(seg, {
                color: '#ffd700',
                weight: 1.8,
                opacity: 0.55,
                dashArray: '6, 4',
                className: 'orbit-future-line',
            }).addTo(futureTrackGroup);
        });

        // Follow ISS
        if (mapFollowISS && leafletMap) {
            leafletMap.panTo([lat, lon], { animate: true, duration: 0.8 });
        }
    }

    $('mapFollowBtn').addEventListener('click', () => {
        mapFollowISS = !mapFollowISS;
        $('mapFollowBtn').classList.toggle('active', mapFollowISS);
        if (mapFollowISS && leafletMap) {
            leafletMap.panTo([issData.lat, issData.lon], { animate: true });
        }
    });

    // Start Leaflet
    initLeafletMap();

})();
