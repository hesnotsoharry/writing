# Feature-wave plan — snapshots + story-planning depth

**Status:** planning / rough first pass. This is the connective doc for five
additions to the shipping app. It resolves the open design decisions, defines one
shared visual + interaction language for all five, and gives each feature an
**integration contract** (props in · callbacks out · store methods · view states
· mount point · schema flags) so the terminal-agent port wires data without
redesigning seams.

Read alongside: `README.md`, `GOALS-SPEC.md`, `FULL-ENTRY-SPEC.md`,
`HANDOFF.md`. Per-feature specs (e.g. `SNAPSHOTS-SPEC.md`) get written as each
feature is built; this doc is the index + the parts that are shared.

> **Scope note (from the user):** this is a *rough, line-it-all-up* pass — get
> the structure and seams in place across all five, refine in later sessions.
> We're **adding onto** the existing product, not redesigning it.

---

## Honored constraints (apply to every component here)

These come from the production `CLAUDE.md` and are non-negotiable; the prototype
already follows the spirit of them and the contracts below are written to keep
them true after the port.

1. **No `setState` in `useEffect`.** Reset child state from an external trigger
   via the **key-remount** pattern (`key={id}`/`version` counter), mirroring
   `EntityRowName` / the prototype's `key={activeId}` on `Canvas`.
2. **No `any`.** Every prop/callback below is typed.
3. **Lane-boundary props are optional + guarded** (`onExport?` / `onAddGoal?`
   pattern). Anything a new component asks an existing parent (App / a view) to
   pass is `?:` with a safe fallback — never required.
4. **Persistence is base64 TEXT.** Snapshots store the *same* `encodeDoc →
   base64` text as `scene_docs.state_base64`. No BLOB columns.
5. **One Yjs doc per scene.** Nothing here merges scenes into one doc.
6. **Editor (`src/editor/`) is frozen** — additive only. Focus mode and
   find/replace layer *around* it (overlays + header affordances).
7. **Reuse primitives:** `Icon`, `ContextMenu` (+ `buildSceneMenu` /
   `buildEntityMenu`), `Toast`, `RenameInput`, and theme vars
   (`--parchment-edge`, `--character`, `--location`, `--accent`, `--good`,
   `--warn`, radii/shadows). No hardcoded colors.

**Prototype ↔ production name map** (so the contracts read against both):

| Prototype (canon) | Production |
|---|---|
| `app.jsx` `view` state (`write`/`cork`/`bible`/`entry`) | `App.state.ts` `AppView` |
| `shell.jsx` overlay + context-menu construction | `App.tsx` parent views |
| `data.jsx` mock stores | `binderStore` / `storyBibleStore` / `sceneDocStore` / goals store |
| `menu.jsx` `ContextMenu`/`Toast`/`RenameInput` | `src/components/menu/*` |
| `treeops.jsx` | binder tree ops |

---

## Shared design language (decided once, used by all five)

- **Surface taxonomy.** We already have three surface types; new features pick
  the lightest one that fits:
  - **Inspector section** — lives in the right rail (`.insp-group`). For
    glanceable, scene-scoped info. *(Goals cards, synopsis.)*
  - **Overlay sheet** (`.scrim` + `.sheet`) — focused, modal task. *(Export,
    Archive, Goals manager.)* Used for **version history**, **find & replace**.
  - **Full view** — an `AppView` in the center stage with the binder/inspector
    hidden or repurposed. *(Corkboard, Story Bible, Full Entry.)* Used for the
    **outliner** and the **relationship map**.
- **Entry affordances are quiet.** Icon-only buttons in headers/title-bar
  (`.iconbtn`), promoted to labelled buttons only inside overlays. New global
  entry points go in the title-bar action cluster (`chrome.jsx .tb-actions`) or
  the relevant view header — never a loud new toolbar.
- **Right-click is the management verb.** Every new object (snapshot, label,
  relationship, entity) is created/edited/deleted from a `ContextMenu`, matching
  scenes/entities. Destructive items use `danger` + a `Toast` with **Undo**.
- **Curated color, never a free picker.** All color choices (labels, entity-type
  accents) come from a small **on-brand token palette** (below), chosen by the
  user's request to keep the app cohesive. No hex inputs anywhere.
- **Empty states are quiet prompts, not blank boxes** (the `.fe-placeholder`
  pattern): every data-backed surface enumerates empty / loading / populated /
  error.
- **Motion** respects `--motion` / `prefers-reduced-motion`; entrances reuse the
  `.insp-group` settle / `cm-in` keyframes.

### The brand label palette (shared by labels + entity types)

Eight calm, parchment-friendly hues defined as tokens in `tokens.css` (to add):
`--label-clay` (= accent), `--label-sea`, `--label-moss`, `--label-plum`,
`--label-gold`, `--label-slate`, `--label-rose`, `--label-ink`. Each has a solid
+ a `-tint` wash (mirroring `--character` / `--character-tint`). Stored as the
**token name** (`"sea"`), not a color value — so re-theming stays cohesive.

```ts
type LabelColor = "clay" | "sea" | "moss" | "plum" | "gold" | "slate" | "rose" | "ink";
```

---

## Feature 1 — Snapshots / version history  *(pre-launch, build first)*

**Direction.** A **Version-history overlay** (Google-Docs mental model): snapshot
list on the left, a read-only render of the selected snapshot on the right with
an **inline word-level diff vs. current** (added = `--good` underline/wash,
removed = struck `--danger`), and a guarded **Restore**. Plus a lightweight
**History rail** affordance for quick glances. Entry points: editor header
button + scene context menu. **Auto-capture is in scope** (on scene-close +
interval, toggle in settings) and is visually distinguished from manual saves.

**Component tree.**
- `VersionHistory` (overlay) → `SnapshotList` (`SnapshotRow` × n: label · relative
  time · word count · manual/auto glyph; right-click → Rename / Restore / Delete)
  · `SnapshotViewer` (`DiffView` with `Unchanged|Added|Removed` runs; toggle
  *Diff ↔ Clean*) · footer (`Restore this version` → confirm).
- `TakeSnapshot` affordance (header icon + menu item) → optional label via
  `RenameInput`.
- `HistoryRail` (inspector variant) — compact list, "See all" opens the overlay.

**Integration contract.**
```ts
interface Snapshot {
  id: string; sceneId: string; label: string | null;
  wordCount: number; createdAt: number; kind: "manual" | "auto";
}
interface VersionHistoryProps {
  sceneId: string;
  snapshots: Snapshot[];                 // store.list(sceneId)
  currentStateBase64: string;            // for the diff baseline
  loading?: boolean; error?: string | null;
  onRestore?: (snapshotId: string) => void;     // guarded confirm in parent
  onRename?: (snapshotId: string, label: string) => void;
  onDelete?: (snapshotId: string) => void;
  onCapture?: (label?: string) => void;
  onClose?: () => void;
}
```
- **New store — `snapshotStore`:** `capture(sceneId, label?) → Snapshot`,
  `list(sceneId) → Snapshot[]`, `get(snapshotId) → {meta, state_base64}`,
  `restore(sceneId, snapshotId) → void` (writes snapshot's base64 back into the
  scene's Yjs doc; **takes an auto-snapshot of current first** = the safety net),
  `delete(snapshotId)`, `pruneAuto(sceneId, keepN)`.
- **Diff** is computed in a pure util `diffWords(a, b)` over plain-text
  extracted from each doc (`docToPlainText(state_base64)`); the editor stays
  frozen.
- **New table** `scene_snapshots(id, scene_id, label, state_base64 TEXT,
  word_count INT, created_at INT, kind TEXT)`. Base64 TEXT — constraint #4.
- **View states:** loading (skeleton rows) · empty ("No versions yet — take one
  to start a history") · populated · restoring (disable + spinner) · error.
- **Mount:** overlay opened from editor header / scene context menu; rail is an
  `.insp-group` in the editor inspector. No new `AppView`.
- **Schema flag:** new table + new store. Auto-capture needs a settings flag
  `snapshots.autoEvery` + close-hook.

---

## Feature 2 — Corkboard outliner + color labels

**Decision (Jun 2026):** explored Direction A (dense sortable table) vs. B (roomy
list) in `Outliner - explorations.html`. **Picked A, tuned toward calm** (extra
row height + roomy synopsis column, hairline dividers, parchment header) — the
outliner's value is density/triage the corkboard doesn't offer; B is kept as the
documented low-density alternative. Curated 8-hue label palette + multiple
labels per scene confirmed.

**Direction.** A **sortable outliner table** as a sibling view to the corkboard
(view-switch in the planning header), fed by the same `buildTree` output.
**Inline-editable** cells (title, synopsis, status, labels), **sortable by any
column**, **drag-to-reorder** (reorder = binder order write). **Labels** are a
curated, renamable set from the brand palette (user controls the palette to stay
cohesive); **multiple labels per scene**; shown as small dot/pill badges on both
cards and rows. Label assignment via context menu (reuses `buildSceneMenu` with a
"Labels ▸" submenu of checkable swatches).

**Component tree.**
- View switch `Corkboard ⇄ Outliner` (segmented, in the planning header).
- `Outliner` → `OutlinerHeader` (sortable column buttons) · `OutlinerRow` ×
  scene (status dot · inline title `RenameInput` · inline synopsis · word count ·
  `LabelBadges`) · chapter group headers · drag handle.
- `LabelBadges` (dot/pill list) · `LabelMenu` (submenu in the scene context
  menu) · `LabelManager` (small overlay: rename labels, reorder, pick palette
  color — *not* create infinite labels; curated count).

**Integration contract.**
```ts
interface Label { id: string; name: string; color: LabelColor; sort: number; }
interface OutlinerProps {
  tree: BinderTree;                         // same buildTree output
  labels: Label[];
  sceneLabels: Record<string, string[]>;    // sceneId -> labelId[]
  sortBy?: OutlinerSort; renaming?: string | null;
  onOpenScene?: (id: string) => void;
  onRename?: (kind: "scene" | "chapter", id: string, title: string) => void;
  onSetStatus?: (sceneId: string, status: SceneStatus) => void;
  onSetSynopsis?: (sceneId: string, text: string) => void;
  onToggleLabel?: (sceneId: string, labelId: string) => void;
  onReorder?: (sceneId: string, toIndex: number, chapterId: string) => void;
  onSort?: (s: OutlinerSort) => void;
  onMenu?: (e, kind, payload) => void;
}
type OutlinerSort = { col: "title"|"status"|"words"|"label"|"manual"; dir: "asc"|"desc" };
```
- **Store — extend `binderStore`** (or a small `labelStore`): `listLabels()`,
  `renameLabel(id,name)`, `setLabelColor(id,color)`, `reorderLabels(ids)`;
  `assignLabel(sceneId,labelId)`, `unassignLabel(sceneId,labelId)`,
  `labelsForScene(sceneId)`. Reorder reuses the existing binder move op.
- **New tables** `labels(id, project_id, name, color TEXT, sort INT)` +
  `scene_labels(scene_id, label_id)` (composite PK; many-to-many = multiple per
  scene). Color = token name.
- **View states:** outliner empty (no scenes) · row with no synopsis/labels
  (quiet prompts) · sorting/reordering.
- **Mount:** new `AppView` value `outline` (prototype `view: "outline"`),
  rendered in the same center switch as `cork`; binder stays visible.
- **Schema flag:** two new tables; binder reorder write reused.

---

## Feature 3 — Story bible: relationships

**Direction.** Typed entity-to-entity edges with a **curated per-type preset
vocabulary + custom** label (family/ally/rival/member-of…). Edges are **directed
but auto-suggest the reciprocal with the correct inverse label** (parent-of ⇄
child-of; sibling ⇄ sibling; member-of ⇄ has-member). Surfaces: a
**relationship list on the Full Entry** (the existing "Relationships"/"Characters
here" group, upgraded from static text to real editable edges) + a **local
ego-graph** on the entry (this entity + its neighbours), and a **whole-project
relationship map** as its own view.

**Component tree.**
- `RelationshipGroup` (on Full Entry) → `RelationRow` (avatar · name · relation
  label · right-click Edit/Delete) · `AddRelation` → `RelationPicker` (search
  entity) + `RelationLabelPicker` (preset chips per type + custom field) +
  reciprocal toggle.
- `EgoGraph` (inline on the entry) — the entity centred, neighbours as nodes,
  edges labelled; click a node = open that entry.
- `RelationshipMap` (full view) — force/radial layout of all entities, filter by
  type, click to open.

**Integration contract.**
```ts
interface Relation {
  id: string; fromEntity: string; toEntity: string;
  label: string; reciprocalId?: string | null; createdAt: number;
}
interface RelationshipGroupProps {
  entityId: string; entityType: EntityType;
  relations: Relation[]; entities: EntityRef[];     // for picker + names
  presets: string[];                                // RELATION_PRESETS[type]
  onAdd?: (toEntity: string, label: string, reciprocalLabel?: string) => void;
  onEdit?: (relationId: string, label: string) => void;
  onDelete?: (relationId: string) => void;
  onOpenEntity?: (id: string) => void;
}
```
- **Store — extend `storyBibleStore`:** `addRelation(from,to,label,{reciprocal})`,
  `listRelations(entityId)`, `editRelation(id,label)`, `deleteRelation(id)`
  (cascades the reciprocal), `allRelations()` (for the map).
- **New table** `entity_relations(id, project_id, from_entity, to_entity,
  relation_label TEXT, reciprocal_id TEXT NULL, created_at INT)`.
- **Presets** `RELATION_PRESETS: Record<EntityType, {label, inverse}[]>` in
  `storybible` defs (e.g. character: sibling↔sibling, parent↔child, ally↔ally,
  rival↔rival; faction: member↔has-member).
- **View states:** no relations (quiet prompt) · picker open · graph empty (1
  node) · map loading/empty.
- **Mount:** group + ego-graph render inside `entry.jsx` (Full Entry); map = new
  `AppView` `map` reachable from the Story Bible header.
- **Schema flag:** new table; map view added.

---

## Feature 4 — Story bible: more entity types

**Direction.** Add **Items/Objects, Factions/Organizations, Lore/Worldbuilding,
Themes**, plus a **custom-type path**. The model already generalizes
(`EntityType` + `DEF_FIELDS`/`DEF_SECTIONS`/`SEED_KEY` in
`storybible/fullEntry/defs.ts`); we **extend, not replace**. Each type gets a
brand-palette accent + an `Icon`, sensible default facts + prose sections, and
columns/sections in `StoryBibleView`. Auto-detection (`lib/detection.ts`)
extends to the new types.

**Per-type defaults (proposed — refine later).**
| Type | Icon | Accent | Default facts | Default sections |
|---|---|---|---|---|
| Item / Object | `feather`* | gold | Kind, Owner, Status, First appears | Description, Significance, History |
| Faction / Org | `users` | plum | Type, Leader, Seat, Allegiance | Purpose, Structure, History, Conflicts |
| Lore / World | `sparkle` | sea | Domain, Status, First appears | Overview, Rules, History |
| Theme | `quote` | rose | Motif, Status | Statement, Where it surfaces, Evolution |
| Custom | user-picked | user-picked | user-defined | user-defined |

\* add a dedicated item glyph to `icons.jsx`.

**Integration contract.**
```ts
type EntityType = "character" | "location" | "item" | "faction" | "lore" | "theme" | string;
interface EntityTypeDef {
  type: EntityType; label: string; icon: string; color: LabelColor;
  facts: { key: string; label: string }[];
  sections: { key: string; icon: string; label: string }[];
  seedKey: string; isCustom?: boolean;
}
interface NewTypeProps {                 // the custom-type creator
  onCreate?: (def: Omit<EntityTypeDef, "seedKey">) => void;
}
```
- **Store — extend `storyBibleStore`:** generalize entity CRUD over `EntityType`
  (already kind-based); `listTypes()`, `createCustomType(def)`. `DEF_FIELDS` /
  `DEF_SECTIONS` / `SEED_KEY` get the new entries.
- **New table** `entity_types_custom(id, project_id, name, icon, color,
  fields_json TEXT, sections_json TEXT)`; built-ins stay in code.
- **`StoryBibleView`** grows from 2 fixed columns to **N type sections** (a
  column/section per type, collapsible) so it scales past Characters/Locations.
- **`lib/detection.ts`** gains patterns for the new types (additive).
- **View states:** type with zero entities (quiet "New {type}") · custom-type
  creation form.
- **Mount:** `StoryBibleView` + `entry.jsx` (already type-driven); add a type
  switcher / "New type" entry in the Story Bible header.
- **Schema flag:** one new table; `EntityType` widened to `string` for custom.

---

## Feature 5 — Find & replace (project-wide) + focus / composition mode

### 5a — Project-wide find & replace
**Direction.** An **overlay** that searches across all scenes (current per-scene
index in `editor/extensions/buildTextIndex.ts` stays as-is for in-scene). Results
**grouped by chapter → scene**, click to jump to a match, **replace-one /
replace-all** with a **preview (match count + per-scene breakdown) before
replacing, and Undo** (the requested safety affordance). *First confirm in prod
whether a manuscript-wide path already exists — don't rebuild it.*

```ts
interface FindReplaceProps {
  query: string; replacement: string;
  matches: SceneMatchGroup[];           // grouped + counted, computed in store
  options: { caseSensitive: boolean; wholeWord: boolean };
  busy?: boolean;
  onSearch?: (q: string, opts) => void;
  onJump?: (sceneId: string, matchIndex: number) => void;
  onReplaceOne?: (sceneId: string, matchIndex: number, value: string) => void;
  onReplaceAll?: (value: string) => void;    // parent confirms + Toast undo
  onClose?: () => void;
}
interface SceneMatchGroup { sceneId: string; sceneTitle: string; chapter: string; count: number; previews: MatchPreview[]; }
```
- **Store — new `manuscriptSearchStore`** (or function over `sceneDocStore`):
  `search(query, opts) → SceneMatchGroup[]`, `replaceInScene(...)`,
  `replaceAll(query, value, opts) → {scenes, count}`. Writes go through each
  scene's Yjs doc (one-doc-per-scene preserved); replace-all snapshots each
  touched scene first (ties into Feature 1) for the Undo guarantee.
- **No new table.** Reads/writes existing `scene_docs`.
- **View states:** idle · searching · no matches · results · replacing · done
  (Toast: "Replaced N in M scenes — Undo").
- **Mount:** overlay from title-bar (`⌘⇧H`) — additive, editor frozen.

### 5b — Focus / composition mode
**Direction.** Extend the existing hide-chrome focus into a true composition
mode: **typewriter scrolling** (current line stays vertically centred),
**dim-all-but-current-paragraph**, a **fading HUD** (word count + active goal,
using the new Goals), and an **optional session timer**. Themed full-screen
background is a stretch. All layered *around* the frozen editor.

```ts
interface FocusModeProps {
  active: boolean;
  settings: { typewriter: boolean; dimParagraphs: boolean; showHud: boolean; timer: boolean };
  goals?: Goal[];                       // from the goals store (HUD)
  sessionWords?: number;
  onExit?: () => void;
  onChangeSettings?: (s: Partial<FocusModeProps["settings"]>) => void;
}
```
- **No store/schema change.** Settings persist via the existing settings/tweaks
  store (`localStorage`). Typewriter scroll + paragraph dimming are CSS/scroll
  affordances over the editor surface — additive, no editor-core change.
- **View states:** entering/active/exiting; HUD visible-on-motion, hidden at
  rest; reduced-motion = no typewriter animation.
- **Mount:** the existing focus boolean in `app.jsx`/`shell.jsx`; add a small
  in-focus settings popover.

---

## Cross-feature schema summary (the implementer's new-table to-do)

| Feature | New table(s) | Store (new / extended) |
|---|---|---|
| Snapshots | `scene_snapshots` | **new** `snapshotStore` |
| Labels | `labels`, `scene_labels` | extend `binderStore` (or new `labelStore`) |
| Relationships | `entity_relations` | extend `storyBibleStore` |
| Entity types | `entity_types_custom` | extend `storyBibleStore` + `defs.ts` |
| Find & replace | — | **new** `manuscriptSearchStore` |
| Focus mode | — | existing settings store |

Plus token additions in `tokens.css`: the 8-hue **label palette** (solid +
tint), reused by labels and entity-type accents.

---

## Build order (rough passes, then refine)

1. **Snapshots** — exploration canvas → commit → `SNAPSHOTS-SPEC.md`. *(in progress)*
2. **Outliner + labels** — palette tokens first, then the view + label menu.
3. **Relationships** — list on entry → ego-graph → map view.
4. **New entity types** — defs + type-driven Story Bible columns.
5. **Find & replace + focus** — overlay, then composition mode.

Each feature ships a rough interactive pass in the canon prototype + a spec doc
in the shape of `GOALS-SPEC.md` / `FULL-ENTRY-SPEC.md`.
