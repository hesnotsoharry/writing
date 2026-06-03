---
status: PLANNED
created: 2026-06-02
---

# Wave 2 — Binder

## Plan

### Status

DRAFT · target v0.2.0 · drafted 2026-06-02.

### Goal

After this wave the app has a working Scrivener-style binder: a left-hand tree of the active project's
chapters and scenes (plus a "Short pieces" section for loose scenes), backed by three new SQLite tables
(`projects`, `folders`, `scenes`) alongside the existing `scene_docs`. The writer can switch between
multiple projects, create/rename/delete chapters and scenes, and drag to reorder anything; clicking a
scene opens its own Yjs doc in the existing TipTap editor. All structure and ordering persist across a
full relaunch. Ordering uses gap-based integer `sort_order` so a drag is a single-row update (no SQL
transaction required — `tauri-plugin-sql` exposes none).

### Scope

**In scope:**

- New SQLite tables via `src/db/schema.ts`: `projects (id, title, type, sort_order, created_at, updated_at)`,
  `folders (id, project_id, title, sort_order)`, `scenes (id, project_id, folder_id NULL, title, synopsis, sort_order, word_count)`. Additive `CREATE TABLE IF NOT EXISTS`; `scene_docs` untouched.
- First-run seed: a sample project with ≥2 chapters and ≥3 scenes when `projects` is empty.
- `BinderStore` interface + `InMemoryBinderStore` (test fake) + `SqliteBinderStore` (real) in `src/db/`.
- Pure helpers in `src/binder/`: `buildTree(folders, scenes)` and `computeReorder(...)` (gap-based) — unit-tested.
- Binder UI (`src/binder/`): tree render (chapters → scenes + Short-pieces section), CRUD affordances
  (`+ chapter`, `+ scene`, inline rename, delete), a project switcher, and drag-reorder via dnd-kit.
- Editor integration: replace `App.tsx`'s hardcoded `SCENE_ID` with selected-scene state; reuse
  `serialize` / `bindPersistence` / `SceneDocStore` per scene.
- Delete-chapter-with-scenes sets the scenes' `folder_id = NULL` (they move to Short pieces); no prose deleted.

**Out of scope:**

- Corkboard (Plan 4), story-bible/inspector (Plan 3), quick-capture + goals (Plan 5), export (Plan 6),
  backup (Plan 7) — each its own later wave.
- Nested sub-folders (folders are single-level chapters this wave) — deferred, parent design's `parent_id` not modeled.
- Word-count computation and full-text search over `plaintext_projection` — columns carried, not surfaced (later plan).
- Editor visual polish (placeholder / visible writing surface / autofocus) — folded into this wave only if
  cheap during Phase 1; otherwise a small follow-on polish dispatch (see HANDOFF open notes).
- Fractional indexing for ordering — gap-based integers suffice for single-user Phase 1; fractional is the Phase-2 (sync) upgrade.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Binder walking skeleton: 3-table schema + seed + `BinderStore` read seam + `buildTree` + read-only tree render + scene-switch wired to editor + relaunch-persist | sonnet-implementer | **Walking skeleton — thinnest end-to-end binder slice.** Trophy (static + integration + manual smoke). **Cross-boundary** (persistent storage, new 3-table schema). Orchestrator authors a failing acceptance test for the `BinderStore.loadTree` contract before dispatch. `buildTree` is pure + unit-tested against `InMemoryBinderStore`. Reuses `scene_docs`/`SceneDocStore`/`serialize`/`bindPersistence` verbatim. No CRUD/drag yet. | The binder lists the seeded project's chapters and scenes; clicking a scene opens its prose in the editor, and after a full app relaunch the same tree and that scene's text are still on screen. |
| 2 | Scene + chapter CRUD: create / rename / delete chapters & scenes; delete-chapter moves its scenes to Short pieces | sonnet-implementer | Trophy. `BinderStore` write ops + UI affordances. The delete-chapter→`folder_id=NULL` rule and scene-delete (removes scene + its `scene_docs` row, after confirm) are pure-logic unit-tested. Cross-boundary (schema writes). | The writer adds a chapter and a scene from the binder, renames one inline, then deletes a chapter and watches its scenes reappear under the "Short pieces" heading — and all of it is still there after a relaunch. |
| 3 | Project switcher: list projects, create a project, switch the active project | sonnet-implementer | Trophy. Active-project state drives which tree loads; switching unbinds the current scene doc and loads the new project's tree. Cross-boundary (schema writes). | The writer creates a second project and switches between them via the header control; the binder swaps to show each project's own chapters and scenes. |
| 4 | Drag-reorder (dnd-kit): reorder scenes within a chapter, drag scenes between chapters and in/out of Short pieces, reorder chapters | sonnet-implementer | Trophy + manual smoke. **dnd-kit `@dnd-kit/react` + `@dnd-kit/helpers`** (React 19-compatible per research; mature `@dnd-kit/core`+`@dnd-kit/sortable` is the named fallback). **Gap-based integer `sort_order`** → one-row UPDATE per move, so no SQL transaction is needed (`tauri-plugin-sql` exposes none — research #886); container renormalize when a neighbor gap exhausts. `computeReorder` pure + unit-tested. Sequenced LAST so it cannot block the rest. | The writer drags a scene to a new spot in its chapter, into a different chapter, and into Short pieces, and reorders the chapters themselves — and the new order holds after a full relaunch. |

> After Phase 4: the always-final wrap (full test suite + lint + format + typecheck + wave-end adversarial review + `/review` + the manual smoke) per `~/.claude/notes/wave-process.md` "Wave's final phase." Not a feature phase.

### Acceptance criteria

- [ ] `src/db/schema.ts` creates `projects`, `folders`, `scenes` via `CREATE TABLE IF NOT EXISTS`; `scene_docs` DDL is unchanged.
- [ ] On first run with an empty `projects` table, a sample project with ≥2 chapters and ≥3 scenes is seeded (idempotent — not re-seeded on later launches).
- [ ] `BinderStore` interface, `InMemoryBinderStore`, and `SqliteBinderStore` exist in `src/db/`; `buildTree` and `computeReorder` exist in `src/binder/` and are pure (no Tauri/React import).
- [ ] `npm run test` is green and includes unit tests for `buildTree`, `computeReorder` (gap-based math: insert-between, gap-exhaustion renormalize), and the delete-chapter→`folder_id=NULL` rule.
- [ ] The binder renders the active project's chapters→scenes plus a Short-pieces section populated by `folder_id IS NULL` scenes.
- [ ] `App.tsx` no longer contains a hardcoded `SCENE_ID`; the selected scene drives which Yjs doc the editor loads.
- [ ] Creating, renaming, and deleting chapters and scenes works from the binder; deleting a chapter sets its scenes' `folder_id = NULL` and deletes no `scene_docs` row.
- [ ] The project switcher lists projects, creates a project, and switches the active project; the tree reflects the active project.
- [ ] Dragging reorders scenes within a chapter, between chapters, in/out of Short pieces, and reorders chapters; each new order survives a relaunch.
- [ ] `npx tsc --noEmit` is clean.
- [ ] Manual smoke recorded: create chapter+scene → type prose → drag-reorder → delete a chapter (scenes land in Short pieces) → switch projects → full relaunch → tree, order, and prose all persist.

### Files the next agent should read first

1. `roadmap/wave-2-binder-research.md` — research sidecar: current dnd-kit React-19 API (`@dnd-kit/react` + `@dnd-kit/helpers`, multi-container `move()` pattern) and the `tauri-plugin-sql` no-JS-transaction finding (#886). Grounds Phases 1 and 4.
2. `docs/superpowers/specs/2026-06-02-binder-design.md` — the approved binder design (data model, decisions, sequencing).
3. `src/db/schema.ts` — existing `getDb()` + `scene_docs` DDL; extended here with the three new tables + seed.
4. `src/db/sceneDocStore.ts` + `src/db/sqliteSceneDocStore.ts` — the store interface + in-memory-fake + SQLite-impl pattern that `BinderStore` mirrors.
5. `src/yjs/serialize.ts` + `src/yjs/bindPersistence.ts` — the per-scene persistence path reused unchanged.
6. `src/App.tsx` + `src/editor/Editor.tsx` — where the hardcoded `SCENE_ID` lives and how the editor mounts a doc.
7. The `## Locked decisions` section of THIS wave file (decisions appended during execution).
8. `docs/superpowers/specs/2026-06-02-creative-writing-app-design.md` §6 (layout) + §7 (data model) — parent design.

### Note to the implementer

The spirit of this wave is "the writer can organize their work." Build on the skeleton's proven seam
discipline: a pure, testable store (mirror `SceneDocStore`/`InMemorySceneDocStore`) with the SQLite impl
behind it, and pure tree/ordering helpers that never import Tauri or React. Resist three temptations:
(1) don't touch `scene_docs`, `serialize`, or `bindPersistence` — they are proven and reused as-is;
(2) don't pull in later-plan scope (corkboard, story-bible, goals, export) even if a table column invites
it; (3) don't reach for fractional indexing or a SQL transaction — gap-based integer `sort_order` with
single-row moves is the deliberate design (the plugin has no JS transactions). First step: verify the
`## Locked decisions` section, then read the research sidecar before writing any dnd-kit or schema code.

Before declaring a phase complete, restate the observation point from the Phases table Observation column
in your own words and describe what you actually observed there. If you could not observe it directly — no
live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass"
for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

<!-- ADR entries are appended here as the wave progresses. Each entry: Context (1 line), Pick, Consequences, Enforcement.
Add `durable: candidate` flag if author thinks this decision has cross-wave reach.
Full best-practice-spectrum framing ONLY when 3+ axes are in genuine tension.
Decisions that become authoritative after a subsequent wave cites them are promoted to roadmap/decisions/ by the wrap team. -->

> Two technical defaults are pre-resolved from research grounding and recorded here as plan context (not
> yet locked ADRs — they pass through the decision-review cell when first formalized during execution):
> **(a) Ordering = gap-based integer `sort_order`** (single-row moves; no SQL transaction needed, since
> `tauri-plugin-sql` exposes none — research #886). **(b) Drag library = `@dnd-kit/react` + `@dnd-kit/helpers`**
> (React 19-compatible; mature `@dnd-kit/core`+`@dnd-kit/sortable` is the named fallback if the newer
> packages prove unstable at Phase 4).

## Status

| Phase | Dispatched | Completed (impl + gates) | Observation point hit |
|---|---|---|---|
| 1 — Walking skeleton | ✅ sonnet-implementer | ✅ lint 0 / 14 tests / tsc clean; adversarial review FLAG adjudicated (computeReorder = Phase 4 scope; loadScene race fixed). Lane B fix bundle: WAL read-after-write (PRAGMA journal_mode=DELETE — tauri-plugin-sql pool+WAL snapshot isolation), StrictMode mountedRef reset, init error surfacing. | ✅ CONFIRMED (smoke): seeded tree renders (no dups), scenes click-to-open, per-scene prose persists across switching AND full relaunch. |
| 2 — CRUD | ✅ sonnet-implementer | ✅ lint 0 / 17 tests / tsc clean. Adversarial review (single) FLAG → all 3 addressed: InlineRename Escape-cancels-not-commits guard, active-project ref set before setLoading, scene-delete reloads tree even if doc-cleanup fails. Store: rename/delete folder+scene, SceneDocStore.delete. UI: +Chapter/+Scene, inline rename, delete (chapter→Short pieces, scene→confirm). | ✅ CONFIRMED (smoke): add/rename/delete all work, Enter commits + Escape cancels rename, changes persist across relaunch. Minor gap: double-click-to-edit doesn't fire (✎ button works) — logged. |
| 3 — Project switcher | — | — | — |
| 4 — Drag-reorder | — | — | — |

## Follow-up candidates

- Binder UX polish (small, in-wave-able): (a) double-click-on-title to rename doesn't fire — only the ✎ button does (needs care: single-click already selects the scene); (b) "+ Chapter/+ Scene" use a browser `window.prompt` — replace with an inline create input; (c) `ShortPiecesSection` hides when empty — keep it visible as a drop target before Phase 4 drag. Plus the standing editor-affordance gap (placeholder/visible surface/autofocus) noted in HANDOFF.

## Result

<!-- Filled at ship by wrap team. -->
