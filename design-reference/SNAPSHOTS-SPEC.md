# Snapshots / version history — feature spec

**Status:** built in the canon prototype (`index.html`). First feature of the
five-feature wave (see `FEATURE-WAVE-PLAN.md`). Pre-launch priority.

## What it is

Per-scene version history. A snapshot is a saved, named, timestamped copy of a
scene's text. Two surfaces, one shared model:

- **History rail** (Direction A) — a compact `.insp-group` in the editor
  inspector: the 3 most recent versions + a **See all & compare** button + a
  **＋** to take one. The on-genre, glance-and-go entry (mirrors Scrivener's
  inspector snapshots).
- **Version-history overlay** (Direction B) — the focused compare/restore
  surface (Google-Docs mental model): snapshot **list** on the left (manual +
  auto, each with a ± word delta vs. now), a **viewer** on the right with an
  **inline word-level diff** vs. the current draft (added = `--good`, removed =
  struck `--danger`) and a **Diff ↔ This version** toggle, and a guarded
  **Restore** that snapshots "now" first.

Entry points: title-bar **↺** (write view), the **scene context menu**
("Version history…" / "Take snapshot"), and the rail.

## Decisions (resolved)

- **Hybrid, not either/or.** Rail is the default touchpoint; overlay is the
  heavyweight compare. (Cloud editors → overlay; Scrivener → rail; we do both.)
- **Diff is word-level inline**, because the driving use case is "I can't
  remember what I changed / I regret replacing my draft." A read-only preview
  alone wouldn't answer that.
- **Auto-capture is in scope** and visually distinguished (a `rotate` glyph +
  italic "Auto-save" label vs. the manual `check` glyph + user label).
- **Restore is the only write, and it's safe**: it captures the current draft as
  an auto-snapshot *before* overwriting, so a restore is itself undoable.

## Component map (prototype)

| Piece | Where | Notes |
|---|---|---|
| `HistorySection` | `snapshots.jsx` | inspector rail; recent 3 + see-all + capture |
| `VersionHistory` | `snapshots.jsx` | overlay; local state: selection, diff mode, rename, row menu, restore-confirm. Reuses `ContextMenu` + `RenameInput`. |
| `SnapRow` | `snapshots.jsx` | list row (manual/auto glyph, label, when, words, ± vs now); inline `RenameInput` when renaming |
| `diffWords` / `DiffText` / `diffCounts` | `snapshots.jsx` | pure LCS word diff (whitespace-normalized) |
| seed data | `data.jsx` | `SNAPSHOTS_BY_SCENE`, `SCENE_CURRENT_TEXT` |
| state + actions | `app.jsx` | `snapshots`; `captureSnapshot/renameSnapshot/deleteSnapshot/restoreSnapshot` |
| wiring | `shell.jsx` | `openHistory(sceneId)`, scene-menu items, overlay render; `chrome.jsx` title-bar button |
| styles | `snapshots.css` | overlay, list, diff, rail, popover |

## Mock vs. real

Everything is mock progress so the prototype reads believably:

- Snapshots are keyed by `sceneId` in React state; `text` is plain text and
  `SCENE_CURRENT_TEXT[sceneId]` is the diff baseline. The seeded scene `s-1`
  shows a realistic 4-version history; other scenes start empty (the overlay's
  empty state). New captures prepend with `when: "just now"`.
- **Restore** is mocked as an auto-snapshot + a toast; it does **not** rewrite
  the canvas prose (the prototype's prose is generated, not stored). In prod it
  writes the snapshot's doc state back into the scene's Yjs doc.

## Integration contract (for the port)

```ts
interface Snapshot {
  id: string; sceneId: string; label: string | null;
  wordCount: number; createdAt: number; kind: "manual" | "auto";
}
interface VersionHistoryProps {
  sceneId: string;
  snapshots: Snapshot[];                 // snapshotStore.list(sceneId), newest first
  currentText: string;                   // diff baseline = docToPlainText(current state)
  currentWords: number;
  loading?: boolean; error?: string | null;     // boundary props optional + guarded
  onCapture?: (label?: string) => string;        // returns new id (for select+rename)
  onRename?: (snapshotId: string, label: string) => void;
  onRestore?: (snapshotId: string) => void;      // parent confirms; snapshots "now" first
  onDelete?: (snapshotId: string) => void;
  onClose?: () => void;
}
interface HistorySectionProps {
  snapshots: Snapshot[]; currentWords: number;
  onOpenAll?: () => void; onCapture?: () => void;
}
```

### New store — `snapshotStore`

```ts
capture(sceneId: string, label?: string, kind?: "manual" | "auto"): Snapshot
list(sceneId: string): Snapshot[]            // newest first
get(snapshotId: string): { meta: Snapshot; stateBase64: string }
restore(sceneId: string, snapshotId: string): void   // auto-snapshots current first,
                                                      // then writes snapshot state into the scene Yjs doc
delete(snapshotId: string): void
pruneAuto(sceneId: string, keepN: number): void       // cap auto-snapshots
```

- **Diff util** `diffWords(a, b)` is pure and framework-free — copy `snapshots.jsx`'s
  version into a util and run it over `docToPlainText(stateBase64)`. The editor
  (`src/editor/`) stays frozen; diff reads text, never touches the editor core.

### New table

```sql
scene_snapshots(
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  label TEXT,                 -- null = auto-save
  state_base64 TEXT NOT NULL, -- same encodeDoc→base64 as scene_docs (constraint #4: TEXT, never BLOB)
  word_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL          -- 'manual' | 'auto'
);
```

### View states

loading (skeleton rows) · **empty** ("No versions yet — take one to start a
history") · populated · **restoring** (confirm step in the footer) · error.

### Mount points

- Overlay: opened from the title-bar history button (write view), scene context
  menu, and the rail's "See all & compare". No new `AppView`.
- Rail: an `.insp-group` in the editor inspector (`Inspector` in `inspector.jsx`).

### Auto-capture wiring (prod)

- Setting `snapshots.autoEvery` (off / 5 / 15 / 30 min) + a capture on
  scene-close / blur. Auto-snapshots are `kind:"auto"`, pruned via `pruneAuto`.
- Surface the toggle in Settings → Backup/Writing.

## Constraints honored

No `setState` in `useEffect` (selection is **derived at render** from the live
list, not synced via an effect). No `any`. All parent-supplied callbacks are
optional + guarded. base64 TEXT persistence. One Yjs doc per scene. Editor
frozen. Reuses `Icon`, `ContextMenu`, `RenameInput`, theme vars.

## Known follow-ups (not built)

- Real restore that rewrites the scene doc (needs the editor/store, out of
  prototype scope).
- Skeleton loading + error states (enumerated, not drawn).
- Auto-capture settings UI + the close/interval hook.
- Project- or chapter-level "history" rollup (currently per-scene only).
