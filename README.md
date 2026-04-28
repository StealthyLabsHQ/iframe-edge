# icue-edge-widgets

HTML, CSS, and JavaScript widgets for Corsair XENEON EDGE and iCUE.

This repository supports two usage modes:

- GitHub Pages embeds through the iCUE iFrame widget.
- Native iCUE imports through `.icuewidget` packages.

## Features

- Pure frontend widgets with no runtime build step for GitHub Pages.
- Responsive layouts for iCUE widget sizes.
- Native `.icuewidget` packages generated under `dist/icuewidgets/`.
- English-only widget UI.
- Shared styling for compact, headerless XENEON EDGE layouts.
- Spotify Visualizer with native iCUE settings, Spotify authorization, playback controls, volume, and lyrics layouts.
- AI Assistant with Gemini, Claude, and OpenAI provider support.

## Available Widgets

| Widget | GitHub Pages iFrame |
| --- | --- |
| AI Assistant | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/ai-assistant/"></iframe>` |
| Spotify Visualizer | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/spotify-visualizer/"></iframe>` |
| ISS Horizon | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/iss-horizon/"></iframe>` |
| News Radar | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/news-radar/"></iframe>` |
| Budget | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/budget/"></iframe>` |
| Daily Focus | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/daily-focus/"></iframe>` |
| Habit Tracker | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/habit-tracker/"></iframe>` |
| Hydration | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/hydration/"></iframe>` |
| Quick Notes | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/notes/"></iframe>` |
| Pomodoro | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/pomodoro/"></iframe>` |
| Posture Reminder | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/posture-reminder/"></iframe>` |
| Quick Clipboard | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/quick-clipboard/"></iframe>` |
| Timer | `<iframe src="https://stealthylabshq.github.io/icue-edge-widgets/productivity/timer/"></iframe>` |

## Native iCUE Packages

Prebuilt packages are stored in `dist/icuewidgets/`:

- `ai-assistant.icuewidget`
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

## iFrame Usage

1. Open iCUE.
2. Select the XENEON EDGE screen.
3. Add the iFrame widget.
4. Paste one of the iframe snippets from the table above.
5. Select the desired iCUE widget size.

Most widgets also support a `?size=` URL parameter:

| Size | Example |
| --- | --- |
| M | `https://stealthylabshq.github.io/icue-edge-widgets/productivity/pomodoro/?size=m` |
| L | `https://stealthylabshq.github.io/icue-edge-widgets/productivity/pomodoro/` |
| XL | `https://stealthylabshq.github.io/icue-edge-widgets/productivity/pomodoro/?size=xl` |

ISS Horizon and Spotify Visualizer primarily use iCUE size detection instead of the `?size=` parameter.

## Spotify Visualizer Setup

Spotify Visualizer requires Spotify Premium and a Spotify Developer app.

1. Open the Spotify Developer Dashboard: `https://developer.spotify.com/dashboard`
2. Create an app.
3. Add this redirect URL:

```text
https://stealthylabshq.github.io/icue-edge-widgets/spotify-visualizer/auth/callback.html
```

4. Enable Web API access.
5. Copy the Spotify Client ID.
6. In iCUE, import `dist/icuewidgets/spotify-visualizer.icuewidget`.
7. Paste the Client ID in the native iCUE Spotify settings panel.
8. Use the widget authorization button to connect Spotify.
9. Paste the generated refresh token in the native iCUE settings panel if needed.

Spotify Visualizer supports:

- S and M player-only layouts.
- L and XL lyrics layouts.
- Playback controls.
- Volume control.
- Theme toggle.
- Last track restore while reconnecting.
- Synced lyrics cache.
- Native iCUE settings for Client ID, Refresh Token, and Spotify Developer Dashboard URL.

## AI Assistant Setup

AI Assistant supports Gemini, Claude, and OpenAI.

1. Add the AI Assistant widget through iFrame or import `ai-assistant.icuewidget`.
2. Open the widget settings.
3. Select a provider.
4. Paste the provider API key.
5. Save settings.

Provider key pages:

- Gemini: `https://aistudio.google.com/app/apikey`
- Claude: `https://console.anthropic.com/settings/keys`
- OpenAI: `https://platform.openai.com/api-keys`

## Repository Layout

| Path | Purpose |
| --- | --- |
| `ai-assistant/` | AI Assistant widget |
| `spotify-visualizer/` | Spotify Visualizer widget and Spotify auth pages |
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
