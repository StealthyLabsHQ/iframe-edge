/* jshint esversion: 11 */
'use strict';

(function () {

    // ── Constants ────────────────────────────────────────────────────
    const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';
    const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
    const DEFAULT_VIDEO_ID = 'itdOFB8DQCA';  // NASA HDEV Live
    const TRAIL_LENGTH = 120;               // number of past positions kept
    const ORBITAL_PERIOD_S = 92 * 60;      // ~92 min in seconds

    // ── State ────────────────────────────────────────────────────────
    let settings = {
        videoId: localStorage.getItem('iss_video_id') || DEFAULT_VIDEO_ID,
        autoRotateSpeed: parseFloat(localStorage.getItem('iss_autorotate') ?? '3'),
    };

    let issData = { lat: 0, lon: 0, alt: 408, vel: 7660 };
    let trailPositions = [];       // Array of {lat, lon} for past positions
    let cockpitMode = false;
    let hintHidden = false;
    let ytPlayer = null;
    let isMuted = true;
    let geocodeCache = {};
    let geocodeTimer = null;

    // ── DOM refs ─────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const globeZone = $('globeZone');
    const canvas = $('globeCanvas');
    const cockpitBtn = $('cockpitBtn');
    const muteBtn = $('muteBtn');
    const muteIcon = $('muteIcon');
    const unmuteIcon = $('unmuteIcon');
    const cityPopup = $('cityPopup');
    const popupName = $('cityPopupName');
    const popupPass = $('cityPopupPass');
    const globeHint = $('globeHint');
    const cockpitLabel = $('cockpitLabel');
    const valSpeed = $('valSpeed');
    const valAlt = $('valAlt');
    const valLat = $('valLat');
    const valLon = $('valLon');
    const settingsPanel = $('settingsPanel');
    const inputVideoId = $('inputVideoId');
    const inputAutoRotate = $('inputAutoRotate');
    const rotateVal = $('rotateVal');

    // ── Toast ─────────────────────────────────────────────────────────
    let toastTimer;
    function showToast(msg) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
    }

    // ── Settings panel ────────────────────────────────────────────────
    $('settingsToggle').addEventListener('click', () => {
        inputVideoId.value = settings.videoId;
        inputAutoRotate.value = settings.autoRotateSpeed;
        rotateVal.textContent = settings.autoRotateSpeed;
        settingsPanel.classList.add('open');
    });
    $('closeSettings').addEventListener('click', () => settingsPanel.classList.remove('open'));

    inputAutoRotate.addEventListener('input', () => {
        rotateVal.textContent = inputAutoRotate.value;
    });

    $('saveBtn').addEventListener('click', () => {
        const newId = inputVideoId.value.trim() || DEFAULT_VIDEO_ID;
        settings.autoRotateSpeed = parseFloat(inputAutoRotate.value);
        localStorage.setItem('iss_autorotate', settings.autoRotateSpeed);

        if (newId !== settings.videoId) {
            settings.videoId = newId;
            localStorage.setItem('iss_video_id', newId);
            reloadYT();
        }

        settingsPanel.classList.remove('open');
        showToast('✓ Settings saved');
    });

    // ── YouTube IFrame API ───────────────────────────────────────────
    function buildYT(videoId) {
        if (typeof YT === 'undefined' || !YT.Player) return;
        const div = $('ytPlayer');
        div.innerHTML = '';
        const inner = document.createElement('div');
        inner.id = 'ytInner';
        div.appendChild(inner);

        ytPlayer = new YT.Player('ytInner', {
            videoId,
            playerVars: {
                autoplay: 1,
                mute: 1,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                iv_load_policy: 3,
                fs: 0,
            },
            width: '100%',
            height: '100%',
            events: {
                onReady: (e) => {
                    e.target.playVideo();
                    isMuted = true;
                    syncMuteUI();
                },
                onError: () => showOfflinePlaceholder(),
            },
        });
    }

    function reloadYT() {
        if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
        buildYT(settings.videoId);
    }

    function showOfflinePlaceholder() {
        $('videoZone').innerHTML = `
            <div class="video-offline">
                <div class="video-offline-icon">📡</div>
                <div>NASA live stream currently unavailable</div>
            </div>`;
    }

    // Called by YouTube API when ready
    window.onYouTubeIframeAPIReady = function () {
        buildYT(settings.videoId);
    };

    // Mute toggle
    muteBtn.addEventListener('click', () => {
        if (!ytPlayer) return;
        if (isMuted) {
            ytPlayer.unMute();
            ytPlayer.setVolume(80);
        } else {
            ytPlayer.mute();
        }
        isMuted = !isMuted;
        syncMuteUI();
    });

    function syncMuteUI() {
        muteIcon.classList.toggle('ui-hidden', !isMuted);
        unmuteIcon.classList.toggle('ui-hidden', isMuted);
    }

    // ── Three.js Scene ───────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2.8);

    // Lights — ambient raised so earth is visible even before textures load
    const ambientLight = new THREE.AmbientLight(0x334466, 2.5);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffeedd, 2.2);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Texture loader
    const texLoader = new THREE.TextureLoader();

    // Earth geometry
    const earthGeo = new THREE.SphereGeometry(1, 64, 64);

    // Fallback material shown instantly (blue ocean color) while textures load
    const earthMat = new THREE.MeshPhongMaterial({
        color: 0x1a4d7a,
        specular: new THREE.Color(0x224466),
        shininess: 18,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Load textures — correct filenames from three-globe npm package
    const TEX_BASE = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/';

    texLoader.load(TEX_BASE + 'earth-blue-marble.jpg',
        (tex) => { earthMat.map = tex; earthMat.specularMap = tex; earthMat.needsUpdate = true; },
        undefined,
        () => console.warn('[ISS] day texture failed, using fallback color')
    );
    texLoader.load(TEX_BASE + 'earth-topology.png',
        (tex) => { earthMat.bumpMap = tex; earthMat.bumpScale = 0.04; earthMat.needsUpdate = true; },
        undefined,
        () => { /* no bump is fine */ }
    );

    // Night-lights overlay — declared BEFORE the async load so the callback can reference it safely
    const nightMat = new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
    });
    const nightSphere = new THREE.Mesh(new THREE.SphereGeometry(1.001, 64, 64), nightMat);
    scene.add(nightSphere);

    // Night lights texture (loaded after nightMat/nightSphere exist)
    texLoader.load(TEX_BASE + 'earth-night.jpg',
        (tex) => { nightMat.map = tex; nightMat.needsUpdate = true; },
        undefined,
        () => { nightSphere.visible = false; }
    );

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(1.06, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(0x0044aa) },
        },
        vertexShader: `
            varying float vFresnel;
            void main() {
                vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
                vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
                vFresnel = pow(1.0 - dot(worldNormal, viewDir), 3.5);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            varying float vFresnel;
            void main() {
                gl_FragColor = vec4(glowColor, vFresnel * 0.7);
            }
        `,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    // Stars background
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
        starPositions[i] = (Math.random() - 0.5) * 80;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.08,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.75,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── ISS Marker ───────────────────────────────────────────────────
    // Create a glowing dot texture via canvas
    function makeISSTexture(size = 64) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const cx = size / 2;

        // Outer glow
        const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
        grad.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
        grad.addColorStop(0.3, 'rgba(0, 212, 255, 0.6)');
        grad.addColorStop(0.6, 'rgba(0, 100, 200, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        // Core dot
        ctx.beginPath();
        ctx.arc(cx, cx, size * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        return new THREE.CanvasTexture(c);
    }

    const issSpriteMat = new THREE.SpriteMaterial({
        map: makeISSTexture(128),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const issSprite = new THREE.Sprite(issSpriteMat);
    issSprite.scale.set(0.12, 0.12, 1);
    scene.add(issSprite);

    // Pulsing ring around ISS
    const ringGeo = new THREE.RingGeometry(0.05, 0.07, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const issRing = new THREE.Mesh(ringGeo, ringMat);
    scene.add(issRing);

    // ── Orbital Trail ────────────────────────────────────────────────
    const MAX_TRAIL = TRAIL_LENGTH;
    const trailGeo = new THREE.BufferGeometry();
    const trailPositionArray = new Float32Array(MAX_TRAIL * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositionArray, 3));
    const trailMat = new THREE.LineBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.35,
        linewidth: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);

    // Future prediction trail (lighter, different color)
    const futureTrailGeo = new THREE.BufferGeometry();
    const futureTrailArray = new Float32Array(60 * 3);
    futureTrailGeo.setAttribute('position', new THREE.BufferAttribute(futureTrailArray, 3));
    const futureTrailMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        linewidth: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const futureTrailLine = new THREE.Line(futureTrailGeo, futureTrailMat);
    scene.add(futureTrailLine);

    // ── Coordinate helpers ───────────────────────────────────────────
    function latLonToVec3(lat, lon, radius = 1.02) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    function vec3ToLatLon(v) {
        const r = v.length();
        const lat = 90 - Math.acos(v.y / r) * (180 / Math.PI);
        let lon = Math.atan2(v.z, -v.x) * (180 / Math.PI) - 180;
        if (lon < -180) lon += 360;
        return { lat, lon };
    }

    // ── ISS position update ──────────────────────────────────────────
    function updateISSPosition(lat, lon) {
        const pos = latLonToVec3(lat, lon, 1.05);

        // Move ISS sprite
        issSprite.position.copy(pos);

        // Orient ring to face outward from globe center
        issRing.position.copy(pos);
        issRing.lookAt(0, 0, 0);
        issRing.rotateX(Math.PI / 2);

        // Append to trail
        if (trailPositions.length === 0 ||
            Math.abs(lat - trailPositions[trailPositions.length - 1].lat) > 0.05 ||
            Math.abs(lon - trailPositions[trailPositions.length - 1].lon) > 0.05) {
            trailPositions.push({ lat, lon });
        }
        if (trailPositions.length > MAX_TRAIL) {
            trailPositions.shift();
        }

        // Update trail geometry
        const posAttr = trailGeo.attributes.position;
        const n = trailPositions.length;
        for (let i = 0; i < n; i++) {
            const v = latLonToVec3(trailPositions[i].lat, trailPositions[i].lon, 1.02);
            posAttr.setXYZ(i, v.x, v.y, v.z);
        }
        // Pad remaining
        for (let i = n; i < MAX_TRAIL; i++) {
            const last = n > 0 ? trailPositions[n - 1] : { lat, lon };
            const v = latLonToVec3(last.lat, last.lon, 1.02);
            posAttr.setXYZ(i, v.x, v.y, v.z);
        }
        posAttr.needsUpdate = true;
        trailGeo.setDrawRange(0, n);

        // Future trail prediction (approximate straight orbital path)
        const futureAttr = futureTrailGeo.attributes.position;
        const FUTURE_STEPS = 60;
        const stepLon = 360 / (ORBITAL_PERIOD_S / 60) * 2; // deg per step (2s per step)
        let fLat = lat, fLon = lon;
        for (let i = 0; i < FUTURE_STEPS; i++) {
            fLon += stepLon;
            if (fLon > 180) fLon -= 360;
            const v = latLonToVec3(fLat, fLon, 1.02);
            futureAttr.setXYZ(i, v.x, v.y, v.z);
        }
        futureAttr.needsUpdate = true;
        futureTrailGeo.setDrawRange(0, FUTURE_STEPS);

        // Also update 2D Leaflet map
        updateLeafletMap(lat, lon);
    }

    // ── Telemetry display ────────────────────────────────────────────
    function updateTelemetry(velocity, altitude, lat, lon) {
        valSpeed.textContent = Math.round(velocity * 1000 / 3600) + ' m/s';
        valAlt.textContent = Math.round(altitude) + ' km';
        valLat.textContent = (lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S');
        valLon.textContent = (lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W');
    }

    // ── ISS API Polling ──────────────────────────────────────────────
    async function fetchISS() {
        try {
            const r = await fetch(ISS_API);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();

            issData = {
                lat: d.latitude,
                lon: d.longitude,
                alt: d.altitude,
                vel: d.velocity,
            };

            updateISSPosition(d.latitude, d.longitude);
            updateTelemetry(d.velocity, d.altitude, d.latitude, d.longitude);

            // Update cockpit if active
            if (cockpitMode) applyCockpitCamera();

        } catch (e) {
            console.warn('[ISS] fetch error:', e);
        }
    }

    fetchISS();
    setInterval(fetchISS, 1000);

    // ── Globe Drag Rotation ──────────────────────────────────────────
    let isDragging = false;
    let prevPointer = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };
    let dragTarget = new THREE.Euler();

    canvas.addEventListener('pointerdown', (e) => {
        if (cockpitMode) return;
        isDragging = true;
        prevPointer = { x: e.clientX, y: e.clientY };
        velocity = { x: 0, y: 0 };
        hideHint();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        const scale = 0.006;

        earth.rotation.y += dx * scale;
        earth.rotation.x += dy * scale;
        nightSphere.rotation.y = earth.rotation.y;
        nightSphere.rotation.x = earth.rotation.x;

        velocity = { x: dx * scale * 0.7, y: dy * scale * 0.7 };
        prevPointer = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);
    function stopDrag() { isDragging = false; }

    // Clamp Earth X rotation
    const MAX_X_ROT = Math.PI / 2 - 0.1;

    // ── Tap-to-Locate ────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    let tapStart = { x: 0, y: 0 };

    canvas.addEventListener('pointerdown', (e) => {
        tapStart = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('pointerup', async (e) => {
        const dist = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
        if (dist > 6) return; // was a drag, not a tap

        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(earth);
        if (!hits.length) return;

        const worldPt = hits[0].point;
        // Undo earth rotation to get true lat/lon
        const invEarth = new THREE.Matrix4().copy(earth.matrixWorld).invert();
        const localPt = worldPt.clone().applyMatrix4(invEarth);
        const { lat, lon } = vec3ToLatLon(localPt.normalize());

        // Show popup at screen coords
        showCityPopup(lat, lon, e.clientX - rect.left, e.clientY - rect.top);
        hideHint();
    });

    async function showCityPopup(lat, lon, sx, sy) {
        cityPopup.classList.remove('hidden');
        popupName.textContent = '…';
        popupPass.textContent = 'Calculating…';

        // Position popup (keep in bounds)
        const zoneRect = globeZone.getBoundingClientRect();
        const globeRect = canvas.getBoundingClientRect();
        const relX = globeRect.left - zoneRect.left + sx;
        const relY = globeRect.top - zoneRect.top + sy;
        const pw = 170, ph = 68;
        const x = Math.min(relX + 12, zoneRect.width - pw - 8);
        const y = Math.min(relY - ph - 12, zoneRect.height - ph - 8);
        cityPopup.style.left = Math.max(8, x) + 'px';
        cityPopup.style.top = Math.max(8, y) + 'px';

        // Geocode
        const name = await reverseGeocode(lat, lon);
        popupName.textContent = name;

        // Estimate next ISS pass
        const etaMin = estimateNextPass(lat, lon);
        if (etaMin < 120) {
            popupPass.textContent = `🛸 ISS passes in ~${etaMin} min`;
        } else {
            popupPass.textContent = `🛸 ISS ~ ${Math.round(etaMin / 60)}h away`;
        }
    }

    $('cityPopupClose').addEventListener('click', () => {
        cityPopup.classList.add('hidden');
    });

    async function reverseGeocode(lat, lon) {
        const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
        if (geocodeCache[key]) return geocodeCache[key];
        try {
            const url = `${NOMINATIM}?lat=${lat}&lon=${lon}&format=json`;
            const r = await fetch(url, {
                headers: { 'Accept-Language': 'en', 'User-Agent': 'ISS-Horizon-Widget/1.0' }
            });
            const d = await r.json();
            const a = d.address || {};
            const name = a.city || a.town || a.village || a.county || a.state || a.country || 'Ocean';
            geocodeCache[key] = name;
            return name;
        } catch {
            return 'Unknown location';
        }
    }

    function estimateNextPass(targetLat, targetLon) {
        // Simple circular orbit approximation
        const issLon = issData.lon;
        const issLat = issData.lat;
        const lonPerSec = 360 / ORBITAL_PERIOD_S; // deg/s moving east
        const issCoverage = 10; // ±degrees latitude band

        // If ISS can reach target lat
        if (Math.abs(targetLat) > 51.6) {
            // Outside ISS inclination (~51.6°)
            return 9999;
        }

        // Time for ISS longitude to reach target longitude
        let deltaLon = ((targetLon - issLon) + 360) % 360;
        const etaSec = deltaLon / lonPerSec;
        return Math.round(etaSec / 60);
    }

    // ── Cockpit Mode ─────────────────────────────────────────────────
    cockpitBtn.addEventListener('click', () => {
        cockpitMode = !cockpitMode;
        cockpitBtn.classList.toggle('cockpit-on', cockpitMode);
        cockpitLabel.classList.toggle('ui-hidden', !cockpitMode);
        if (cockpitMode) {
            applyCockpitCamera();
            showToast('🚀 Cockpit mode ON — globe locked to ISS');
        } else {
            showToast('Cockpit mode OFF');
        }
        hideHint();
    });

    function applyCockpitCamera() {
        // Rotate earth so ISS is front-center
        const targetY = -(issData.lon + 180) * Math.PI / 180;
        const targetX = -issData.lat * Math.PI / 180;
        earth.rotation.y = targetY;
        earth.rotation.x = targetX;
        nightSphere.rotation.y = targetY;
        nightSphere.rotation.x = targetX;
    }

    // ── Globe hint ────────────────────────────────────────────────────
    function hideHint() {
        if (!hintHidden) {
            hintHidden = true;
            globeHint.classList.add('hidden');
        }
    }

    // ── Renderer resize ──────────────────────────────────────────────
    function resizeRenderer() {
        const w = globeZone.clientWidth;
        const h = globeZone.clientHeight;
        if (!w || !h) return; // skip if not yet laid out
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    // Defer initial resize until browser has finished layout
    requestAnimationFrame(() => { resizeRenderer(); });
    const ro = new ResizeObserver(resizeRenderer);
    ro.observe(globeZone);

    // ── Animation loop ────────────────────────────────────────────────
    let pulseT = 0;
    function animate() {
        requestAnimationFrame(animate);

        pulseT += 0.04;

        // Auto-rotate (0 = off)
        if (!isDragging && !cockpitMode && settings.autoRotateSpeed > 0) {
            const speed = settings.autoRotateSpeed * 0.00015;
            earth.rotation.y += speed;
            nightSphere.rotation.y += speed;
        }

        // Inertia
        if (!isDragging && !cockpitMode) {
            if (Math.abs(velocity.x) > 0.0001 || Math.abs(velocity.y) > 0.0001) {
                earth.rotation.y += velocity.x;
                earth.rotation.x += velocity.y;
                nightSphere.rotation.y = earth.rotation.y;
                nightSphere.rotation.x = earth.rotation.x;
                velocity.x *= 0.94;
                velocity.y *= 0.94;
            }
        }

        // Clamp x rotation
        earth.rotation.x = Math.max(-MAX_X_ROT, Math.min(MAX_X_ROT, earth.rotation.x));
        nightSphere.rotation.x = earth.rotation.x;

        // ISS ring pulse
        const pulse = 1 + 0.3 * Math.sin(pulseT);
        issRing.scale.set(pulse, pulse, 1);
        ringMat.opacity = 0.4 + 0.3 * Math.sin(pulseT);

        // ISS sprite subtle glow pulse
        issSpriteMat.opacity = 0.75 + 0.25 * Math.sin(pulseT * 1.2);

        renderer.render(scene, camera);
    }
    animate();

    // ── Leaflet 2D Ground Track Map ───────────────────────────────────
    let leafletMap = null;
    let issMapMarker = null;
    let issTrackLine = null;
    let mapTrackPoints = [];
    let mapFollowISS = true;

    function initLeafletMap() {
        if (typeof L === 'undefined') return;

        leafletMap = L.map('issMap', {
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            keyboard: false,
        }).setView([0, 0], 2);

        // CartoDB Dark Matter tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd',
        }).addTo(leafletMap);

        // Custom pulsing ISS icon
        const issIcon = L.divIcon({
            className: 'iss-map-marker',
            html: '<div class="iss-dot-outer"><div class="iss-dot-inner"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });
        issMapMarker = L.marker([issData.lat, issData.lon], {
            icon: issIcon,
            zIndexOffset: 1000,
        }).addTo(leafletMap);

        // Ground track polyline
        issTrackLine = L.polyline([], {
            color: '#00d4ff',
            weight: 1.5,
            opacity: 0.55,
            className: 'iss-track-line',
        }).addTo(leafletMap);

        // If user drags the map, disable auto-follow
        leafletMap.on('dragstart', () => {
            mapFollowISS = false;
            $('mapFollowBtn').classList.remove('active');
        });

        // Settle size after layout is done
        requestAnimationFrame(() => leafletMap.invalidateSize());
    }

    function updateLeafletMap(lat, lon) {
        if (!issMapMarker) return;
        issMapMarker.setLatLng([lat, lon]);

        const last = mapTrackPoints[mapTrackPoints.length - 1];
        if (!last || Math.abs(lat - last.lat) > 0.04 || Math.abs(lon - last.lng) > 0.04) {
            // Anti-meridian crossing — reset track to avoid wrapping lines
            if (last && Math.abs(lon - last.lng) > 160) {
                mapTrackPoints = [{ lat, lng: lon }];
                issTrackLine && issTrackLine.setLatLngs([[lat, lon]]);
            } else {
                mapTrackPoints.push({ lat, lng: lon });
                if (mapTrackPoints.length > 400) mapTrackPoints.shift();
                issTrackLine && issTrackLine.setLatLngs(mapTrackPoints.map(p => [p.lat, p.lng]));
            }
        }

        if (mapFollowISS) {
            leafletMap && leafletMap.panTo([lat, lon], { animate: true, duration: 0.9 });
        }
    }

    // Follow ISS toggle button
    $('mapFollowBtn').addEventListener('click', () => {
        mapFollowISS = !mapFollowISS;
        $('mapFollowBtn').classList.toggle('active', mapFollowISS);
        if (mapFollowISS && leafletMap) {
            leafletMap.panTo([issData.lat, issData.lon], { animate: true });
        }
    });

    // Init settings fields
    inputVideoId.value = settings.videoId;
    inputAutoRotate.value = settings.autoRotateSpeed;
    rotateVal.textContent = settings.autoRotateSpeed;

    // Kick off Leaflet (script already loaded synchronously)
    initLeafletMap();

})();

