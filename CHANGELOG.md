# Changelog

## [0.2.1] — 2026-06-08 · Wave 28: story-planning salvage

Fix-sweep bringing the eight Wave 27 story-planning features to spec, each verified live in a CDP smoke.

### Fixed
- **Find & Replace** — format-preserving replacement (keeps bold/italic marks of both the surrounding prose and the replaced span); removed the replace-all self-undo; the currently-open scene's editor now live-refreshes after a replace-all and on undo.
- **Snapshots** — version-history overlay renders fully styled (word-diff + legend); HistoryRail tracks the active scene; binder context-menu "Take snapshot" now refreshes the rail.
- **Entity types** — correct field labels, icons, accents, and tiers; neutral generic-entity avatar for new/custom types.
- **Relationships** — exactly one relationships section per Full Entry (dropped the duplicate PeopleGroup block); per-type relation presets; Relationship Map reflects edited edge labels.
- **Outliner & color labels** — corkboard cards show tinted label pills (static tint tokens); label reorder; per-project label cap.
- **Goals** — inspector goal right-click menu (edit / manage all / delete); real manuscript word count; single consolidated goal-ring; goal create / edit / delete now persist and refresh the inspector.
- **Focus mode** — rewritten as a ProseMirror extension, fixing a runtime scroll loop and enabling active-paragraph dimming.
- **Auto-link** — live settings toggle (scope + per-type), 1.5px underline, right-click context menu, and a "Find mentions" peek.

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
