/* eslint-disable no-console */
"use strict";

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOST = process.env.SPOTIFY_LOCAL_HOST || "127.0.0.1";
const PORT = Number(process.env.SPOTIFY_LOCAL_PORT || 8787);
const BASE_URL = `http://${HOST}:${PORT}`;
const REDIRECT_URI = `${BASE_URL}/auth/callback`;
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const PAIRING_TTL_MS = 30 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state"
].join(" ");

const dataDir = process.env.ICUE_SPOTIFY_LOCAL_DATA_DIR ||
  path.join(process.env.APPDATA || os.homedir(), "icue-edge-widgets");
const dataFile = path.join(dataDir, "spotify-local-helper.json");

let state = loadState();

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: "internal_error" });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Spotify Local Helper listening on ${BASE_URL}`);
  console.log(`Spotify redirect URI: ${REDIRECT_URI}`);
});

async function route(req, res) {
  const url = new URL(req.url, BASE_URL);
  if (req.method === "OPTIONS") return sendEmpty(res, 204);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, redirect_uri: REDIRECT_URI });
  }

  if (req.method === "GET" && url.pathname === "/") {
    return sendHtml(res, 200, dashboardView());
  }

  if (req.method === "GET" && url.pathname === "/assets/spotify.svg") {
    return sendSpotifyIcon(res);
  }

  if ((req.method === "POST" || req.method === "GET") && url.pathname === "/pairings") {
    return createPairing(req, res, url);
  }

  if (req.method === "POST" && url.pathname === "/pairings/reset") {
    return resetPairing(res);
  }

  if (req.method === "GET" && url.pathname === "/auth/start") {
    return startAuth(res, url);
  }

  if (req.method === "GET" && url.pathname === "/auth/callback") {
    return finishAuth(res, url);
  }

  if (req.method === "GET" && url.pathname === "/session") {
    return getSession(res, url);
  }

  if (req.method === "GET" && url.pathname === "/spotify/player") {
    return getPlayer(res, url);
  }

  if (req.method === "POST" && url.pathname === "/spotify/action") {
    return spotifyAction(res, url);
  }

  return sendJson(res, 404, { error: "not_found" });
}

async function createPairing(req, res, url) {
  const body = req.method === "POST" ? await readJson(req) : {};
  const clientId = normalizeClientId(body.client_id || url.searchParams.get("client_id"));
  if (!clientId) return sendJson(res, 400, { error: "missing_client_id" });

  const pairingCode = randomCode(8);
  state = {
    clientId,
    pairingCode,
    status: "pending",
    expiresAt: Date.now() + PAIRING_TTL_MS,
    oauthStates: {},
    refreshToken: "",
    sessionToken: "",
    accessToken: "",
    accessTokenExpiresAt: 0,
    spotifyUserId: ""
  };
  saveState();

  const pairing = {
    pairing_code: pairingCode,
    authorize_url: `/auth/start?pairing_code=${encodeURIComponent(pairingCode)}`,
    expires_at: state.expiresAt
  };

  if (req.method === "GET") {
    return sendHtml(res, 200, pairingView(pairing));
  }
  return sendJson(res, 201, pairing);
}

function resetPairing(res) {
  state.refreshToken = "";
  state.sessionToken = "";
  state.accessToken = "";
  state.accessTokenExpiresAt = 0;
  state.status = "expired";
  state.expiresAt = Date.now();
  state.oauthStates = {};
  saveState();
  return sendJson(res, 200, { ok: true });
}

async function startAuth(res, url) {
  const pairingCode = normalizeCode(url.searchParams.get("pairing_code"));
  if (!pairingCode || pairingCode !== state.pairingCode || state.expiresAt < Date.now()) {
    return sendJson(res, 410, { error: "pairing_expired" });
  }
  if (!state.clientId) return sendJson(res, 400, { error: "missing_client_id" });

  const oauthState = randomVerifier();
  const codeVerifier = randomVerifier();
  const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
  state.oauthStates[oauthState] = {
    codeVerifier,
    pairingCode,
    expiresAt: Date.now() + STATE_TTL_MS
  };
  saveState();

  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set("client_id", state.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", oauthState);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("show_dialog", "true");
  res.writeHead(302, corsHeaders({ Location: authUrl.toString() }));
  res.end();
}

async function finishAuth(res, url) {
  const code = url.searchParams.get("code");
  const oauthState = url.searchParams.get("state");
  const row = state.oauthStates[oauthState || ""];
  if (!code || !row || row.expiresAt < Date.now()) {
    return sendHtml(res, 400, messageView({
      tone: "warn",
      title: "Authorization expired",
      body: "Start again from Spotify Visualizer in iCUE.",
      detail: "OAuth state was missing or expired before Spotify returned."
    }));
  }

  const tokenResp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: state.clientId,
      code_verifier: row.codeVerifier
    })
  });
  const tokenData = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok || !tokenData.refresh_token) {
    return sendHtml(res, 502, messageView({
      tone: "warn",
      title: "Token exchange failed",
      body: "Check the redirect URI and Client ID in Spotify Developer Dashboard.",
      detail: `Expected redirect URI: ${REDIRECT_URI}`
    }));
  }

  const meResp = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const me = await meResp.json().catch(() => ({}));

  delete state.oauthStates[oauthState];
  state.status = "connected";
  state.refreshToken = tokenData.refresh_token;
  state.accessToken = tokenData.access_token;
  state.accessTokenExpiresAt = Date.now() + (Number(tokenData.expires_in) || 3600) * 1000;
  state.sessionToken = "";
  state.spotifyUserId = me.id || "";
  state.expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
  saveState();

  return sendHtml(res, 200, messageView({
    tone: "ok",
    title: "Spotify connected",
    body: "Return to iCUE. Spotify Visualizer will pick up this local session automatically.",
    detail: state.spotifyUserId ? `Spotify user: ${state.spotifyUserId}` : "Local session ready."
  }));
}

function getSession(res, url) {
  const pairingCode = normalizeCode(url.searchParams.get("pairing_code"));
  if (!pairingCode || pairingCode !== state.pairingCode) {
    return sendJson(res, 404, { error: "pairing_not_found" });
  }

  const connected = state.status === "connected" && !!state.refreshToken;
  const body = {
    connected,
    status: state.status || "pending",
    spotify_user_id: state.spotifyUserId || null,
    expires_at: state.expiresAt || 0
  };
  if (connected) {
    if (!state.sessionToken) {
      state.sessionToken = randomVerifier();
      saveState();
    }
    body.session_token = state.sessionToken;
  }
  return sendJson(res, 200, body);
}

async function getPlayer(res, url) {
  if (!requireSession(url)) return sendJson(res, 401, { error: "session_not_found" });
  const accessToken = await getAccessToken();
  if (!accessToken) return sendJson(res, 401, { error: "session_expired" });

  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const [playerResp, currentResp] = await Promise.all([
    fetch(`${SPOTIFY_API_BASE}/me/player?additional_types=track`, { headers: authHeaders }),
    fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing?additional_types=track`, { headers: authHeaders })
  ]);
  const playerData = playerResp.ok && playerResp.status !== 204 ? await playerResp.json().catch(() => null) : null;
  const currentData = currentResp.ok && currentResp.status !== 204 ? await currentResp.json().catch(() => null) : null;

  if (currentData && currentData.item) {
    return sendJson(res, 200, {
      ...(playerData || {}),
      item: currentData.item,
      progress_ms: currentData.progress_ms,
      is_playing: currentData.is_playing,
      currently_playing_type: currentData.currently_playing_type,
      timestamp: currentData.timestamp
    });
  }
  if (playerData) return sendJson(res, playerResp.status, playerData);
  if (playerResp.status === 204 || currentResp.status === 204) return sendEmpty(res, 204);
  return sendJson(res, playerResp.status || currentResp.status || 502, { error: "spotify_player_unavailable" });
}

async function spotifyAction(res, url) {
  if (!requireSession(url)) return sendJson(res, 401, { error: "session_not_found" });
  const endpoint = normalizeSpotifyEndpoint(url.searchParams.get("endpoint"));
  const method = String(url.searchParams.get("method") || "POST").toUpperCase();
  if (!endpoint || !isAllowedSpotifyAction(method, endpoint)) {
    return sendJson(res, 400, { error: "action_not_allowed" });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return sendJson(res, 401, { error: "session_expired" });
  const resp = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return sendJson(res, resp.ok ? 200 : resp.status, { ok: resp.ok, status: resp.status });
}

function requireSession(url) {
  const sessionToken = String(url.searchParams.get("session_token") || "");
  return !!sessionToken && sessionToken === state.sessionToken && state.status === "connected";
}

async function getAccessToken() {
  if (state.accessToken && state.accessTokenExpiresAt > Date.now() + 60_000) return state.accessToken;
  if (!state.refreshToken || !state.clientId) return "";

  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: state.refreshToken,
      client_id: state.clientId
    })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    if (data.error === "invalid_grant" || resp.status === 400 || resp.status === 401) resetInMemoryAuth();
    saveState();
    return "";
  }
  state.accessToken = data.access_token;
  state.accessTokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  if (data.refresh_token) state.refreshToken = data.refresh_token;
  saveState();
  return state.accessToken;
}

function resetInMemoryAuth() {
  state.status = "expired";
  state.refreshToken = "";
  state.sessionToken = "";
  state.accessToken = "";
  state.accessTokenExpiresAt = 0;
}

function normalizeSpotifyEndpoint(value) {
  const endpoint = String(value || "").trim();
  if (!endpoint.startsWith("/me/player")) return "";
  return endpoint;
}

function isAllowedSpotifyAction(method, endpoint) {
  return [
    ["POST", /^\/me\/player\/previous$/],
    ["POST", /^\/me\/player\/next$/],
    ["PUT", /^\/me\/player\/pause$/],
    ["PUT", /^\/me\/player\/play$/],
    ["PUT", /^\/me\/player\/shuffle\?state=(true|false)$/],
    ["PUT", /^\/me\/player\/repeat\?state=(off|context|track)$/],
    ["PUT", /^\/me\/player\/volume\?volume_percent=([0-9]|[1-9][0-9]|100)$/],
    ["PUT", /^\/me\/player\/seek\?position_ms=\d+$/]
  ].some(([allowedMethod, pattern]) => method === allowedMethod && pattern.test(endpoint));
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (_) {
    return { oauthStates: {} };
  }
}

function saveState() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch (_) { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, corsHeaders({ "Content-Type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, body) {
  res.writeHead(status, corsHeaders({ "Content-Type": "text/html; charset=utf-8" }));
  res.end(pageShell(body));
}

function sendSpotifyIcon(res) {
  const iconPath = path.resolve(__dirname, "..", "svg", "spotify.svg");
  fs.readFile(iconPath, (error, data) => {
    if (error) {
      res.writeHead(404, corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
      res.end("not found");
      return;
    }
    res.writeHead(200, corsHeaders({ "Content-Type": "image/svg+xml; charset=utf-8" }));
    res.end(data);
  });
}

function dashboardView() {
  const connected = state.status === "connected" && !!state.refreshToken;
  const status = connected ? "Connected" : state.status === "pending" ? "Pairing pending" : "Waiting for iCUE";
  const expires = state.expiresAt ? new Date(state.expiresAt).toLocaleString() : "No active session";
  return `
    <section class="hero">
      <div class="mark-wrap"><img src="/assets/spotify.svg" alt="" /></div>
      <p class="eyebrow">Local Spotify bridge</p>
      <h1>${escapeHtml(status)}</h1>
      <p class="lead">OAuth and player controls stay on this machine at <code>${escapeHtml(BASE_URL)}</code>.</p>
      <div class="actions">
        <a class="button primary" href="/health">Health JSON</a>
        ${state.pairingCode ? `<a class="button" href="/auth/start?pairing_code=${encodeURIComponent(state.pairingCode)}">Authorize current pairing</a>` : ""}
      </div>
    </section>
    <section class="rail">
      ${metric("Redirect URI", REDIRECT_URI)}
      ${metric("Session", expires)}
      ${metric("Token file", dataFile)}
    </section>
  `;
}

function pairingView(pairing) {
  const expires = new Date(pairing.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `
    <section class="hero compact">
      <div class="mark-wrap"><img src="/assets/spotify.svg" alt="" /></div>
      <p class="eyebrow">Pairing code</p>
      <h1 class="code">${escapeHtml(pairing.pairing_code)}</h1>
      <p class="lead">Use this local session to connect Spotify Visualizer from iCUE.</p>
      <div class="actions">
        <a class="button primary" href="${escapeHtml(pairing.authorize_url)}">Authorize Spotify</a>
        <a class="button" href="/">Status</a>
      </div>
    </section>
    <section class="rail">
      ${metric("Expires", expires)}
      ${metric("Redirect URI", REDIRECT_URI)}
      ${metric("Storage", dataFile)}
    </section>
  `;
}

function messageView({ tone, title, body, detail }) {
  return `
    <section class="hero compact ${tone === "ok" ? "is-ok" : "is-warn"}">
      <div class="mark-wrap"><img src="/assets/spotify.svg" alt="" /></div>
      <p class="eyebrow">${tone === "ok" ? "Session ready" : "Action needed"}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">${escapeHtml(body)}</p>
      <div class="actions"><a class="button primary" href="/">Open status</a></div>
    </section>
    <section class="rail rail-message">${metric("Detail", detail)}</section>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function pageShell(body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spotify Local Helper</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #050505;
      --panel: rgba(255,255,255,.055);
      --panel-strong: rgba(255,255,255,.09);
      --text: #f7f7f4;
      --muted: rgba(247,247,244,.62);
      --faint: rgba(247,247,244,.36);
      --line: rgba(255,255,255,.13);
      --green: #1db954;
      --green-soft: rgba(29,185,84,.16);
      --warn: #ffb84d;
      font-family: "Space Grotesk", "Segoe UI", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 28px;
      background:
        linear-gradient(160deg, rgba(29,185,84,.14), transparent 34%),
        radial-gradient(circle at 82% 12%, rgba(255,255,255,.08), transparent 26%),
        var(--bg);
      color: var(--text);
    }
    main {
      width: min(1080px, 100%);
      display: grid;
      grid-template-columns: minmax(0, 1.28fr) minmax(300px, .72fr);
      gap: 12px;
      align-items: stretch;
    }
    .hero, .rail {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel-strong), var(--panel));
      box-shadow: 0 22px 70px rgba(0,0,0,.48);
      backdrop-filter: blur(18px);
    }
    .hero {
      min-height: 448px;
      padding: 42px 44px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
    }
    .hero::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
      background-size: 42px 42px;
      mask-image: linear-gradient(180deg, transparent, #000 42%, #000);
      pointer-events: none;
    }
    .hero.compact { min-height: 448px; }
    .mark-wrap {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--green-soft);
      border: 1px solid rgba(29,185,84,.38);
      margin-bottom: auto;
      position: relative;
      z-index: 1;
    }
    .mark-wrap img { width: 38px; height: 38px; filter: drop-shadow(0 0 18px rgba(29,185,84,.4)); }
    .eyebrow {
      position: relative;
      z-index: 1;
      margin: 0 0 10px;
      color: var(--green);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .16em;
      font-weight: 800;
    }
    h1 {
      position: relative;
      z-index: 1;
      margin: 0;
      max-width: 100%;
      font-size: clamp(42px, 6.2vw, 76px);
      line-height: .92;
      letter-spacing: 0;
      text-wrap: balance;
      overflow-wrap: normal;
    }
    h1.code {
      font-family: "JetBrains Mono", Consolas, monospace;
      letter-spacing: .08em;
    }
    .lead {
      position: relative;
      z-index: 1;
      max-width: 560px;
      margin: 18px 0 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.55;
    }
    code {
      color: var(--text);
      background: rgba(255,255,255,.08);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 2px 6px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: .9em;
    }
    .actions {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 26px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 16px;
      border-radius: 8px;
      border: 1px solid var(--line);
      color: var(--text);
      text-decoration: none;
      font-weight: 800;
      background: rgba(255,255,255,.06);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
    }
    .button.primary {
      background: var(--green);
      color: #031006;
      border-color: var(--green);
    }
    .rail {
      border-radius: 10px;
      padding: 16px;
      display: grid;
      align-content: stretch;
      gap: 10px;
    }
    .rail-message {
      align-content: end;
      padding: 18px;
    }
    .metric {
      min-height: 86px;
      padding: 14px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: rgba(0,0,0,.22);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      overflow: hidden;
    }
    .metric span {
      color: var(--faint);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .14em;
      font-weight: 800;
    }
    .metric strong {
      color: var(--text);
      font-size: 13px;
      line-height: 1.35;
      overflow-wrap: anywhere;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-weight: 700;
    }
    .rail-message .metric {
      min-height: 116px;
      justify-content: center;
    }
    .rail-message .metric strong {
      font-size: 14px;
      line-height: 1.45;
    }
    .is-warn .eyebrow { color: var(--warn); }
    .is-warn .mark-wrap { border-color: rgba(255,184,77,.38); background: rgba(255,184,77,.12); }
    @media (max-width: 760px) {
      body { padding: 14px; place-items: stretch; }
      main { grid-template-columns: 1fr; }
      .hero, .hero.compact { min-height: 430px; padding: 28px; }
      h1 { font-size: clamp(40px, 12vw, 64px); }
      .rail { align-content: stretch; }
    }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function sendEmpty(res, status) {
  res.writeHead(status, corsHeaders());
  res.end();
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    ...extra
  };
}

function normalizeClientId(value) {
  const clientId = String(value || "").trim();
  return /^[a-f0-9]{32}$/i.test(clientId) ? clientId : "";
}

function normalizeCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(code) ? code : "";
}

function randomCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

function randomVerifier() {
  return base64Url(crypto.randomBytes(48));
}

function base64Url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[ch]));
}
