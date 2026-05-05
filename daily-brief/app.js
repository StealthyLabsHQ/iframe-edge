(() => {
    "use strict";

    const POLL_MS = 15 * 60 * 1000;
    const CLOCK_MS = 1000;
    const $ = id => document.getElementById(id);
    let pollTimer = null;
    let clockTimer = null;

    const notes = [
        "Protect the first hour.",
        "One clear priority wins the day.",
        "Move early, decide once, finish clean.",
        "Keep the plan small and visible.",
        "Check the weather, then get moving.",
        "Do the important thing before the urgent thing.",
        "Leave room for one useful surprise."
    ];

    function setting(name, fallback) {
        try {
            if (name === "briefCity" && typeof briefCity !== "undefined") return briefCity || fallback;
            if (name === "briefUnits" && typeof briefUnits !== "undefined") return briefUnits || fallback;
            if (name === "briefFormat" && typeof briefFormat !== "undefined") return briefFormat || fallback;
        } catch (_) {}
        return fallback;
    }

    function codeLabel(code) {
        const map = {
            0: ["Clear", "SUN"],
            1: ["Mainly Clear", "SUN"],
            2: ["Partly Cloudy", "CLD"],
            3: ["Cloudy", "CLD"],
            45: ["Fog", "FOG"],
            48: ["Fog", "FOG"],
            51: ["Drizzle", "DRZ"],
            61: ["Rain", "RAN"],
            63: ["Rain", "RAN"],
            65: ["Heavy Rain", "RAN"],
            71: ["Snow", "SNW"],
            80: ["Showers", "SHW"],
            95: ["Storm", "STM"]
        };
        return map[code] || ["Weather", "WX"];
    }

    function show(title, sub) {
        $("overlayTitle").textContent = title;
        $("overlaySub").textContent = sub;
        $("overlay").classList.add("visible");
    }

    function hide() {
        $("overlay").classList.remove("visible");
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    function updateClock() {
        const now = new Date();
        const is12h = setting("briefFormat", "24h") === "12h";
        $("dayName").textContent = now.toLocaleDateString("en", { weekday: "long" });
        $("dateLine").textContent = now.toLocaleDateString("en", { month: "long", day: "numeric" });
        $("clock").textContent = now.toLocaleTimeString("en", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: is12h
        });
        let sum = 0;
        for (const c of dateKey(now)) sum += c.charCodeAt(0);
        $("note").textContent = notes[sum % notes.length];
    }

    function time(value) {
        if (!value) return "--";
        return new Date(value).toLocaleTimeString("en", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: setting("briefFormat", "24h") === "12h"
        });
    }

    async function geocode(city) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const data = await fetch(url, { cache: "no-store" }).then(resp => resp.json());
        return data.results && data.results[0];
    }

    async function weather(location, units) {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", location.latitude);
        url.searchParams.set("longitude", location.longitude);
        url.searchParams.set("timezone", "auto");
        url.searchParams.set("temperature_unit", units === "fahrenheit" ? "fahrenheit" : "celsius");
        url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,precipitation");
        url.searchParams.set("daily", "sunrise,sunset");
        url.searchParams.set("forecast_days", "1");
        return fetch(url, { cache: "no-store" }).then(resp => resp.json());
    }

    async function updateWeather() {
        const city = String(setting("briefCity", "Paris")).trim();
        const units = setting("briefUnits", "celsius");
        if (!city) return show("City Missing", "Set a city in iCUE settings.");

        try {
            const loc = await geocode(city);
            if (!loc) return show("City Not Found", city);
            const data = await weather(loc, units);
            const current = data.current || {};
            const [label, icon] = codeLabel(current.weather_code);
            $("place").textContent = `${loc.name}${loc.country_code ? `, ${loc.country_code}` : ""}`;
            $("weatherIcon").textContent = icon;
            $("condition").textContent = label;
            $("temp").textContent = Math.round(typeof current.temperature_2m === "number" ? current.temperature_2m : 0);
            $("unit").textContent = units === "fahrenheit" ? "F" : "C";
            $("sunrise").textContent = time(data.daily && data.daily.sunrise && data.daily.sunrise[0]);
            $("sunset").textContent = time(data.daily && data.daily.sunset && data.daily.sunset[0]);
            $("wind").textContent = `${Math.round(current.wind_speed_10m || 0)}`;
            $("rain").textContent = `${current.precipitation || 0}mm`;
            hide();
        } catch (_) {
            show("Brief Offline", "Weather is temporarily unavailable.");
        }
    }

    function update() {
        updateClock();
        updateWeather();
    }

    function start() {
        if (!clockTimer) clockTimer = setInterval(updateClock, CLOCK_MS);
        if (!pollTimer) pollTimer = setInterval(updateWeather, POLL_MS);
        update();
    }

    window.DailyBrief = { start };
    window.icueEvents = { onICUEInitialized: start, onDataUpdated: update };
    start();
})();
