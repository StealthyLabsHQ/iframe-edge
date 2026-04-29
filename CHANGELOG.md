# Changelog

All notable changes to **icue-edge-widgets** are documented here.

---

## [Unreleased]

### Added - Widget polish layer
- `widget-polish.css`: shared Huashu design finish layer for active widgets, with compact icon-only headers, tighter controls, restrained 8px surfaces, improved borders, focus states, and less title-heavy UI.
- `scripts/package-icuewidgets.ps1`: validates and builds active widgets into `dist/icuewidgets/*.icuewidget`.
- Generated `.icuewidget` packages now use widget-specific SVG preview icons instead of text initials.
- `spotify-auth-worker/`: Cloudflare Worker starter for Spotify OAuth, pairing codes, encrypted refresh-token storage, and Spotify player proxying.
- Spotify Auth Worker deployed to Cloudflare Workers with D1 storage and PKCE OAuth.
- Spotify Visualizer now supports Worker-backed OAuth pairing instead of requiring Client ID and Refresh Token settings in iCUE.
- Spotify Auth Worker now allows browser GET requests to `/pairings` for manual pairing tests.
- Spotify Visualizer now reuses an existing Pairing Code when opening authorization instead of generating a mismatched new code.
- Spotify Visualizer now regenerates expired pairing codes before opening Spotify authorization.
- Spotify Auth Worker pairing and OAuth state windows now last 30 minutes.
- Spotify Auth Worker encryption-key setup now documents Node-generated base64 to avoid invalid secret encoding.

### Fixed - iCUE packages
- Spotify Visualizer now removes the legacy client-side refresh-token auth flow and relies on Worker-backed pairing only.
- Spotify Auth Worker now resets pairings server-side, returns generic internal errors, sends stricter security headers, and rate-limits pairing/OAuth setup routes.
- Spotify Auth Worker now exchanges pairing codes for opaque session tokens so playback APIs no longer accept pairing codes.
- Spotify Visualizer now keeps the player visible instead of blocking it with a warning overlay after long Spotify pauses or transient player errors.
- Spotify Visualizer now supports user-owned Spotify Client IDs, making OAuth independent from the maintainer's Spotify Developer Dashboard for new pairings.
- Spotify Visualizer now resolves lyrics from the first valid LRCLIB response and times out slow lyric calls to reduce delays after track switches.
- Spotify Visualizer now allows slower LRCLIB matches to finish so available lyrics are not marked unavailable too early.
- README now includes a clearer Spotify Visualizer install guide with Client ID setup and common troubleshooting.
- ISS Horizon now detects native `.icuewidget` runtime via `icueEvents` and defaults to NASA HLS streams instead of iframe-based live embeds.
- ISS Horizon now removes the live video area in favor of a larger ISS ground track map with Dark, Satellite, Day, and Auto styles.
- ISS Horizon map style now moves to native iCUE settings, and satellite mode overlays country/place labels.
- ISS Horizon map style changes now sync through an external iCUE bridge compatible with the widget CSP.
- Spotify Visualizer packages now expose native iCUE settings for Spotify Client ID and Refresh Token, matching the importable settings-panel pattern used by RSS widgets.
- Spotify Visualizer now removes its in-widget settings panel and opens Spotify authorization through the iCUE LinkProvider flow.
- Spotify Visualizer now syncs iCUE textfield values through an inline bridge before opening Spotify authorization.
- Spotify Visualizer now tolerates transient Spotify API misses while switching iCUE widgets before showing an offline state.
- Spotify Visualizer now preserves rotated Spotify refresh tokens across iCUE widget switches and restores the last track while reconnecting.
- Spotify Visualizer now keeps credentials instance-scoped so adding a second empty Spotify widget does not clear the active widget refresh token.
- Spotify Visualizer now suppresses transient Session expired overlays during widget switches when the current track is still visible.
- Spotify Visualizer now reloads lyrics after restored track snapshots so widget switches do not leave the lyrics panel empty.
- Spotify Visualizer now polls faster after skips and caches synced lyrics to reduce transition/loading delay.
- Spotify Visualizer now maps S/M slots to player-only layouts, L/XL to lyrics layouts, and removes the top Spotify badge/playing stripe.
- Spotify Visualizer compact S/M layouts now use larger album art and include volume controls.
- Spotify Visualizer theme toggle is now a subtle floating control in the lower corner.
- Spotify Visualizer theme toggle now anchors to the widget viewport instead of the header.
- Spotify Visualizer theme toggle now sits in the lower-left corner to avoid the lyrics scroll controls.
- Spotify Visualizer compact S/M layout now uses the available upper space more tightly.
- Spotify Visualizer compact S/M layout now uses larger track metadata text.
- Spotify Visualizer now removes the empty top header strip from the widget.
- Spotify Visualizer now clears stale local credentials when a newly added iCUE widget has empty native settings.
- Spotify Visualizer now blocks stale local refresh tokens when only Spotify Client ID is set in iCUE settings.
- Spotify Visualizer now retries the native iCUE Refresh Token after an iCUE restart if the cached local token is rejected.
- Spotify Visualizer now removes the green playing-state frame around the widget.
- Generated `.icuewidget` preview icons now use transparent widget-specific SVG marks across all widgets instead of black square tiles.
- Spotify Visualizer package now uses `svg/spotify.svg` as its iCUE preview icon.
- AI Assistant CSP now restricts proxy connections to StealthyLabs origins instead of any HTTPS endpoint.
- Spotify Visualizer iCUE property lookup now uses an explicit allowlist instead of dynamic function evaluation.
- Packaged widgets now inject the default iCUE event bridge as an external script, avoiding automatic CSP `unsafe-inline` relaxation.
- README now documents both supported iCUE usage modes: GitHub Pages iFrame embeds and native `.icuewidget` imports.
- Spotify Visualizer XL layout now uses more horizontal space with larger album art, player metadata, controls, and lyrics.
- Spotify Visualizer M layout now uses more vertical space with larger album art, metadata, controls, and lower player spacing.
- Spotify Visualizer iCUE settings now include a Spotify Developer Dashboard URL field for setup.
- Final `.icuewidget` archives now write `index.html` as the first ZIP entry, matching importable Marketplace packages and avoiding iCUE's title parser reading another file.
- Packaged archives now exclude secondary HTML pages so iCUE only validates the widget `index.html`.
- Translation files now include Corsair's expected locale keys with English fallback values, preventing `tr('...')` titles from resolving empty in iCUE.
- Packaged HTML now adds a viewport meta tag before the iCUE title when source widgets omit one.
- Fixed packaged `widget-polish.css` paths for productivity widgets.
- Packaged manifests now declare `dashboard_lcd` with `sensor-screen`, matching known importable Xeneon Edge widget packages.
- Packaged HTML now keeps `viewport` before `<title>`, matching Corsair and Marketplace widget structure.
- Packaged widgets now include a minimal global `icueEvents` bridge, removing the iCUE CLI validation warning across all widgets.
- Generated packages now place translated `tr('...')` HTML titles at the top of `<head>` for the iCUE import validator.
- Packaging now stages files in `icuewidget-build/` so the official iCUE Widget CLI includes the widget files instead of creating empty or invalid archives.

### Changed - Active widgets
- Removed visible header titles across active widgets while preserving DOM ids for runtime copy updates.
- Standardized active widget UI to English-only copy and removed French language toggles/dictionaries.
- News Radar defaults to English sources and no longer lists French feeds.

### Changed - Documentation
- README now documents English-only widgets and the shared `widget-polish.css` layer.
- Removed French documentation section to match English-only widget behavior.

### Added - Xeneon Edge Design System
- `productivity/xeneon-edge.css`: Shared design system for all widgets — CSS tokens (dark/light), AMOLED `#000` base, scanline grid overlay, base components (`.mod-header`, `.mod-icon`, `.mod-title`, `.lang-toggle`, `.stat-chip`, `.stats-row`, `.btn`, `.btn-ghost`, `.toast`), M/L/XL size utilities via `data-size` attribute
- `productivity/size-loader.js`: Flash-free size detection — reads `?size=m|l|xl` from URL param, sets `data-size` on `<html>` before render; mirrors `theme-loader.js` pattern

### Changed - Pomodoro (reference implementation)
- Complete visual refonte to Xeneon Edge: Corsair cyan `#00c8ff` accent, gold `#f9ca24` timer digits, Space Grotesk + IBM Plex Sans + JetBrains Mono fonts
- **Size M** (`?size=m`): SVG ring hidden, large digital display 52px, phase label in cyan, 3px linear progress bar at bottom
- **Size L** (default): ring 170px, refined phase badge, glow effect on ring progress arc
- **Size XL** (`?size=xl`): ring 200px, stats row (Session / Focused / Done chips), expanded spacing and controls
- Added real-time stats tracking: focused-time accumulation per session, session counter display
- Added `is-break` class on `.widget` for teal break-mode visual state (border, accent line, icon, digits, controls)
- `btn-timer` now uses cyan/teal outline style (not solid fill) — activates solid on running state
- `m-progress-fill` synchronized with timer tick (elapsed indicator, 0 → 100%)

### Changed - AI Assistant
- Fonts: Inter replaced by Space Grotesk (UI/labels) + IBM Plex Sans (body), JetBrains Mono retained for code; Inter kept as fallback
- `xeneon-edge.css` linked: scanline overlay and shared components available
- `size-loader.js` linked: M/L/XL URL param support
- Token block expanded: added `--surface-h`, `--overlay-10/15`, `--tr-b`, `--font-h/b/m`, `--accent-d/b/glow`; purple AI accent `#a78bfa` preserved

### Changed - Spotify Visualizer
- Fonts: same Inter → Space Grotesk + IBM Plex Sans migration
- `xeneon-edge.css` + `size-loader.js` linked
- Token block expanded: added `--surface-h`, `--overlay-10/15`, `--tr-b`, `--font-h/b/m`, `--accent-d/b/glow`; Spotify green `#1DB954` preserved across dark/light/blur themes
- Blur theme tokens refined: `--text-2/3` use rgba for better legibility over album art

### Changed - ISS Horizon
- Fonts: Inter → Space Grotesk (UI) + JetBrains Mono; added IBM Plex Sans to Google Fonts import
- `xeneon-edge.css` linked; iCUE body-class size system (`sz-m/l/xl`) unchanged
- Inline `:root` refactored as a token bridge: `--bg-base`, `--text-main/dim/muted`, `--border-subtle/focus`, `--font-ui`, `--font-mono`, `--transition` now reference xeneon-edge tokens
- `--accent-blue` updated to Xeneon cyan `#00c8ff` for map/telemetry highlights; `--accent-nasa` `#fc3d21` retained for live indicators

### Removed
- **News Radar**, **Claude Usage**, **Conflict Tracker**: removed from active widget set and documentation

---

## [1.1.0] - 2026-04-04

### Fixed - Security
- Replace all `innerHTML` assignments with safe DOM methods (`createElement` / `textContent`) in `conflict-tracker`, eliminates XSS vectors
- Modernize clipboard API in `quick-clipboard`: use `navigator.clipboard` with `execCommand` fallback

### Fixed - Memory leaks
- `posture-reminder`: `clearInterval` on reset + extracted `startTimer()` to prevent timer accumulation

### Fixed - Bugs
- `habit-tracker`: remove double render on init
- `pomodoro`, `hydration`, `notes`: deduplicate storage event listeners (were registered twice on init)
- `posture-reminder`: add missing toast element, styles, and `showToast()` function
- `conflict-tracker`: remove `console.log` calls from production code

### Improved - Accessibility
- `conflict-tracker` tags: add `role="button"`, `tabIndex`, `Enter`/`Space` keyboard support
- `posture-reminder` action button: add `aria-label`

---

## [1.0.0] - 2026-02-28

### Added - Widgets
- **AI Assistant**: Claude-powered chat widget with streaming support
- **Claude Usage** (Alpha): Monitor Anthropic API token usage
- **Conflict Tracker** (Alpha): Track and visualize active conflicts worldwide
- **ISS Horizon**: Real-time ISS position tracking with horizon map
- **News Radar**: Aggregated news feed with category filters
- **Spotify Visualizer**: Live playback visualizer via Spotify OAuth

### Added - Productivity suite
- **Pomodoro**: Focus/break timer with SVG ring display
- **Timer**: Named phases, multiple display modes (ring / digital), Web Audio beeps
- **Daily Focus**: Single daily goal tracker
- **Habit Tracker**: Daily habit check-in with streak counters
- **Hydration**: Water intake reminder and tracker
- **Notes**: Lightweight persistent notepad
- **Quick Clipboard**: Fast clipboard snippets manager
- **Posture Reminder**: Interval-based posture alert
- **Budget**: Simple income/expense tracker

### Added - Infrastructure
- `theme-loader.js`: Flash-of-unstyled-content prevention (reads `pa_theme` from localStorage before render)
- Shared design system: CSS tokens, dark/light themes, toast notifications, grid scanline effect
- SVG assets: Claude, Anthropic, AI Studio logos
- MIT License
