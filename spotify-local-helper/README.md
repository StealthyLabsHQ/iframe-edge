# Spotify Local Helper

Local OAuth and Spotify API proxy for Spotify Visualizer. It also powers Windows Media, System Status, and Network Pulse widgets.

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

## Auto-start on Windows login

Run this from the repository root to start the helper when Windows opens your session:

```powershell
$repo = (Get-Location).Path
$cmd = "cd /d `"$repo\spotify-local-helper`" && npm start"
schtasks /Create /TN "iCUE Spotify Local Helper" /SC ONLOGON /TR "cmd.exe /c $cmd" /F
```

To remove it:

```powershell
schtasks /Delete /TN "iCUE Spotify Local Helper" /F
```
