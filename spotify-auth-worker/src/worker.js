const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const PAIRING_TTL_MS = 30 * 60 * 1000;
const STATE_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');
const accessTokenCache = new Map();
const rateLimitCache = new Map();

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(error);
      return json({ error: 'internal_error' }, 500, env);
    }
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return cors(null, env);
  if (isAuthSetupRoute(request, url) && isRateLimited(request, url.pathname, 30, 15 * 60 * 1000)) {
    return json({ error: 'rate_limited' }, 429, env);
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return json({ ok: true }, 200, env);
  }

  if (request.method === 'POST' && url.pathname === '/pairings') {
    return createPairing(request, url, env);
  }

  if (request.method === 'GET' && url.pathname === '/pairings') {
    return createPairingPage(url, env);
  }

  if (request.method === 'POST' && url.pathname === '/pairings/reset') {
    return resetPairing(request, url, env);
  }

  if (request.method === 'GET' && url.pathname === '/auth/start') {
    return startAuth(url, env);
  }

  if (request.method === 'GET' && url.pathname === '/auth/callback') {
    return finishAuth(url, env);
  }

  if (request.method === 'GET' && url.pathname === '/session') {
    return getSession(url, env);
  }

  if (request.method === 'GET' && url.pathname === '/spotify/player') {
    return getPlayer(url, env);
  }

  if (request.method === 'POST' && url.pathname === '/spotify/action') {
    return spotifyAction(url, env);
  }

  return json({ error: 'not_found' }, 404, env);
}

async function createPairing(request, url, env) {
  const body = await request.json().catch(() => ({}));
  const clientId = normalizeClientId(body.client_id || url.searchParams.get('client_id'));
  if (!clientId) return json({ error: 'missing_client_id' }, 400, env);
  const pairing = await createPairingRecord(env, clientId);
  return json(pairing, 201, env);
}

async function createPairingPage(url, env) {
  const clientId = normalizeClientId(url.searchParams.get('client_id'));
  if (!clientId) return html('Missing Spotify Client ID. Create a Spotify app, then open /pairings?client_id=YOUR_CLIENT_ID.', 400);
  const pairing = await createPairingRecord(env, clientId);
  const authUrl = new URL(pairing.authorize_url, url.origin).toString();
  return pairingHtml(pairing.pairing_code, authUrl);
}

async function createPairingRecord(env, clientId) {
  await cleanupExpired(env);
  const now = Date.now();
  const pairingCode = randomCode(8);
  await env.DB.prepare(
    'INSERT INTO pairings (pairing_code, status, client_id, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(pairingCode, 'pending', clientId, now, now, now + PAIRING_TTL_MS).run();

  return {
    pairing_code: pairingCode,
    authorize_url: `/auth/start?pairing_code=${encodeURIComponent(pairingCode)}`,
    expires_at: now + PAIRING_TTL_MS
  };
}

async function resetPairing(request, url, env) {
  let pairingCode = normalizeCode(url.searchParams.get('pairing_code'));
  let sessionToken = normalizeSessionToken(url.searchParams.get('session_token'));
  if (!pairingCode) {
    const body = await request.json().catch(() => ({}));
    pairingCode = normalizeCode(body.pairing_code);
    sessionToken = normalizeSessionToken(body.session_token);
  }
  if (!pairingCode && sessionToken) {
    const pairing = await getPairingBySessionToken(env, sessionToken);
    if (pairing) pairingCode = pairing.pairing_code;
  }
  if (!pairingCode) return json({ error: 'missing_pairing_code' }, 400, env);
  accessTokenCache.delete(pairingCode);
  await expirePairing(env, pairingCode);
  return json({ ok: true }, 200, env);
}

async function startAuth(url, env) {
  requireEnv(env, ['SPOTIFY_REDIRECT_URI']);
  const pairingCode = normalizeCode(url.searchParams.get('pairing_code'));
  if (!pairingCode) return json({ error: 'missing_pairing_code' }, 400, env);

  const pairing = await getPairing(env, pairingCode);
  if (!pairing || pairing.expires_at < Date.now()) return json({ error: 'pairing_expired' }, 410, env);
  const clientId = getPairingClientId(env, pairing);
  if (!clientId) return json({ error: 'missing_client_id' }, 400, env);

  const state = crypto.randomUUID();
  const codeVerifier = randomVerifier();
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO oauth_states (state, pairing_code, code_verifier, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(state, pairingCode, codeVerifier, now, now + STATE_TTL_MS).run();

  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', env.SPOTIFY_REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('show_dialog', 'true');
  return Response.redirect(authUrl.toString(), 302);
}

async function finishAuth(url, env) {
  requireEnv(env, ['SPOTIFY_REDIRECT_URI']);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return html('Spotify authorization failed. Missing code or state.', 400);

  const row = await env.DB.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first();
  if (!row || row.expires_at < Date.now()) return html('Spotify authorization expired. Start again from the widget.', 410);
  const pairing = await getPairing(env, row.pairing_code);
  const clientId = getPairingClientId(env, pairing);
  if (!clientId) return html('Missing Spotify Client ID. Start again from the widget.', 400);

  const tokenResp = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      client_id: clientId,
      code_verifier: row.code_verifier
    })
  });
  const tokenData = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok || !tokenData.refresh_token) return html('Spotify token exchange failed.', 502);

  const meResp = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const me = await meResp.json().catch(() => ({}));
  const refreshEnc = await encryptText(env, tokenData.refresh_token);
  const now = Date.now();

  await env.DB.prepare(
    'UPDATE pairings SET status = ?, spotify_user_id = ?, refresh_token_enc = ?, session_token_hash = NULL, session_expires_at = NULL, session_claimed_at = NULL, updated_at = ?, expires_at = ? WHERE pairing_code = ?'
  ).bind('connected', me.id || null, refreshEnc, now, now + SESSION_TTL_MS, row.pairing_code).run();
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();

  return html('Spotify connected. You can return to iCUE.');
}

async function getSession(url, env) {
  const pairing = await requirePairing(url, env);
  if (pairing instanceof Response) return pairing;
  const connected = pairing.status === 'connected' && !!pairing.refresh_token_enc;
  const body = {
    connected,
    status: pairing.status,
    spotify_user_id: pairing.spotify_user_id || null,
    expires_at: pairing.session_expires_at || pairing.expires_at
  };
  if (connected && !pairing.session_token_hash) {
    const sessionToken = randomVerifier();
    const sessionHash = await sha256Base64Url(sessionToken);
    const now = Date.now();
    await env.DB.prepare(
      'UPDATE pairings SET session_token_hash = ?, session_expires_at = ?, session_claimed_at = ?, updated_at = ? WHERE pairing_code = ?'
    ).bind(sessionHash, now + SESSION_TTL_MS, now, now, pairing.pairing_code).run();
    body.session_token = sessionToken;
    body.expires_at = now + SESSION_TTL_MS;
  }
  return json(body, 200, env);
}

async function getPlayer(url, env) {
  const pairing = await requireSession(url, env);
  if (pairing instanceof Response) return pairing;
  if (pairing.status !== 'connected' || !pairing.refresh_token_enc) {
    return json({ error: 'not_connected' }, 401, env);
  }

  const accessToken = await getAccessTokenForPairing(env, pairing);
  if (!accessToken) return json({ error: 'session_expired' }, 401, env);
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const [playerResp, currentResp] = await Promise.all([
    fetch(`${SPOTIFY_API_BASE}/me/player?additional_types=track`, { headers: authHeaders }),
    fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing?additional_types=track`, { headers: authHeaders })
  ]);

  const playerData = playerResp.ok && playerResp.status !== 204 ? await playerResp.json().catch(() => null) : null;
  const currentData = currentResp.ok && currentResp.status !== 204 ? await currentResp.json().catch(() => null) : null;

  if (currentData && currentData.item) {
    return json({
      ...(playerData || {}),
      item: currentData.item,
      progress_ms: currentData.progress_ms,
      is_playing: currentData.is_playing,
      currently_playing_type: currentData.currently_playing_type,
      timestamp: currentData.timestamp
    }, 200, env);
  }

  if (playerData) return json(playerData, playerResp.status, env);
  if (playerResp.status === 204 || currentResp.status === 204) return new Response(null, { status: 204, headers: corsHeaders(env) });
  return json({ error: 'spotify_player_unavailable' }, playerResp.status || currentResp.status || 502, env);
}

async function spotifyAction(url, env) {
  const pairing = await requireSession(url, env);
  if (pairing instanceof Response) return pairing;
  if (pairing.status !== 'connected' || !pairing.refresh_token_enc) {
    return json({ error: 'not_connected' }, 401, env);
  }

  const endpoint = normalizeSpotifyEndpoint(url.searchParams.get('endpoint'));
  const method = String(url.searchParams.get('method') || 'POST').toUpperCase();
  if (!endpoint || !isAllowedSpotifyAction(method, endpoint)) {
    return json({ error: 'action_not_allowed' }, 400, env);
  }

  const accessToken = await getAccessTokenForPairing(env, pairing);
  if (!accessToken) return json({ error: 'session_expired' }, 401, env);
  const resp = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return json({ ok: resp.ok, status: resp.status }, resp.ok ? 200 : resp.status, env);
}

async function refreshAccessToken(env, refreshToken, clientId) {
  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    const error = new Error('spotify_refresh_failed');
    error.status = resp.status;
    error.code = data.error || '';
    throw error;
  }
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 3600,
    refreshToken: data.refresh_token || null
  };
}

async function getAccessTokenForPairing(env, pairing) {
  const cached = accessTokenCache.get(pairing.pairing_code);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;

  try {
    const clientId = getPairingClientId(env, pairing);
    if (!clientId) return null;
    const refreshToken = await decryptText(env, pairing.refresh_token_enc);
    const token = await refreshAccessToken(env, refreshToken, clientId);
    if (token.refreshToken && token.refreshToken !== refreshToken) {
      await env.DB.prepare(
        'UPDATE pairings SET refresh_token_enc = ?, updated_at = ? WHERE pairing_code = ?'
      ).bind(await encryptText(env, token.refreshToken), Date.now(), pairing.pairing_code).run();
    }
    accessTokenCache.set(pairing.pairing_code, {
      accessToken: token.accessToken,
      expiresAt: Date.now() + token.expiresIn * 1000
    });
    return token.accessToken;
  } catch (error) {
    accessTokenCache.delete(pairing.pairing_code);
    if (isDeadRefreshToken(error)) await expirePairing(env, pairing.pairing_code);
    return null;
  }
}

function isDeadRefreshToken(error) {
  return error?.code === 'invalid_grant' || error?.status === 400 || error?.status === 401;
}

async function requirePairing(url, env) {
  const pairingCode = normalizeCode(url.searchParams.get('pairing_code'));
  if (!pairingCode) return json({ error: 'missing_pairing_code' }, 400, env);
  const pairing = await getPairing(env, pairingCode);
  if (!pairing) return json({ error: 'pairing_not_found' }, 404, env);
  if (pairing.expires_at < Date.now()) return json({ error: 'pairing_expired' }, 410, env);
  return pairing;
}

function getPairing(env, pairingCode) {
  return env.DB.prepare('SELECT * FROM pairings WHERE pairing_code = ?').bind(pairingCode).first();
}

function getPairingClientId(env, pairing) {
  return normalizeClientId(pairing?.client_id) || normalizeClientId(env.SPOTIFY_CLIENT_ID);
}

async function requireSession(url, env) {
  const sessionToken = normalizeSessionToken(url.searchParams.get('session_token'));
  if (!sessionToken) return json({ error: 'missing_session_token' }, 400, env);
  const pairing = await getPairingBySessionToken(env, sessionToken);
  if (!pairing) return json({ error: 'session_not_found' }, 404, env);
  if ((pairing.session_expires_at || 0) < Date.now()) return json({ error: 'session_expired' }, 410, env);
  return pairing;
}

async function getPairingBySessionToken(env, sessionToken) {
  const sessionHash = await sha256Base64Url(sessionToken);
  return env.DB.prepare('SELECT * FROM pairings WHERE session_token_hash = ?').bind(sessionHash).first();
}

async function expirePairing(env, pairingCode) {
  const now = Date.now();
  await env.DB.prepare(
    'UPDATE pairings SET status = ?, refresh_token_enc = NULL, session_token_hash = NULL, session_expires_at = NULL, session_claimed_at = NULL, updated_at = ?, expires_at = ? WHERE pairing_code = ?'
  ).bind('expired', now, now, pairingCode).run();
}

async function cleanupExpired(env) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(now).run();
  await env.DB.prepare("DELETE FROM pairings WHERE expires_at < ? AND status != 'connected'").bind(now).run();
}

async function encryptText(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importEncryptionKey(env);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}

async function decryptText(env, value) {
  const [ivText, dataText] = String(value || '').split('.');
  if (!ivText || !dataText) throw new Error('invalid_ciphertext');
  const key = await importEncryptionKey(env);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unbase64(ivText) },
    key,
    unbase64(dataText)
  );
  return new TextDecoder().decode(decrypted);
}

function importEncryptionKey(env) {
  requireEnv(env, ['TOKEN_ENCRYPTION_KEY_BASE64']);
  return crypto.subtle.importKey('raw', unbase64(env.TOKEN_ENCRYPTION_KEY_BASE64), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function randomCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

function randomVerifier() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64(new Uint8Array(digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeSessionToken(value) {
  const token = String(value || '').trim();
  return token.length >= 32 && token.length <= 256 ? token : '';
}

function normalizeClientId(value) {
  const clientId = String(value || '').trim();
  return /^[a-f0-9]{32}$/i.test(clientId) ? clientId : '';
}

function normalizeSpotifyEndpoint(value) {
  const endpoint = String(value || '').trim();
  if (!endpoint.startsWith('/me/player')) return '';
  return endpoint;
}

function isAllowedSpotifyAction(method, endpoint) {
  const allowed = [
    ['POST', /^\/me\/player\/previous$/],
    ['POST', /^\/me\/player\/next$/],
    ['PUT', /^\/me\/player\/pause$/],
    ['PUT', /^\/me\/player\/play$/],
    ['PUT', /^\/me\/player\/shuffle\?state=(true|false)$/],
    ['PUT', /^\/me\/player\/repeat\?state=(off|context|track)$/],
    ['PUT', /^\/me\/player\/volume\?volume_percent=([0-9]|[1-9][0-9]|100)$/],
    ['PUT', /^\/me\/player\/seek\?position_ms=\d+$/]
  ];
  return allowed.some(([allowedMethod, pattern]) => method === allowedMethod && pattern.test(endpoint));
}

function isAuthSetupRoute(request, url) {
  return (url.pathname === '/pairings' && (request.method === 'GET' || request.method === 'POST')) ||
    (url.pathname === '/auth/start' && request.method === 'GET');
}

function isRateLimited(request, scope, limit, windowMs) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const entry = rateLimitCache.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

function requireEnv(env, names) {
  const missing = names.filter(name => !env[name]);
  if (missing.length) throw new Error(`missing_env:${missing.join(',')}`);
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(env), ...securityHeaders(false), 'Content-Type': 'application/json' }
  });
}

function html(message, status = 200) {
  const ok = status >= 200 && status < 300;
  const title = ok ? 'Spotify Connected' : 'Spotify Authorization';
  const safeMessage = escapeHtml(message);
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #050706;
      --panel: rgba(12, 16, 14, .86);
      --line: rgba(255, 255, 255, .10);
      --text: #f4f7f5;
      --muted: #9ba6a0;
      --accent: #1ed760;
      --danger: #ff5d5d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      overflow: hidden;
      background:
        radial-gradient(circle at 24% 24%, rgba(30, 215, 96, .18), transparent 28rem),
        radial-gradient(circle at 84% 72%, rgba(30, 215, 96, .10), transparent 24rem),
        linear-gradient(135deg, #020303, var(--bg));
      color: var(--text);
      font: 500 16px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(92vw, 520px);
      padding: 34px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018)), var(--panel);
      box-shadow: 0 28px 90px rgba(0, 0, 0, .55), inset 0 1px 0 rgba(255,255,255,.08);
      backdrop-filter: blur(18px);
    }
    .mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      margin-bottom: 22px;
      border-radius: 14px;
      background: ${ok ? 'rgba(30, 215, 96, .16)' : 'rgba(255, 93, 93, .13)'};
      color: ${ok ? 'var(--accent)' : 'var(--danger)'};
      border: 1px solid ${ok ? 'rgba(30, 215, 96, .32)' : 'rgba(255, 93, 93, .28)'};
      font-size: 24px;
      font-weight: 800;
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 5vw, 42px);
      line-height: 1;
      letter-spacing: 0;
    }
    p {
      margin: 0;
      color: var(--muted);
      max-width: 36rem;
    }
    .status {
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      color: ${ok ? 'var(--accent)' : 'var(--danger)'};
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <main>
    <div class="mark">${ok ? 'OK' : '!'}</div>
    <h1>${ok ? 'Connected' : 'Authorization issue'}</h1>
    <p>${safeMessage}</p>
    <div class="status">${ok ? 'Return to iCUE' : 'Try again from widget'}</div>
  </main>
</body>
</html>`, {
    status,
    headers: { ...securityHeaders(true), 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function pairingHtml(pairingCode, authUrl) {
  const safeCode = escapeHtml(pairingCode);
  const safeAuthUrl = escapeHtml(authUrl);
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Spotify Pairing</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #040605;
      --panel: rgba(11, 15, 13, .88);
      --line: rgba(255,255,255,.11);
      --text: #f5f7f5;
      --muted: #9ca7a1;
      --accent: #1ed760;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 20% 18%, rgba(30,215,96,.18), transparent 28rem),
        linear-gradient(135deg, #020303, var(--bg));
      color: var(--text);
      font: 500 16px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(92vw, 560px);
      padding: 34px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015)), var(--panel);
      box-shadow: 0 28px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08);
    }
    .eyebrow {
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    h1 {
      margin: 10px 0 8px;
      font-size: clamp(30px, 6vw, 48px);
      line-height: 1;
      letter-spacing: 0;
    }
    p { margin: 0; color: var(--muted); }
    .code {
      margin: 28px 0 18px;
      padding: 18px 20px;
      border: 1px solid rgba(30,215,96,.32);
      border-radius: 14px;
      background: rgba(30,215,96,.10);
      color: #fff;
      font: 800 clamp(34px, 10vw, 70px)/1 ui-monospace, SFMono-Regular, Consolas, monospace;
      letter-spacing: .12em;
      text-align: center;
    }
    a {
      display: block;
      width: 100%;
      margin-top: 18px;
      padding: 14px 18px;
      border-radius: 12px;
      background: var(--accent);
      color: #031107;
      text-align: center;
      text-decoration: none;
      font-weight: 800;
    }
    .hint {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Spotify Visualizer</div>
    <h1>Pairing code</h1>
    <p>Paste this code into iCUE, then authorize Spotify.</p>
    <div class="code">${safeCode}</div>
    <a href="${safeAuthUrl}">Authorize Spotify</a>
    <p class="hint">Code expires in 30 minutes. Keep iCUE open during authorization.</p>
  </main>
</body>
</html>`, {
    status: 200,
    headers: { ...corsHeaders({}), ...securityHeaders(true), 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function cors(response, env) {
  return response || new Response(null, { status: 204, headers: corsHeaders(env) });
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.WIDGET_ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache'
  };
}

function securityHeaders(isHtml) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  if (isHtml) {
    headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  }
  return headers;
}

function base64(bytes) {
  let text = '';
  bytes.forEach(byte => { text += String.fromCharCode(byte); });
  return btoa(text);
}

function unbase64(text) {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}
