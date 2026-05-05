# icue-edge-widgets

HTML, CSS, and JavaScript widgets for Corsair LCD devices and iCUE.

This repository supports native iCUE imports through `.icuewidget` packages.

## Features

- Responsive layouts for supported iCUE LCD devices.
- Native `.icuewidget` packages generated under `dist/icuewidgets/`.
- English-only widget UI.
- Shared styling for compact, headerless XENEON EDGE layouts.
- Weather Now for XENEON EDGE using Open-Meteo.
- GitHub Repo Monitor for XENEON EDGE using GitHub public API.
- Daily Brief for XENEON EDGE using Open-Meteo.
- Countdowns for XENEON EDGE using local settings only.
- Habit Rings for XENEON EDGE using local daily storage.
- Windows Media Pump for Corsair pump LCD using the native iCUE media provider.
- Cooling Sensor Pump for Corsair pump LCD, auto-selecting pump or temperature sensors.

## Available Widgets

| Widget | Package |
| --- | --- |
| ISS Horizon | `iss-horizon.icuewidget` |
| Weather Now | `weather-now.icuewidget` |
| GitHub Repo Monitor | `github-repo-monitor.icuewidget` |
| World Clock | `world-clock.icuewidget` |
| Focus Timer | `focus-timer.icuewidget` |
| Daily Brief | `daily-brief.icuewidget` |
| Countdowns | `countdowns.icuewidget` |
| Habit Rings | `habit-rings.icuewidget` |
| Windows Media Pump | `windows-media-pump.icuewidget` |
| Cooling Sensor Pump | `cooling-sensor-pump.icuewidget` |

## Discontinued

- Spotify Visualizer is discontinued. Native iCUE media data does not expose album art or reliable Spotify metadata, and the local-helper approach was removed to keep widgets simple to install and run.

## Native iCUE Packages

Prebuilt packages are split by device:

### XENEON EDGE

Stored in `dist/icuewidgets/xeneon-edge/`:

- `iss-horizon.icuewidget`
- `weather-now.icuewidget`
- `github-repo-monitor.icuewidget`
- `world-clock.icuewidget`
- `focus-timer.icuewidget`
- `daily-brief.icuewidget`
- `countdowns.icuewidget`
- `habit-rings.icuewidget`

### Corsair Watercooling

Stored in `dist/icuewidgets/corsair-watercooling/`:

- `windows-media-pump.icuewidget`
- `cooling-sensor-pump.icuewidget`

To rebuild and validate every package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-icuewidgets.ps1
```

The packaging script stages files in `.icuewidget-build/`, validates with the iCUE Widget CLI, then writes final archives to device folders under `dist/icuewidgets/`.

Package details:

- `index.html` is written as the first ZIP entry for iCUE import compatibility.
- Secondary HTML pages are excluded from widget archives.
- Widget preview icons are copied to `resources/icon.svg`.
- XENEON EDGE manifests target `dashboard_lcd` with `sensor-screen` support.
- Corsair watercooling manifests target `pump_lcd`.
- Locale files map iCUE translation keys to English fallback text.
- The default iCUE event bridge is packaged as an external script.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `iss-horizon/` | ISS Horizon widget |
| `weather-now/` | Current weather widget |
| `github-repo-monitor/` | GitHub repository status widget |
| `world-clock/` | Multi-timezone clock widget |
| `focus-timer/` | Pomodoro focus timer widget |
| `daily-brief/` | Daily date, time, and weather brief widget |
| `countdowns/` | Local countdown tracker widget |
| `habit-rings/` | Local daily habit tracker widget |
| `windows-media-pump/` | Windows media pump LCD widget |
| `cooling-sensor-pump/` | Automatic pump LCD cooling sensor widget |
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
