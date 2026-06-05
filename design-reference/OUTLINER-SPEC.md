# Outliner + color labels — feature spec

**Status:** built into the canon prototype (`index.html`). Wave feature 2. The
exploration (Direction A dense table vs. B roomy list) is in
`Outliner - explorations.html`; **Direction A, tuned toward calm, was picked**.

> **Changelog — Jun 2026:** sorting now **keeps the chapter grouping** and
> reorders scenes *within* each chapter, instead of flattening the whole list.
> (A global flat sort scrambled chapter order, which a manuscript outline must
> never do — it read as a bug: "chapter titles disappear and scenes mix
> together.") Header clicks cycle **asc → desc → manual** so the original
> chapter order is always one click away. Logic lives in `Outliner` (`outliner.jsx`).
> Also: the `.otl-table` now carries the shared `--shadow-card` resting shadow,
> matching the corkboard / story-bible / relationship-map card surfaces.

## What it is

A **sortable, inline-editable outliner table** as a sibling presentation to the
corkboard (same binder tree), plus **curated color labels**.

- **View switch.** In the Corkboard view a segmented control toggles
  **Corkboard ⇄ Outliner**; a **Labels** button opens the label manager. (Local
  `planMode` state in `shell.jsx`.)
- **Table.** Columns: status dot · title · synopsis · words · labels. Header
  buttons sort by title / status / words / first-label; **chapter grouping is
  always preserved** — sorting reorders scenes *within* each chapter (+ Short
  pieces). Header clicks cycle asc → desc → manual (original order). Drag handles
  appear on row hover (reorder is a port-time wiring).
- **Inline edit.** Title = click to open / double-click to rename
  (`RenameInput`); synopsis = `contentEditable`, commits on blur; status dot =
  opens the existing status context menu; right-click row = the full scene menu
  (`buildSceneMenu` equivalent).
- **Color labels.** Curated set from the brand palette (`--label-*`, 8 hues in
  `tokens.css`), **multiple per scene**, shown as tinted pills. The row **＋**
  opens an assignment popover (checkable list + "Manage labels…"). The **Label
  Manager** overlay renames + recolours from the palette (no free picker) and
  adds labels.

## Decisions (resolved)

- **Direction A (dense table)**, tuned calm — the value is triage density the
  corkboard doesn't offer. B kept as a documented low-density alternative.
- **Curated palette only** (user's call, for cohesion) — labels + entity-type
  accents share the same 8 `--label-*` tokens.
- **Multiple labels per scene.**

## Component map (prototype)

| Piece | Where | Notes |
|---|---|---|
| `Outliner` | `outliner.jsx` | the table; owns the label-assignment popover; sort comes from props |
| `OutlinerRow` | `outliner.jsx` | status / title (open + rename) / synopsis (contentEditable) / words / label pills + ＋ |
| `OtlLabelMenu` | `outliner.jsx` | assignment popover (fixed-pos, checkable) |
| `OtlLabelPill` | `outliner.jsx` | tinted pill |
| `LabelManager` | `outliner.jsx` | overlay: rename + palette recolour + add |
| seed data | `data.jsx` | `LABELS`, `SCENE_LABELS` |
| state + actions | `app.jsx` | `labels`, `sceneLabels`; `toggleSceneLabel`, `renameLabel`, `setLabelColor`, `addLabel`, `setSynopsis` |
| wiring | `shell.jsx` | `planMode` toggle in the cork view, `otlSort`, handlers, `labels` overlay; styles `.plan-wrap`/`.plan-body` in `app.css`, table in `outliner.css` |

## Integration contract (for the port)

```ts
type LabelColor = "clay"|"sea"|"moss"|"plum"|"gold"|"slate"|"rose"|"ink";
interface Label { id: string; name: string; color: LabelColor; sort: number; }
interface OutlinerProps {
  tree: BinderTree;                       // same buildTree output as the corkboard
  labels: Label[];
  sceneLabels: Record<string, string[]>;  // sceneId -> labelId[]
  sort: { col: "manual"|"title"|"status"|"words"|"label"; dir: "asc"|"desc" };
  setSort: (s) => void; renaming?: string | null;
  onManageLabels?: () => void;
  h: {                                     // handlers (parent-supplied; guard at call site)
    onOpenScene?: (id: string) => void;
    onMenu?: (e, kind: "scene", payload) => void;
    onStatus?: (e, scene) => void;
    onRename?: (kind: "scene", id: string, title: string) => void;
    onSetSynopsis?: (id: string, text: string) => void;
    onToggleLabel?: (sceneId: string, labelId: string) => void;
    setRenaming?: (id: string | null) => void;
  };
}
```

### Store methods (extend `binderStore`, or a small `labelStore`)

```ts
listLabels(): Label[]
renameLabel(id, name): void
setLabelColor(id, color: LabelColor): void
addLabel(name?, color?): Label
reorderLabels(ids: string[]): void
assignLabel(sceneId, labelId): void
unassignLabel(sceneId, labelId): void
labelsForScene(sceneId): string[]
// synopsis + status reuse existing scene mutations (mapScene patch)
```

### New tables

```sql
labels(id TEXT PRIMARY KEY, project_id TEXT, name TEXT, color TEXT, sort INTEGER);
scene_labels(scene_id TEXT, label_id TEXT, PRIMARY KEY (scene_id, label_id)); -- many-to-many = multiple per scene
```
`color` stores the **token name** (`"sea"`), never a hex — keeps re-theming cohesive.

### View states
empty manuscript (no rows) · row with no synopsis/labels (quiet) · sorted
(grouped by chapter, scenes reordered within) · manual (chapter order) · label
menu open · label manager.

### Mount
Production: a new `AppView` value `outline` rendered in the same switch as the
corkboard, OR (as in the prototype) a `planMode` toggle inside the corkboard
view. Binder stays visible. Reorder maps to the existing binder move op.

## Constraints honored
No `setState` in `useEffect` (sort/group derived at render; the label popover
closes via a window listener, not an effect-driven state sync). No `any`.
Handlers optional + guarded. Reuses `RenameInput`, status `ContextMenu`, theme
tokens. Curated palette only.

## Known follow-ups (not built)
- Drag-to-reorder rows (handle shown; wiring is the binder move op).
- Column-width tuning / horizontal scroll on narrow widths.
- Label filtering (show only scenes with label X) — natural next.
