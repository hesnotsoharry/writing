# Batch handoff — the story-planning feature wave (Jun 2026)

**For the porting/terminal agents.** This is the single "what changed, where, and
why" map for this batch so you're not diffing blind. It sits above the per-feature
specs — read this first, then the relevant `*-SPEC.md`.

- **What this batch did:** added **Goals** (redesigned) + a **five-feature wave**
  to the canon prototype `writing-app-design/index.html`: Snapshots/version
  history · Corkboard outliner + color labels · Story-bible relationships · more
  entity types · project-wide find&replace + focus/composition mode. Everything
  is built and verified in the prototype; nothing here is production code.
- **The canon is `writing-app-design/index.html`.** Open it first.
- **Each feature has a spec** with its integration contract (typed props,
  callbacks, store methods, new tables, view states, constraints, deferred work):
  `GOALS-SPEC.md`, `SNAPSHOTS-SPEC.md`, `OUTLINER-SPEC.md`,
  `RELATIONSHIPS-SPEC.md`, `ENTITY-TYPES-SPEC.md`, `FIND-FOCUS-SPEC.md`.
  `FEATURE-WAVE-PLAN.md` is the cross-feature index (one design language + the
  consolidated schema/store to-do + the shared palette tokens).

---

## Feature status (all in canon)

| Feature | Status | Spec |
|---|---|---|
| Goals (multi-goal, adaptive editor, per-type viz, manager) | full | `GOALS-SPEC.md` |
| Snapshots / version history | full | `SNAPSHOTS-SPEC.md` |
| Outliner + color labels | full | `OUTLINER-SPEC.md` |
| Relationships (presets, reciprocal, ego-graph, map) | full · **map reskinned Jun 2026 ("Cartographer's key")** | `RELATIONSHIPS-SPEC.md` (incl. porting checklist) |
| Entity types (tiered bible, Items/Factions/Lore/Themes, custom) | full | `ENTITY-TYPES-SPEC.md` |
| Find & replace + focus/composition | core | `FIND-FOCUS-SPEC.md` |

**Still port-side only** (can't be done in this prototype — flagged in specs):
typewriter scrolling + F&R over body **prose** (both need the real TipTap
surface, frozen here); the relationship **map's force layout → swap for
`d3-force`** in prod (see `RELATIONSHIPS-SPEC.md` "Port recommendation").

---

## New files this batch

**Components (`writing-app-design/*.jsx`)** — loaded via `<script type="text/babel">` in `index.html`:
| File | What |
|---|---|
| `snapshots.jsx` | Version history: `HistorySection` (inspector rail) + `VersionHistory` (overlay) + `diffWords` |
| `outliner.jsx` | `Outliner` table + `LabelManager` + label assignment popover |
| `findreplace.jsx` | `FindReplace` overlay + pure `frSearch`/`frRegex` |
| `relmap.jsx` | `RelationshipMap` + hand-rolled `frLayout` (force-directed; → `d3-force` in prod). **Visual overhaul Jun 2026** — chart frame, icon nodes, halo labels, map-key card; port checklist in `RELATIONSHIPS-SPEC.md` |
| `customtype.jsx` | `CustomTypeCreator` modal |

**Stylesheets (`writing-app-design/*.css`)** — linked in `index.html`:
`snapshots.css` · `outliner.css` · `relationships.css` · `entity-types.css` ·
`findfocus.css`. (All consume `tokens.css`; no hardcoded colors.)

**Specs (`writing-app-design/*.md`)**: `FEATURE-WAVE-PLAN.md`, `GOALS-SPEC.md`,
`SNAPSHOTS-SPEC.md`, `OUTLINER-SPEC.md`, `RELATIONSHIPS-SPEC.md`,
`ENTITY-TYPES-SPEC.md`, `FIND-FOCUS-SPEC.md`, and this file.

**Exploration canvases (project root, *design only — not canon*)**:
`Snapshots - explorations.html`, `Outliner - explorations.html`,
`Relationships - explorations.html`, `Entity types - explorations.html`,
`Find and focus - explorations.html`, and `Relationship map - dense example.html`
(a 30-node stress demo of the map — safe to delete; it's reference only).

---

## Modified files — what changed in each

- **`data.jsx`** — all new mock data + exported to `window`:
  - Goals: `GOAL_META`, `GOAL_ORDER`, `GOALS`, `goalProgress()`, `goalSummary()`.
  - Snapshots: `SNAPSHOTS_BY_SCENE`, `SCENE_CURRENT_TEXT`.
  - Labels: `LABELS`, `SCENE_LABELS`.
  - Entity types: `ITEMS`, `FACTIONS`, `LORE`, `THEMES`, `ENTITY_TYPE_DEFS`,
    `ENTITY_TIERS`, `THEME_SURFACES`.
- **`tokens.css`** — added the curated **`--label-*` palette** (8 hues: clay, sea,
  moss, plum, gold, slate, rose, ink), light + dark. **Shared by color-labels AND
  entity-type accents.** Stored by token name, never hex.
- **`app.css`** — new sections: goals (manager/editor/calendar/stepper/pace
  bar/streak), collapsible inspector caret (`.insp-label--toggle`/`.insp-caret`),
  **palette avatar classes** (`.avatar.<token>` / `.fe-av-lg.<token>`), planning
  wrapper (`.plan-wrap`/`.plan-body` for the corkboard⇄outliner switch).
- **`icons.jsx`** — added `camera` (snapshot capture), `box` (items), `flag`
  (factions), `globe` (lore).
- **`app.jsx`** — new state: `goals`, `snapshots`, `labels`, `sceneLabels`,
  `items`, `factions`, `lore`, `themes`, `customTypes`. New actions (all in the
  `actions` object): `saveGoal`/`deleteGoal`,
  `captureSnapshot`/`renameSnapshot`/`deleteSnapshot`/`restoreSnapshot`,
  `setSynopsis`, `toggleSceneLabel`/`renameLabel`/`setLabelColor`/`addLabel`,
  `replaceAll`, `relateReciprocal`, `createType`. (`replaceAll` is undoable via
  the existing `withUndo`.)
- **`shell.jsx`** — the wiring hub. New local state: `planMode` (board/table),
  `otlSort`, `histScene`, `goalsInit`, `focusOpts`, `focusSet`. Derived:
  `entityPool` (all bible entities, for entry lookup) + `bibleGroups`/`bibleTiers`.
  New **overlays**: `goals`, `history`, `labels`, `findreplace`, `newtype`. New
  **view**: `map`. Corkboard view now wraps a Corkboard⇄Outliner toggle + Labels
  button. `bibleHandlers` extended (`onOpenEntity`, `onAddEntity`, `onNewType`,
  `onOpenMap`). `<Canvas>` gets `focus`/`goals`/`focusOpts`; `<Inspector>` gets
  goals + snapshots props; `<FullEntry>` gets `onReciprocal`.
- **`chrome.jsx`** — `TitleBar` gained a **Find&replace** button and a per-scene
  **Version history** button; `StatusBar` reformatted to show the primary goal by
  family (ring / days-left / streak).
- **`inspector.jsx`** — added the **`InspGroup`** collapsible wrapper (persists
  open/closed per section in `localStorage`); goal cards (`GoalCard`/`GoalRing`/
  `PaceBar`/`StreakViz`); renders `HistorySection`. All inspector sections are now
  collapsible.
- **`canvas.jsx`** — `FocusHud` + `.focus-mode` paragraph dimming, gated by
  `focusOpts` (dim / hud / timer).
- **`views.jsx`** — `StoryBible` rewritten to a **tiered** layout (people&groups /
  world&lore / themes / custom) driven by `ENTITY_TYPE_DEFS`; added `bibColor`.
- **`entry.jsx`** — type-generic: `DEF_FIELDS`/`DEF_SECTIONS`/`SEED_KEY` now cover
  item/faction/lore/theme; `buildDetail` falls back to generic defs for unknown/
  custom types; `type = entity.type || entity.color`. Relationships upgraded:
  `REL_PRESETS` (now `{label, inv}`), `RelationMenu` preset picker, `FePersonCard`
  threads the inverse, `FeEgoGraph` (local graph), `relateReciprocal` wiring.
  Themes get `ThemeTracker` ("where it surfaces") instead of a text section.
- **`index.html`** — linked the 5 new CSS files; loaded the 5 new JSX files
  (order: after `dialogs.jsx`/`inspector.jsx`, before `shell.jsx`/`app.jsx`).

---

## Consolidated schema / store to-do (the port's new-table list)

| Feature | New table(s) | Store |
|---|---|---|
| Snapshots | `scene_snapshots` (state_base64 **TEXT**) | **new** `snapshotStore` |
| Labels | `labels`, `scene_labels` | extend `binderStore` / small `labelStore` |
| Relationships | `entity_relations` (directed + `reciprocal_id`) | extend `storyBibleStore` |
| Entity types | `entity_types_custom` | extend `storyBibleStore` + `defs.ts` |
| Find & replace | — (reads/writes `scene_docs`) | **new** `manuscriptSearchStore` |
| Focus mode | — | settings store |

Plus the **`--label-*` palette tokens** → copy into prod `tokens.css`.

Constraints honored throughout (per `CLAUDE.md`): no `setState` in `useEffect`
(state derived at render / key-remount / window listeners), no `any`, lane-boundary
props optional+guarded, base64 **TEXT** persistence, one Yjs doc per scene, editor
frozen (snapshots/F&R/focus layer around it), primitives reused (`Icon`,
`ContextMenu`, `RenameInput`, `Toast`, theme vars).

---

## Verification

Each feature was screenshot/`eval`-verified in canon and most passed a forked
verifier sweep (the find&replace + focus sweep confirmed live: "the" → 35 matches
in 14 scenes, replace-all mutates + undoes; focus HUD/dimming render). No console
errors beyond the expected in-browser Babel dev warning.
