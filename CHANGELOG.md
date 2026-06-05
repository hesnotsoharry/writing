# Changelog

## [0.2.0] — 2026-06-05 · Wave 27: story-planning-batch

### Added
- **Goals redesign** — type-adaptive editors (deadline → date picker + pace bar; time → minutes/day; wordcount → words/day); calendar heat-map of daily progress
- **Snapshots / version history** — take/rename/restore/delete scene snapshots; word-level diff overlay; HistoryRail inspector section; auto-snapshot before replace-all
- **Outliner + color labels** — sortable table view of scenes with inline editing; 8-hue color-label system with LabelManager; `--label-*` design tokens
- **Relationships** — typed directed edges between Story Bible entities; reciprocal-label suggestions; inline ego-graph on Full Entry; full Relationship Map view (d3-force layout)
- **Entity types expansion** — Items, Factions, Lore, Themes, and Custom types; Custom Type Creator; tiered Story Bible layout; ThemeTracker widget for theme entries
- **Find & Replace overlay** (`Cmd+Shift+H`) — project-wide search and replace across all scene Yjs docs, grouped by chapter; replace-all with Undo (restores original prose via auto-snapshot)
- **Focus mode enhancements** — typewriter scroll (cursor line stays vertically centred), paragraph dimming, fading HUD with active goal + word count, session timer; per-option settings toggles
- **Auto-linking Story Bible names in prose** — read-only TipTap decoration marks entity names in scenes; hover shows peek popup with portrait, name, description, and "Open entry" link

## [0.1.0] — 2026-06-03 · Wave 26: screen-port-batch

Initial Tauri 2 + React 19 + TipTap + Yjs + SQLite desktop app. Binder, scene editor, Story Bible (characters + locations), corkboard, Goals panel, Focus mode, Inspector.
