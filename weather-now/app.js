(() => {
    "use strict";

    const POLL_MS = 15 * 60 * 1000;
    const STARTUP_GRACE_MS = 6000;
    const OFFLINE_FAILURES = 3;
    const RETRY_MS = 15000;
    const $ = id => document.getElementById(id);
    let timer = null;
    let retryTimer = null;
    let failures = 0;
    let graceUntil = Date.now() + STARTUP_GRACE_MS;
    let hasLiveData = false;

    function setting(name, fallback) {
        try {
            if (name === "weatherCity" && typeof weatherCity !== "undefined") return weatherCity || fallback;
            if (name === "weatherUnits" && typeof weatherUnits !== "undefined") return weatherUnits || fallback;
        } catch (_) {}
        return fallback;
    }

    function codeLabel(code) {
        const map = {
            0: ["Clear", "SUN"], 1: ["Mainly Clear", "SUN"], 2: ["Partly Cloudy", "CLD"], 3: ["Cloudy", "CLD"],
            45: ["Fog", "FOG"], 48: ["Fog", "FOG"], 51: ["Drizzle", "DRZ"], 61: ["Rain", "RAN"],
            63: ["Rain", "RAN"], 65: ["Heavy Rain", "RAN"], 71: ["Snow", "SNW"], 80: ["Showers", "SHW"],
            95: ["Storm", "STM"]
        };
        return map[code] || ["Weather", "WX"];
    }

    function time(value) {
        return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
    }

    function show(title, sub) {
        $("overlayTitle").textContent = title;
        $("overlaySub").textContent = sub;
        $("overlay").classList.add("visible");
    }

    function hide() {
        $("overlay").classList.remove("visible");
    }

    function scheduleRetry() {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(update, RETRY_MS);
    }

    async function geocode(city) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const data = await fetch(url, { cache: "no-store" }).then(resp => resp.json());
        return data.results && data.results[0];
    }

    async function weather(location, units) {
        const tempUnit = units === "fahrenheit" ? "fahrenheit" : "celsius";
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", location.latitude);
        url.searchParams.set("longitude", location.longitude);
        url.searchParams.set("timezone", "auto");
        url.searchParams.set("temperature_unit", tempUnit);
        url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,precipitation");
        url.searchParams.set("daily", "sunrise,sunset");
        url.searchParams.set("forecast_days", "1");
        return fetch(url, { cache: "no-store" }).then(resp => resp.json());
    }

    async function update() {
        const city = String(setting("weatherCity", "Paris")).trim();
        const units = setting("weatherUnits", "celsius");
        if (!city) return show("City Missing", "Set a city in iCUE settings.");
        try {
            const loc = await geocode(city);
            if (!loc) return show("City Not Found", city);
            const data = await weather(loc, units);
            const current = data.current || {};
            const [label, icon] = codeLabel(current.weather_code);
            $("place").textContent = `${loc.name}${loc.country_code ? `, ${loc.country_code}` : ""}`;
            $("condition").textContent = label;
            $("icon").textContent = icon;
            $("temp").textContent = Math.round(typeof current.temperature_2m === "number" ? current.temperature_2m : 0);
            $("unit").textContent = units === "fahrenheit" ? "°F" : "°C";
            $("wind").textContent = `${Math.round(current.wind_speed_10m || 0)}`;
            $("rain").textContent = `${current.precipitation || 0}mm`;
            $("sunrise").textContent = time(data.daily && data.daily.sunrise && data.daily.sunrise[0]);
            $("sunset").textContent = time(data.daily && data.daily.sunset && data.daily.sunset[0]);
            failures = 0;
            graceUntil = 0;
            hasLiveData = true;
            clearTimeout(retryTimer);
            hide();
        } catch (_) {
            failures += 1;
            scheduleRetry();
            if (hasLiveData && (Date.now() < graceUntil || failures < OFFLINE_FAILURES)) return;
            const starting = Date.now() < graceUntil || failures < OFFLINE_FAILURES;
            show(starting ? "Reconnecting" : "Weather Offline", starting ? "Keeping last weather visible. Retrying automatically..." : "Open-Meteo unavailable.");
        }
    }

    function start() {
        if (timer) return;
        graceUntil = Date.now() + STARTUP_GRACE_MS;
        update();
        timer = setInterval(update, POLL_MS);
    }

    window.WeatherNow = { start };
    window.icueEvents = { onICUEInitialized: start, onDataUpdated: update };
    start();
})();
