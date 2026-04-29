# Spotify Auth Worker

Cloudflare Worker for Spotify OAuth storage outside iCUE widgets.

## Purpose

The widget should not store Spotify refresh tokens in iCUE settings, URL hashes, or shared localStorage. This worker stores the refresh token server-side and exposes a pairing-code flow for the widget. Each user can provide their own Spotify Client ID.

GitHub Pages remains the widget domain:

```text
https://stealthylabshq.github.io/icue-edge-widgets/
```

The Worker is only the OAuth/API backend.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET`/`POST` | `/pairings` with `client_id` | Create pairing code |
| `POST` | `/pairings/reset?pairing_code=CODE` | Expire a pending pairing |
| `POST` | `/pairings/reset?session_token=TOKEN` | Expire connected session and clear stored token |
| `GET` | `/auth/start?pairing_code=CODE` | Redirect user to Spotify OAuth |
| `GET` | `/auth/callback` | Spotify redirect target |
| `GET` | `/session?pairing_code=CODE` | Claim connected pairing and receive session token |
| `GET` | `/spotify/player?session_token=TOKEN` | Proxy Spotify currently-playing state |
| `POST` | `/spotify/action?session_token=TOKEN&method=PUT&endpoint=/me/player/pause` | Proxy whitelisted playback controls |

## Setup

1. Create Cloudflare D1 database.
2. Copy `wrangler.toml.example` to `wrangler.toml`.
3. Fill `database_id` and `SPOTIFY_REDIRECT_URI`.
4. Keep `WIDGET_ALLOWED_ORIGIN` as `*` for `.icuewidget` WebViews:

```text
*
```
5. Set secrets:

```powershell
wrangler secret put TOKEN_ENCRYPTION_KEY_BASE64
```

Generate encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

6. Initialize DB:

```powershell
npm run db:init
```

7. Deploy:

```powershell
npm run deploy
```

## Spotify App

Each user-created Spotify app must set redirect URI to:

```text
https://spotify-auth-worker.code-39c.workers.dev/auth/callback
```

## Widget Integration

The widget stores the user's Spotify Client ID, then a short-lived pairing code until OAuth completes, then uses a server-issued session token:

```text
POST /pairings { "client_id": "..." }
GET /session?pairing_code=CODE
GET /spotify/player?session_token=TOKEN
```

Refresh tokens stay encrypted in D1.
Legacy client-side refresh-token storage is not used by the widget.
