(() => {
    "use strict";

    const POLL_MS = 2500;
    const $ = id => document.getElementById(id);

    let api = null;
    let requestId = 1;
    let selectedId = "";
    let pollTimer = null;
    let initialized = false;

    function getPlugin() {
        return window.plugins && window.plugins.Sensorsdataprovider;
    }

    function ensureApi() {
        const plugin = getPlugin();
        if (!plugin) return null;
        if (api) return api;

        const pending = new Map();
        if (plugin.asyncResponse && plugin.asyncResponse.connect) {
            plugin.asyncResponse.connect((id, value) => {
                const entry = pending.get(id);
                if (!entry) return;
                pending.delete(id);
                entry.resolve(value);
            });
        }

        api = {
            request(method, ...args) {
                return new Promise((resolve, reject) => {
                    const id = requestId++;
                    pending.set(id, { resolve });
                    try {
                        plugin[method](id, ...args);
                    } catch (error) {
                        pending.delete(id);
                        reject(error);
                    }
                    setTimeout(() => {
                        if (!pending.has(id)) return;
                        pending.delete(id);
                        resolve("");
                    }, 1800);
                });
            }
        };

        if (plugin.sensorValueChanged && plugin.sensorValueChanged.connect) {
            plugin.sensorValueChanged.connect((id, value) => {
                if (id === selectedId) renderValue(value);
            });
        }

        return api;
    }

    function normalize(value) {
        return String(value || "").toLowerCase();
    }

    function scoreSensor(meta) {
        const haystack = normalize(`${meta.id} ${meta.name} ${meta.device} ${meta.type} ${meta.kind}`);
        if (haystack.includes("cpu-pump") || (haystack.includes("pump") && haystack.includes("cpu"))) return 100;
        if (haystack.includes("pump")) return 90;
        if (haystack.includes("cpu-temp") || (haystack.includes("temperature") && haystack.includes("cpu"))) return 80;
        if (haystack.includes("gpu-temp") || (haystack.includes("temperature") && haystack.includes("gpu"))) return 70;
        if (haystack.includes("temperature")) return 50;
        return 0;
    }

    function formatValue(value) {
        const number = Number.parseFloat(value);
        if (!Number.isFinite(number)) return "--";
        return Math.abs(number) >= 100 ? String(Math.round(number)) : number.toFixed(1);
    }

    function sensorLabel(meta) {
        const haystack = normalize(`${meta.id} ${meta.name} ${meta.type} ${meta.kind}`);
        if (haystack.includes("pump")) return "Pump";
        if (haystack.includes("gpu")) return "GPU Temp";
        if (haystack.includes("cpu")) return "CPU Temp";
        return meta.type === "temperature" ? "Temp" : "Sensor";
    }

    function accent(meta, value) {
        const number = Number.parseFloat(value);
        const isPump = normalize(`${meta.id} ${meta.name} ${meta.type} ${meta.kind}`).includes("pump");
        if (isPump) return "#00c8ff";
        if (!Number.isFinite(number)) return "#7f8c8d";
        if (number >= 80) return "#ff4d4d";
        if (number >= 65) return "#ffb84d";
        return "#1db954";
    }

    async function metadata(id) {
        const client = ensureApi();
        const [name, device, type, kind, units] = await Promise.all([
            client.request("getSensorName", id),
            client.request("getSensorDeviceName", id),
            client.request("getSensorType", id),
            client.request("getSensorKind", id),
            client.request("getSensorUnits", id)
        ]);
        return { id, name, device, type, kind, units };
    }

    async function chooseSensor() {
        const client = ensureApi();
        if (!client) return null;
        const ids = await client.request("getAllSensorIds");
        const list = parseIds(ids);
        if (!list.length) return null;
        const metas = await Promise.all(list.map(metadata));
        metas.sort((a, b) => scoreSensor(b) - scoreSensor(a));
        return metas[0] && scoreSensor(metas[0]) > 0 ? metas[0] : null;
    }

    function parseIds(ids) {
        if (Array.isArray(ids)) return ids;
        if (typeof ids !== "string" || !ids.trim()) return [];
        try {
            const parsed = JSON.parse(ids);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return ids.split(",").map(id => id.trim()).filter(Boolean);
        }
    }

    let currentMeta = null;

    function renderValue(value) {
        if (!currentMeta) return;
        const color = accent(currentMeta, value);
        $("value").textContent = formatValue(value);
        $("units").textContent = currentMeta.units || "";
        $("label").textContent = sensorLabel(currentMeta);
        $("device").textContent = currentMeta.device || currentMeta.name || currentMeta.id;
        $("ring").style.setProperty("--accent", color);
        $("widget").dataset.state = "ready";
    }

    async function update() {
        const client = ensureApi();
        if (!client) {
            $("widget").dataset.state = "offline";
            $("label").textContent = "Sensors";
            $("value").textContent = "--";
            $("units").textContent = "";
            $("device").textContent = "Plugin unavailable";
            return;
        }

        if (!currentMeta) {
            currentMeta = await chooseSensor();
            selectedId = currentMeta ? currentMeta.id : "";
        }

        if (!currentMeta) {
            $("widget").dataset.state = "empty";
            $("label").textContent = "Cooling";
            $("value").textContent = "--";
            $("units").textContent = "";
            $("device").textContent = "No cooling sensor";
            return;
        }

        const value = await client.request("getSensorValue", currentMeta.id);
        renderValue(value);
    }

    function start() {
        if (initialized) return;
        initialized = true;
        update();
        pollTimer = setInterval(update, POLL_MS);
    }

    window.CoolingSensorPump = { start, update };
    window.icueEvents = { onICUEInitialized: start, onDataUpdated: update };
    window.pluginSensorsdataproviderEvents = { onInitialized: start };

    if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) start();
    if (typeof pluginSensorsdataprovider_initialized !== "undefined" && pluginSensorsdataprovider_initialized) start();
    if (!pollTimer) setTimeout(start, 500);
})();
