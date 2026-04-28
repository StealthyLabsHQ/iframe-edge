# Changelog

All notable changes to **iframe-edge** are documented here.

---

## [Unreleased]

### Added - Widget polish layer
- `widget-polish.css`: shared Huashu design finish layer for active widgets, with compact icon-only headers, tighter controls, restrained 8px surfaces, improved borders, focus states, and less title-heavy UI.
- `scripts/package-icuewidgets.ps1`: validates and builds active widgets into `dist/icuewidgets/*.icuewidget`.

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
