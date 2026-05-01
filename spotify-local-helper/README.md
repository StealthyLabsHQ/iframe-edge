# Spotify Local Helper

Local OAuth and Spotify API proxy for Spotify Visualizer.

## Setup

1. Install Node.js 18 or newer.
2. In Spotify Developer Dashboard, add redirect URI:

```text
http://127.0.0.1:8787/auth/callback
```

3. Start helper:

```powershell
cd spotify-local-helper
npm start
```

4. Import `dist/icuewidgets/spotify-visualizer.icuewidget`, paste Spotify Client ID in iCUE settings, then authorize.

Tokens are stored locally under `%APPDATA%\icue-edge-widgets\spotify-local-helper.json`.
