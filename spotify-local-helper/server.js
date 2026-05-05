/* eslint-disable no-console */
"use strict";

const http = require("http");
const crypto = require("crypto");
const { execFile } = require("child_process");
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
const WINDOWS_MEDIA_CACHE_MS = 1500;
const SYSTEM_STATUS_CACHE_MS = 2000;
const WINDOWS_MEDIA_READER_PROJECT = path.join(__dirname, "windows-media-reader", "windows-media-reader.csproj");
const SYSTEM_STATUS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$drive = Get-PSDrive -Name C
$net = Get-NetAdapterStatistics | Measure-Object -Property ReceivedBytes,SentBytes -Sum
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress)
[pscustomobject]@{
  diskFree = [math]::Round($drive.Free / 1GB, 1)
  diskUsed = [math]::Round(($drive.Used) / 1GB, 1)
  diskTotal = [math]::Round(($drive.Free + $drive.Used) / 1GB, 1)
  netReceived = [math]::Round(($net[0].Sum) / 1GB, 2)
  netSent = [math]::Round(($net[1].Sum) / 1GB, 2)
  ip = $ip
} | ConvertTo-Json -Compress
`;
const WINDOWS_MEDIA_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 })[0]
function Await($op, $type) {
  $asTask = $asTaskGeneric.MakeGenericMethod($type)
  $task = $asTask.Invoke($null, @($op))
  $task.Wait() | Out-Null
  $task.Result
}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$session = $manager.GetCurrentSession()
if ($null -eq $session) { [pscustomobject]@{ ok = $false; error = 'no_session' } | ConvertTo-Json -Compress; exit }
$props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$info = $session.GetPlaybackInfo()
[pscustomobject]@{
  ok = $true
  title = $props.Title
  artist = $props.Artist
  album = $props.AlbumTitle
  status = $info.PlaybackStatus.ToString()
  source = $session.SourceAppUserModelId
} | ConvertTo-Json -Compress
`;

let state = normalizeState(loadState());
let windowsMediaCache = { at: 0, data: null };
let systemStatusCache = { at: 0, data: null };
let cpuSample = sampleCpu();

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
    return resetPairing(res, url);
  }

  if (req.method === "GET" && url.pathname === "/auth/start") {
    return startAuth(res, url);
  }

  if (req.method === "GET" && url.pathname === "/auth/url") {
    return getAuthUrl(res, url);
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

  if (req.method === "GET" && url.pathname === "/windows/media") {
    return getWindowsMedia(res);
  }

  if (req.method === "GET" && url.pathname === "/system/status") {
    return getSystemStatus(res);
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
  prunePairings();
  state.pairings[pairingCode] = {
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
    expires_at: state.pairings[pairingCode].expiresAt
  };

  if (req.method === "GET") {
    return sendHtml(res, 200, pairingView(pairing));
  }
  return sendJson(res, 201, pairing);
}

function resetPairing(res, url) {
  const pairingCode = normalizeCode(url.searchParams.get("pairing_code"));
  const sessionToken = String(url.searchParams.get("session_token") || "");
  if (pairingCode && state.pairings[pairingCode]) {
    delete state.pairings[pairingCode];
  } else if (sessionToken) {
    const entry = findPairingBySession(sessionToken);
    if (entry) delete state.pairings[entry.pairingCode];
  } else {
    state.pairings = {};
  }
  saveState();
  return sendJson(res, 200, { ok: true });
}

async function startAuth(res, url) {
  const authUrl = prepareAuthUrl(url);
  if (!authUrl.ok) return sendAuthUrlError(res, authUrl);
  res.writeHead(302, corsHeaders({ Location: authUrl.url }));
  res.end();
}

function getAuthUrl(res, url) {
  const authUrl = prepareAuthUrl(url);
  if (!authUrl.ok) return sendJson(res, authUrl.status, { error: authUrl.error });
  return sendJson(res, 200, { authorize_url: authUrl.url });
}

function prepareAuthUrl(url) {
  const pairingCode = normalizeCode(url.searchParams.get("pairing_code"));
  const pairing = state.pairings[pairingCode || ""];
  if (!pairing || pairing.expiresAt < Date.now()) {
    return { ok: false, status: 410, error: "pairing_expired" };
  }
  if (!pairing.clientId) return { ok: false, status: 400, error: "missing_client_id" };

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
  authUrl.searchParams.set("client_id", pairing.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", oauthState);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("show_dialog", "true");
  return { ok: true, url: authUrl.toString() };
}

function sendAuthUrlError(res, authUrl) {
  if (authUrl.error === "pairing_expired") {
    return sendHtml(res, 410, messageView({
      tone: "warn",
      title: "Authorization expired",
      body: "Return to iCUE, clear the AUTHORIZE field, then type AUTHORIZE again.",
      detail: "The local pairing code expired or was replaced by a newer authorization request."
    }));
  }
  return sendJson(res, authUrl.status || 400, { error: authUrl.error || "auth_error" });
}

async function finishAuth(res, url) {
  const code = url.searchParams.get("code");
  const oauthState = url.searchParams.get("state");
  const row = state.oauthStates[oauthState || ""];
  const pairing = row ? state.pairings[row.pairingCode] : null;
  if (!code || !row || row.expiresAt < Date.now()) {
    return sendHtml(res, 400, messageView({
      tone: "warn",
      title: "Authorization expired",
      body: "Start again from Spotify Visualizer in iCUE.",
      detail: "OAuth state was missing or expired before Spotify returned."
    }));
  }
  if (!pairing) {
    return sendHtml(res, 410, messageView({
      tone: "warn",
      title: "Authorization expired",
      body: "Return to iCUE, clear the AUTHORIZE field, then type AUTHORIZE again.",
      detail: "The local pairing was removed before Spotify returned."
    }));
  }

  const tokenResp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: pairing.clientId,
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
  pairing.status = "connected";
  pairing.refreshToken = tokenData.refresh_token;
  pairing.accessToken = tokenData.access_token;
  pairing.accessTokenExpiresAt = Date.now() + (Number(tokenData.expires_in) || 3600) * 1000;
  pairing.sessionToken = "";
  pairing.spotifyUserId = me.id || "";
  pairing.expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
  saveState();

  return sendHtml(res, 200, messageView({
    tone: "ok",
    title: "Spotify connected",
    body: "Return to iCUE. Spotify Visualizer will pick up this local session automatically.",
    detail: pairing.spotifyUserId ? `Spotify user: ${pairing.spotifyUserId}` : "Local session ready."
  }));
}

function getSession(res, url) {
  const pairingCode = normalizeCode(url.searchParams.get("pairing_code"));
  const pairing = state.pairings[pairingCode || ""];
  if (!pairing) {
    return sendJson(res, 404, { error: "pairing_not_found" });
  }

  const connected = pairing.status === "connected" && !!pairing.refreshToken;
  const body = {
    connected,
    status: pairing.status || "pending",
    spotify_user_id: pairing.spotifyUserId || null,
    expires_at: pairing.expiresAt || 0
  };
  if (connected) {
    if (!pairing.sessionToken) {
      pairing.sessionToken = randomVerifier();
      saveState();
    }
    body.session_token = pairing.sessionToken;
  }
  return sendJson(res, 200, body);
}

async function getPlayer(res, url) {
  const pairing = requireSession(url);
  if (!pairing) return sendJson(res, 401, { error: "session_not_found" });
  const accessToken = await getAccessToken(pairing);
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
  const pairing = requireSession(url);
  if (!pairing) return sendJson(res, 401, { error: "session_not_found" });
  const endpoint = normalizeSpotifyEndpoint(url.searchParams.get("endpoint"));
  const method = String(url.searchParams.get("method") || "POST").toUpperCase();
  if (!endpoint || !isAllowedSpotifyAction(method, endpoint)) {
    return sendJson(res, 400, { error: "action_not_allowed" });
  }

  const accessToken = await getAccessToken(pairing);
  if (!accessToken) return sendJson(res, 401, { error: "session_expired" });
  const resp = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return sendJson(res, resp.ok ? 200 : resp.status, { ok: resp.ok, status: resp.status });
}

function getWindowsMedia(res) {
  if (windowsMediaCache.data && Date.now() - windowsMediaCache.at < WINDOWS_MEDIA_CACHE_MS) {
    return sendJson(res, 200, windowsMediaCache.data);
  }
  execFile("dotnet", ["run", "--project", WINDOWS_MEDIA_READER_PROJECT, "--no-launch-profile"], {
    windowsHide: true,
    timeout: 8000,
    maxBuffer: 1024 * 1024
  }, (error, stdout) => {
      if (!error && stdout) {
        try {
          const data = filterWindowsMedia(JSON.parse(stdout));
          windowsMediaCache = { at: Date.now(), data };
          sendJson(res, 200, data);
          return;
      } catch (_) {
        // Fall back to the lighter PowerShell metadata reader below.
      }
    }
    getWindowsMediaFallback(res);
  });
}

function getWindowsMediaFallback(res) {
  execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", WINDOWS_MEDIA_SCRIPT], {
    windowsHide: true,
    timeout: 3000,
    maxBuffer: 1024 * 64
  }, (error, stdout) => {
    let data = { ok: false, error: "media_unavailable" };
    if (!error && stdout) {
      try { data = filterWindowsMedia(JSON.parse(stdout)); }
      catch (_) { data = { ok: false, error: "media_parse_failed" }; }
    }
    windowsMediaCache = { at: Date.now(), data };
    sendJson(res, 200, data);
  });
}

function getSystemStatus(res) {
  if (systemStatusCache.data && Date.now() - systemStatusCache.at < SYSTEM_STATUS_CACHE_MS) {
    return sendJson(res, 200, systemStatusCache.data);
  }

  execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", SYSTEM_STATUS_SCRIPT], {
    windowsHide: true,
    timeout: 3000,
    maxBuffer: 1024 * 64
  }, (error, stdout) => {
    const cpu = cpuPercent();
    let extra = {};
    if (!error && stdout) {
      try { extra = JSON.parse(stdout); }
      catch (_) { extra = {}; }
    }
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const data = {
      ok: true,
      cpu,
      ramUsed: Math.round((totalMem - freeMem) / totalMem * 100),
      ramUsedGb: roundGb(totalMem - freeMem),
      ramTotalGb: roundGb(totalMem),
      uptime: os.uptime(),
      host: os.hostname(),
      platform: os.platform(),
      ...extra
    };
    systemStatusCache = { at: Date.now(), data };
    sendJson(res, 200, data);
  });
}

function sampleCpu() {
  return os.cpus().reduce((acc, cpu) => {
    acc.idle += cpu.times.idle;
    acc.total += Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return acc;
  }, { idle: 0, total: 0 });
}

function cpuPercent() {
  const next = sampleCpu();
  const idle = next.idle - cpuSample.idle;
  const total = next.total - cpuSample.total;
  cpuSample = next;
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100)));
}

function roundGb(bytes) {
  return Math.round(bytes / 1024 / 1024 / 1024 * 10) / 10;
}

function filterWindowsMedia(data) {
  if (!data || !data.ok || !isBrowserMedia(data.source)) return data;
  const haystack = [data.title, data.artist, data.album, data.source, data.sourceLabel].filter(Boolean).join(" ");
  if (/twitch|twitch\.tv|twitter|x\.com/i.test(haystack)) {
    return { ok: false, error: "browser_media_filtered" };
  }
  if (/youtube|youtu\.be|youtube music/i.test(haystack)) return data;
  return data.title && data.artist ? data : { ok: false, error: "browser_media_filtered" };
}

function isBrowserMedia(source) {
  return /chrome|firefox|msedge|edge/i.test(String(source || ""));
}

function requireSession(url) {
  const sessionToken = String(url.searchParams.get("session_token") || "");
  const entry = findPairingBySession(sessionToken);
  return entry && entry.status === "connected" ? entry : null;
}

async function getAccessToken(pairing) {
  if (pairing.accessToken && pairing.accessTokenExpiresAt > Date.now() + 60_000) return pairing.accessToken;
  if (!pairing.refreshToken || !pairing.clientId) return "";

  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: pairing.refreshToken,
      client_id: pairing.clientId
    })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    if (data.error === "invalid_grant" || resp.status === 400 || resp.status === 401) resetInMemoryAuth(pairing);
    saveState();
    return "";
  }
  pairing.accessToken = data.access_token;
  pairing.accessTokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  if (data.refresh_token) pairing.refreshToken = data.refresh_token;
  saveState();
  return pairing.accessToken;
}

function resetInMemoryAuth(pairing) {
  pairing.status = "expired";
  pairing.refreshToken = "";
  pairing.sessionToken = "";
  pairing.accessToken = "";
  pairing.accessTokenExpiresAt = 0;
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
    return { oauthStates: {}, pairings: {} };
  }
}

function normalizeState(value) {
  const next = value && typeof value === "object" ? value : {};
  next.oauthStates = next.oauthStates && typeof next.oauthStates === "object" ? next.oauthStates : {};
  next.pairings = next.pairings && typeof next.pairings === "object" ? next.pairings : {};
  if (next.pairingCode && !next.pairings[next.pairingCode]) {
    next.pairings[next.pairingCode] = {
      clientId: next.clientId || "",
      pairingCode: next.pairingCode,
      status: next.status || "pending",
      expiresAt: next.expiresAt || 0,
      refreshToken: next.refreshToken || "",
      sessionToken: next.sessionToken || "",
      accessToken: next.accessToken || "",
      accessTokenExpiresAt: next.accessTokenExpiresAt || 0,
      spotifyUserId: next.spotifyUserId || ""
    };
  }
  return { oauthStates: next.oauthStates, pairings: next.pairings };
}

function findPairingBySession(sessionToken) {
  if (!sessionToken) return null;
  return Object.values(state.pairings).find(pairing => pairing.sessionToken === sessionToken) || null;
}

function prunePairings() {
  const now = Date.now();
  for (const [code, pairing] of Object.entries(state.pairings)) {
    if (pairing.status !== "connected" && pairing.expiresAt < now) {
      delete state.pairings[code];
    }
  }
}

function saveState() {
  prunePairings();
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
  const pairings = Object.values(state.pairings);
  const connectedCount = pairings.filter(pairing => pairing.status === "connected" && pairing.refreshToken).length;
  const pending = pairings.find(pairing => pairing.status === "pending" && pairing.expiresAt > Date.now());
  const status = connectedCount ? `${connectedCount} session${connectedCount > 1 ? "s" : ""} connected` : pending ? "Pairing pending" : "Waiting for iCUE";
  const expires = pending ? new Date(pending.expiresAt).toLocaleString() : connectedCount ? "Connected sessions active" : "No active session";
  return `
    <section class="hero">
      <div class="mark-wrap"><img src="/assets/spotify.svg" alt="" /></div>
      <p class="eyebrow">Local Spotify bridge</p>
      <h1>${escapeHtml(status)}</h1>
      <p class="lead">OAuth and player controls stay on this machine at <code>${escapeHtml(BASE_URL)}</code>.</p>
      <div class="actions">
        <a class="button primary" href="/health">Health JSON</a>
        ${pending ? `<a class="button" href="/auth/start?pairing_code=${encodeURIComponent(pending.pairingCode)}">Authorize current pairing</a>` : ""}
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
