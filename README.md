# icue-edge-widgets

HTML, CSS, and JavaScript widgets for Corsair XENEON EDGE and iCUE.

This repository supports native iCUE imports through `.icuewidget` packages.

## Features

- Responsive layouts for iCUE widget sizes.
- Native `.icuewidget` packages generated under `dist/icuewidgets/`.
- English-only widget UI.
- Shared styling for compact, headerless XENEON EDGE layouts.
- Spotify Visualizer with native iCUE settings, Spotify authorization, playback controls, volume, and lyrics layouts.

## Available Widgets

| Widget | Package |
| --- | --- |
| Spotify Visualizer | `spotify-visualizer.icuewidget` |
| ISS Horizon | `iss-horizon.icuewidget` |
| News Radar | `news-radar.icuewidget` |
| Budget | `budget.icuewidget` |
| Daily Focus | `daily-focus.icuewidget` |
| Habit Tracker | `habit-tracker.icuewidget` |
| Hydration | `hydration.icuewidget` |
| Quick Notes | `notes.icuewidget` |
| Pomodoro | `pomodoro.icuewidget` |
| Posture Reminder | `posture-reminder.icuewidget` |
| Quick Clipboard | `quick-clipboard.icuewidget` |
| Timer | `timer.icuewidget` |

## Native iCUE Packages

Prebuilt packages are stored in `dist/icuewidgets/`:

- `spotify-visualizer.icuewidget`
- `iss-horizon.icuewidget`
- `news-radar.icuewidget`
- `budget.icuewidget`
- `daily-focus.icuewidget`
- `habit-tracker.icuewidget`
- `hydration.icuewidget`
- `notes.icuewidget`
- `pomodoro.icuewidget`
- `posture-reminder.icuewidget`
- `quick-clipboard.icuewidget`
- `timer.icuewidget`

To rebuild and validate every package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-icuewidgets.ps1
```

The packaging script stages files in `icuewidget-build/`, validates with the iCUE Widget CLI, then writes final archives to `dist/icuewidgets/`.

Package details:

- `index.html` is written as the first ZIP entry for iCUE import compatibility.
- Secondary HTML pages are excluded from widget archives.
- Widget preview icons are copied to `resources/icon.svg`.
- Spotify Visualizer uses `svg/spotify.svg` as its preview icon.
- Manifests target XENEON EDGE with `dashboard_lcd` and `sensor-screen` support.
- Locale files map iCUE translation keys to English fallback text.
- The default iCUE event bridge is packaged as an external script.

## Spotify Visualizer Setup

Spotify Visualizer requires Spotify Premium and a free Spotify Developer app. The app is only used to identify your own Spotify account during login. No client secret is needed.

### Quick Install

1. Start the local helper:

```powershell
cd spotify-local-helper
npm start
```

2. Download `dist/icuewidgets/spotify-visualizer.icuewidget`.
3. Open iCUE and import the widget.
4. Add Spotify Visualizer to your XENEON EDGE screen.
5. Open the widget settings.
6. Paste your Spotify Client ID.
7. Click `Authorize Spotify` inside the widget.
8. Accept Spotify authorization.
9. Return to iCUE and start playback on Spotify.

### Get a Spotify Client ID

1. Open `https://developer.spotify.com/dashboard`.
2. Sign in with your Spotify account.
3. Create an app.
4. Open the app settings.
5. Add this redirect URI:

```text
http://127.0.0.1:8787/auth/callback
```

6. Save settings.
7. Copy the app `Client ID`.
8. Paste it into Spotify Visualizer settings in iCUE.

Do not use or share the client secret. Spotify Visualizer does not need it.

### Common Issues

- `Authorize Spotify` does nothing: check that the Client ID is pasted in iCUE settings.
- Spotify says redirect URI mismatch: add the exact redirect URI above in Spotify Developer Dashboard.
- Widget shows no music: start playback in the Spotify desktop/mobile app first.
- Lyrics are missing: Spotify lyrics and widget lyrics come from different providers. Some tracks may not exist in LRCLIB.
- You used the wrong Spotify account: type `RESET` in `Reset Pairing Code`, then authorize again.

Spotify Visualizer supports:

- S and M player-only layouts.
- L and XL lyrics layouts.
- Playback controls.
- Volume control.
- Theme toggle.
- Last track restore while reconnecting.
- Synced lyrics cache.
- Local Spotify OAuth through `spotify-local-helper`.

### Spotify Local Helper

`spotify-local-helper/` contains the local OAuth and Spotify API proxy for Spotify Visualizer.

The helper listens on:

```text
http://127.0.0.1:8787
```

It keeps OAuth refresh tokens on the local machine under `%APPDATA%\icue-edge-widgets\spotify-local-helper.json`.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `spotify-visualizer/` | Spotify Visualizer widget |
| `spotify-local-helper/` | Local Spotify OAuth and API proxy |
| `iss-horizon/` | ISS Horizon widget |
| `news-radar/` | News widget |
| `productivity/` | Productivity widgets |
| `scripts/package-icuewidgets.ps1` | iCUE package builder |
| `dist/icuewidgets/` | Generated `.icuewidget` archives |
| `svg/` | Shared SVG assets and package icons |
| `widget-polish.css` | Shared iCUE visual polish layer |

## Development

Install dependencies if needed:

```powershell
pnpm install
```

Run local development:

```powershell
pnpm dev
```

Run checks:

```powershell
pnpm lint
pnpm test
pnpm typecheck
```

Build iCUE widget packages:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-icuewidgets.ps1
```

## Notes

- Do not use dot-prefixed staging folders for iCUE packaging. The official CLI skips hidden path segments.
- Do not add French translations. Active widget UI is English-only.
- Do not commit secrets, API keys, or `.env` files.
