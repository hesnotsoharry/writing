---
status: PLANNED
created: 2026-06-05
---

# Wave 27: story-planning-batch

## Plan

### Status

PLANNED · target v0.6.0 · drafted 2026-06-05

### Goal

After this wave the app gains six new production features and one updated
feature: the Goals panel shows per-type adaptive editors + a calendar heat-map
+ a pace bar; a Version History overlay lets users snapshot and restore any
scene; the corkboard view gains an Outliner sibling with color-label support;
Full Entry gains typed relationship edges and a local ego-graph; the Story
Bible grows beyond characters/locations to Items, Factions, Lore, Themes, and
custom types with a tiered layout; a project-wide Find & Replace overlay lets
users search and replace across all scenes with Undo; focus mode gains
typewriter scroll, paragraph dimming, a fading HUD, and a session timer; and
known Story-Bible entity names auto-link in the prose surface with a hover
peek. All design-reference specs and integration contracts are the source of
truth; no new architectural patterns are introduced.

### Scope

**In scope:**

- **Phase 1 — Goals redesign** (`src/features/goals/Goals.tsx`,
  `src/features/goals/InspectorGoalRings.tsx`, `src/features/goals/goalTypes.ts`,
  `src/features/goals/goalModel.ts`): type-adaptive editor UI (deadline → date
  picker + pace bar, time → minutes/day, wordcount → words/day); calendar
  heat-map of daily progress; pace bar on deadline goals. Canon: `design-reference/dialogs.jsx`
  Goals section + `GOALS-SPEC.md`.

- **Phase 2 — Snapshots / version history** (`src/db/snapshotStore.ts`,
  `src/db/sqliteSnapshotStore.ts`, `src/db/inMemorySnapshotStore.ts`,
  `src/storybible/VersionHistory.tsx`, `src/inspector/HistoryRail.tsx`,
  `src/lib/diffWords.ts`, new migration `scene_snapshots`): full overlay with
  word-level diff, HistoryRail in inspector, take/rename/restore/delete snapshots.
  Canon: `design-reference/snapshots.jsx` + `SNAPSHOTS-SPEC.md`.

- **Phase 3 — Outliner + color labels** (`src/features/outliner/Outliner.tsx`,
  `src/features/outliner/LabelBadges.tsx`, `src/features/outliner/LabelManager.tsx`,
  `src/db/labelStore.ts`, `src/db/sqliteLabelStore.ts`, new migrations `labels` +
  `scene_labels`, update `src/styles/tokens.css` with `--label-*` palette, update
  `App.state.ts` to add `AppView.outline`, update `shell.jsx` planning header with
  toggle): sortable table view, inline-edit cells, multi-label assignment per scene,
  curated 8-hue palette. Canon: `design-reference/outliner.jsx` + `outliner.css` +
  `OUTLINER-SPEC.md`.

- **Phase 4 — Relationships** (`src/storybible/fullEntry/RelationshipGroup.tsx`,
  `src/storybible/fullEntry/EgoGraph.tsx`, `src/storybible/RelationshipMap.tsx`,
  extend `src/db/storyBibleStore.ts` + `src/db/sqliteStoryBibleStore.ts` with
  relation CRUD, new migration `entity_relations`): typed directed edges,
  reciprocal-suggest, ego-graph on Full Entry, full relationship map view (using
  `d3-force` in prod, replacing the prototype's hand-rolled layout). Canon:
  `design-reference/relmap.jsx` + `RELATIONSHIPS-SPEC.md`.

- **Phase 5 — Entity types expansion** (extend `src/storybible/fullEntry/defs.ts`,
  `src/db/storyBibleStore.ts`, `src/storybible/StoryBibleView.tsx`,
  `src/storybible/fullEntry/FullEntry.tsx`, `src/lib/detection.ts`,
  new `src/storybible/CustomTypeCreator.tsx`, new migration `entity_types_custom`):
  Items, Factions, Lore, Themes + custom types; tiered Bible layout; ThemeTracker
  widget; auto-detection patterns for new types. Canon: `design-reference/customtype.jsx` +
  `design-reference/views.jsx` + `ENTITY-TYPES-SPEC.md`.

- **Phase 6 — Find & Replace overlay** (`src/features/findreplace/FindReplace.tsx`,
  `src/db/manuscriptSearchStore.ts`, wire `Cmd+Shift+H` in `TitleBar.tsx` or
  `App.tsx`): project-wide search/replace across all scene Yjs docs, grouped by
  chapter, replace-one/replace-all + preview + Undo toast. Canon:
  `design-reference/findreplace.jsx` + `FIND-FOCUS-SPEC.md` §5a.

- **Phase 7 — Focus / composition mode enhancements** (`src/features/corkboard/FocusMode.tsx`
  or new `src/features/focus/FocusMode.tsx`, `src/styles/app.css` focus-mode
  additions): typewriter scroll (CSS + JS), paragraph dimming, fading HUD (word
  count + active goal), optional session timer; layered around the frozen editor.
  Canon: `design-reference/canvas.jsx` FocusHud section + `FIND-FOCUS-SPEC.md` §5b.

- **Phase 8 — Auto-linking Story Bible names** (`src/editor/extensions/AutoLink.ts`
  or decorator pattern, `src/lib/alBuildIndex.ts`, `src/storybible/AutoLinkPeek.tsx`):
  read-only TipTap decoration that matches entity names in prose and renders a hover
  peek popup; case-aware; respects autolink on/off/style/scope/types settings.
  Canon: `design-reference/autolink.jsx` + `AUTOLINK-SPEC.md`.

**Out of scope:**

- **Backup / R2 sync** — separate infrastructure wave; untouched.
- **Mobile / Phase 2 live sync** — explicitly Phase 2 scope per ADR
  `roadmap/decisions/0001-local-first-architecture.md`.
- **Typewriter scrolling for F&R prose-search** — requires real TipTap position
  API; deferred per `FIND-FOCUS-SPEC.md` ("port-side only").
- **F&R over body prose** — same constraint; overlay searches plaintext only, not
  rich TipTap ranges.
- **Relationship map force layout → real physics** — Phase 4 uses `d3-force` in
  prod; the "real physics" polish (collision avoidance, clustering) is stretch.
- **Goals' "themes" goal type** — not in the current spec; out of scope.
- **WorkTree cleanup (lanes 18–24)** — parked follow-up; not touched here.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Goals redesign: adaptive editors + calendar + pace bar | sonnet-implementer | trophy · internal-only · reviewTier single. Update existing `features/goals/` — type-adaptive editor UI per goal type (deadline → date picker + pace bar; time → minutes/day input; wordcount → words/day input), calendar heat-map of daily progress in the Goals dialog, pace bar widget for deadline goals. Read `GOALS-SPEC.md` + current `Goals.tsx` + `InspectorGoalRings.tsx` before touching code. Constraint: no `setState` in `useEffect` (key-remount). | Open Goals dialog → a deadline goal shows a date-picker + pace bar; a time goal shows a minutes-per-day input; the Goals dialog shows a calendar heat-map of daily progress marks. |
| 2 | Snapshots: store + VersionHistory overlay + HistoryRail | sonnet-implementer | trophy · cross-boundary (new SQLite table + new store) · reviewTier panel. New `snapshotStore` interface + SQLite + inMemory impls; new migration `scene_snapshots(id, scene_id, label, state_base64 TEXT, word_count INT, created_at INT, kind TEXT)`; `VersionHistory` overlay with inline `diffWords` util; `HistoryRail` inspector section. Base64 TEXT only (no BLOB — CLAUDE.md gotcha). Run full test suite after migration. Research word-diff library (diff-match-patch vs jsdiff) before implementing `diffWords`. Canon: `snapshots.jsx` + `SNAPSHOTS-SPEC.md`. | Right-clicking a scene → "Take Snapshot" creates a row; opening Version History shows a list with timestamps; selecting a snapshot shows added (green underline) / removed (strikethrough) words vs. current; clicking Restore replaces the scene's Yjs doc state with the snapshot's base64. |
| 3 | Outliner view + color labels + palette tokens | sonnet-implementer | trophy · cross-boundary (2 new tables + new `AppView` value) · reviewTier panel. Add `--label-*` palette (8 hues: clay/sea/moss/plum/gold/slate/rose/ink, solid + tint) to `tokens.css`; new `labelStore` + migrations `labels(id, project_id, name, color TEXT, sort INT)` + `scene_labels(scene_id, label_id)`; `Outliner` component + `LabelBadges` + `LabelManager`; `AppView.outline` + planning toggle (corkboard ⇄ outliner). Reorder reuses existing binder move op. Run full test suite after migrations. Canon: `outliner.jsx` + `outliner.css` + `OUTLINER-SPEC.md`. | Clicking the "Outliner" toggle in the planning header switches the corkboard to a sortable table of scenes; scenes show color-label dot badges; right-clicking a scene row offers "Labels ▸" submenu for assignment; opening Label Manager allows renaming and recoloring. |
| 4 | Relationships: edges + ego-graph + map view | sonnet-implementer | trophy · cross-boundary (new table + new `AppView`) · reviewTier panel. Extend `storyBibleStore` with relation CRUD; migration `entity_relations(id, project_id, from_entity, to_entity, relation_label TEXT, reciprocal_id TEXT NULL, created_at INT)`; `RelationshipGroup` on FullEntry; `EgoGraph` inline; `RelationshipMap` full view (d3-force — research the d3-force API; it is a new dep). Phase scopes to existing types (character/location); uses `EntityType = string` for forward-compat with Phase 5. Run full test suite after migration. Canon: `relmap.jsx` + `RELATIONSHIPS-SPEC.md`. | Opening a character's Full Entry shows a Relationships section with typed edges and an ego-graph; clicking "+ Add Relation" lets you pick an entity and a preset label with a reciprocal suggestion; opening the Relationship Map view from the Story Bible header shows entities as force-positioned nodes with labelled edges. |
| 5 | Entity types expansion: Items/Factions/Lore/Themes/Custom | sonnet-implementer | trophy · cross-boundary (new table + widened EntityType) · reviewTier panel. Extend `defs.ts` with Items/Factions/Lore/Themes defaults; migration `entity_types_custom(id, project_id, name, icon, color, fields_json TEXT, sections_json TEXT)`; `CustomTypeCreator` modal; rewrite `StoryBibleView` to tiered layout (people&groups / world&lore / themes / custom); extend `detection.ts` for new types; ThemeTracker widget for Theme entries. Run full test suite after migration. Canon: `customtype.jsx` + `views.jsx` + `ENTITY-TYPES-SPEC.md`. | Story Bible view shows four collapsible tiers; "+ New Item / Faction / Lore / Theme" buttons each open a full-entry template with type-appropriate default facts; "New custom type" opens the creator modal; custom types appear as a new tier; Theme full-entries show the ThemeTracker "where it surfaces" widget. |
| 6 | Find & Replace overlay | sonnet-implementer | trophy · internal-only (reads/writes existing `scene_docs`) · reviewTier single. New `manuscriptSearchStore` (search across all scene Yjs docs, extract plaintext from base64 state, group matches by chapter/scene); `FindReplace` overlay; `Cmd+Shift+H` keyboard shortcut in TitleBar. Replace-all auto-snapshots each touched scene first (ties into Phase 2 snapshotStore) for Undo. No new table. Canon: `findreplace.jsx` + `FIND-FOCUS-SPEC.md` §5a. | Pressing Cmd+Shift+H opens the Find & Replace overlay; typing "the" finds all matches across all scenes grouped by chapter with a count; Replace All replaces them and shows a toast "Replaced N in M scenes — Undo"; pressing Undo restores the original prose in each touched scene. |
| 7 | Focus/composition mode enhancements | sonnet-implementer | trophy · internal-only · reviewTier single. Extend existing focus mode: typewriter scroll (keep cursor line vertically centred via scroll offset — CSS scroll-padding + JS scroll-into-view); paragraph dimming (`.focus-mode` siblings dimmed via sibling selectors); fading HUD (word count + primary goal, fades on `mousestop`); session timer (display only, optional). Layered around the frozen editor — no editor-core changes. Settings popover for per-option toggles. Canon: `canvas.jsx` FocusHud + `FIND-FOCUS-SPEC.md` §5b. | Entering focus mode then typing dims all paragraphs except the one containing the cursor; the cursor line stays vertically centered as you type past the midpoint; a fading HUD in the corner shows word count + active goal name and fades out after ~2 s of inactivity. |
| 8 | Auto-linking Story Bible names in prose | sonnet-implementer | trophy · internal-only (decoration layer, no doc writes) · reviewTier single. Research TipTap decoration/ProseMirror Plugin API before implementing. `alBuildIndex` (case-aware trie/map from entity names → entity IDs + types); TipTap extension (or ProseMirror plugin) that decorates matching spans as `AutoLink`; `AutoLinkPeek` hover tooltip; controlled by `autolink` / `autolinkStyle` / `autolinkScope` / `autolinkTypes` settings. Editor is READ-ONLY in this phase — no doc mutations, no editing behavior change. Canon: `autolink.jsx` + `AUTOLINK-SPEC.md`. | Opening a scene containing a character's name (e.g. "Maren") shows the name subtly underlined; hovering it shows a peek popup with the entity's portrait, name, and one-line description, plus a "Open entry" link; toggling autolink off in Settings removes the decorations. |

### Acceptance criteria

- [ ] **(P1 Goals)** Deadline goal editor shows a target-date picker and a pace-bar showing projected vs. required daily words; time goal shows minutes/day input; wordcount goal shows words/day input (all type-adaptive). Goals dialog shows a calendar heat-map with daily progress marks.
- [ ] **(P2 Snapshots)** Right-click a scene → "Take Snapshot" → row appears in Version History with timestamp and word count. Word diff in the overlay highlights added (green) and removed (struck) text vs. current state. Restore writes the snapshot base64 back into the scene doc (verified by switching away and back — prose matches the snapshot). Auto-snapshot taken before Restore as safety net. `scene_snapshots` migration runs clean; full suite passes after migration.
- [ ] **(P3 Outliner)** "Outliner" toggle in the planning view header switches to a table with title/synopsis/status/words/labels columns; clicking a column header sorts; inline title and synopsis are editable; color-label dot badges render on rows; "Labels ▸" context-menu submenu assigns/unassigns labels; LabelManager overlay allows renaming and palette-color selection. `--label-clay` … `--label-ink` tokens present in `tokens.css`. `labels` + `scene_labels` migrations run clean; full suite passes after migrations.
- [ ] **(P4 Relationships)** Full Entry shows a Relationships section (typed edges); adding a relation shows a reciprocal-label suggestion; edges render with the correct inverse label (e.g., "parent of" ↔ "child of"); EgoGraph renders inline (entity + neighbours); Relationship Map view shows all entities as nodes with labelled edges. `entity_relations` migration runs clean; full suite passes after migration.
- [ ] **(P5 Entity types)** StoryBibleView renders four tiers; "+ New Item/Faction/Lore/Theme" each open correctly-seeded full-entry templates (correct default fact fields + sections per type); Custom Type Creator produces a new tier; Theme full-entries show ThemeTracker. `entity_types_custom` migration runs clean; full suite passes after migration.
- [ ] **(P6 Find & Replace)** `Cmd+Shift+H` opens the overlay; search results are grouped by chapter/scene with counts; clicking a match opens that scene; Replace All applies the replacement to all matching Yjs docs, shows a toast with count, and the Undo action restores the originals.
- [ ] **(P7 Focus mode)** Focus mode with "Typewriter scroll" enabled keeps the active line vertically centred; "Dim paragraphs" enabled fades all paragraphs except the cursor's; the HUD is visible on motion and fades after ~2 s; "Session timer" enabled shows an elapsed clock. `prefers-reduced-motion` disables the typewriter scroll animation.
- [ ] **(P8 Auto-linking)** Entity names in prose are decorated (subtle underline or style per `autolinkStyle`); hovering shows the peek popup with entity portrait + name + description + "Open entry" link; toggling `autolink: false` in Settings removes all decorations; auto-linking is read-only (no doc mutations on decorating or on any interaction except "Open entry" which navigates).
- [ ] `npm run lint`, `npx tsc --noEmit`, and `npm run test` (full suite) pass at wave end.

### Files the next agent should read first

1. `design-reference/BATCH-HANDOFF.md` — the cross-feature map: what changed in each design-reference file, the consolidated schema/store to-do, per-feature spec index.
2. `design-reference/FEATURE-WAVE-PLAN.md` — integration contracts (typed props, callbacks, store methods, view states, mount points) for all 5 new features.
3. `design-reference/GOALS-SPEC.md` — Goals redesign spec (Phase 1).
4. `design-reference/SNAPSHOTS-SPEC.md` — Snapshots spec with `Snapshot` type + `VersionHistoryProps` (Phase 2).
5. `design-reference/OUTLINER-SPEC.md` + `design-reference/outliner.jsx` + `design-reference/outliner.css` (Phase 3).
6. `design-reference/RELATIONSHIPS-SPEC.md` + `design-reference/relmap.jsx` (Phase 4).
7. `design-reference/ENTITY-TYPES-SPEC.md` (Phase 5).
8. `design-reference/FIND-FOCUS-SPEC.md` (Phases 6 + 7).
9. `design-reference/AUTOLINK-SPEC.md` + `design-reference/autolink.jsx` (Phase 8).
10. `src/features/goals/` (all 6 files) — baseline for Phase 1 delta.
11. `roadmap/decisions/0001-local-first-architecture.md` — the locked stack (Tauri/TipTap/Yjs/SQLite); no sync infra this wave.

### Note to the implementer

This wave ports a complete design-reference batch into production. The spirit is: the design work is done — match it faithfully. Resist the temptation to simplify algorithms (the `diffWords` util should produce real word-level diffs, not line diffs) or defer integrations (Phase 6's replace-all MUST auto-snapshot each touched scene via the Phase 2 snapshotStore — that's the Undo guarantee).

**Migration breakage gotcha (critical):** every phase that adds a new SQLite table (Phases 2, 3, 4, 5) MUST run the full test suite (`npm run test`) after the migration is added, before any component work. The project's memory records that appending a migration silently breaks prior migration tests due to hardcoded LATEST + partial seed fixtures. Catch it at the phase gate, not at wave-end.

**Editor frozen = additive only:** Phase 8 adds a read-only decoration/plugin layer. It never writes to the Yjs doc and never changes the editing keybindings, schema, or document model. "Frozen" means the editing surface is unchanged; it does not mean zero TipTap code.

**Phase 4 entity types:** Phase 4 (Relationships) lands before Phase 5 (Entity types). Use `EntityType = string` (already widened per FEATURE-WAVE-PLAN.md) so Phase 4's relation edges work with character/location now and silently accept new types when Phase 5 lands. Do not hard-code `"character" | "location"` enums in Phase 4.

**Research triggers (before implementing, not after):** Phase 2 — pick a word-diff library (diff-match-patch is battle-tested; check version and API before writing `diffWords`). Phase 4 — verify `d3-force` API before writing the RelationshipMap (it is a new dep; add to `package.json`). Phase 8 — read the TipTap Decorations/ProseMirror Plugin API docs before writing the auto-link extension.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live Tauri dev server, no tauri-devtools MCP connection, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient. The app has a working CDP smoke path (`npm run tauri dev` → tauri-devtools MCP on port 9222) — use it for UI-bearing phases.

## Locked decisions

> Before any decision is written here it must pass the decision-review cell: `sonnet-architect` produces it, a `sonnet-adversarial-reviewer` with `Posture: attack-decision` clears it, the orchestrator adjudicates — THEN it is appended. Trivial decisions skip via the `review-tier-{session_id}.json` sidecar.

*No decisions locked yet — appended as wave progresses.*

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point |
|---|---|---|---|---|
| 1 | 2026-06-05 | 2026-06-05 | a0de71d | Goals dialog verified via gate suite; runtime observation deferred (CDP smoke in a later phase) |
| 2 | 2026-06-05 | 2026-06-05 | b6d084a | Panel FLAG addressed (initial diff load, async onCapture auto-select, interface doc); gates re-verified clean |
| 3 | — | — | — | — |
| 4 | — | — | — | — |
| 5 | — | — | — | — |
| 6 | — | — | — | — |
| 7 | — | — | — | — |
| 8 | — | — | — | — |

## Follow-up candidates

<!-- DEFAULT: empty. Tier-3 triple-gate only. Most mid-wave friction is fixed inline.
     Format when used: - [item]: [why it cannot be done in-wave] | present-harm: [K1/K2/K3 pointer] -->

## Result

<!-- Filled at ship by wrap team -->
