# Binder — Phase 1, Plan 2 Design Spec

> **Parent design:** `docs/superpowers/specs/2026-06-02-creative-writing-app-design.md` (§6 layout, §7 data model).
> **Builds on:** the walking skeleton (`scene_docs` + `SceneDocStore` + `serialize` + `bindPersistence`),
> which proved one-Yjs-doc-per-scene persistence end-to-end. The binder is the next slice: manage **many**
> scenes in a persisted tree and switch the editor between them.
> **Status:** approved 2026-06-02. Implementation plan authored separately via `/wave-plan` →
> `roadmap/wave-2-binder.md`.

## 1. Goal

Give the writer a Scrivener-style **binder** — a left-hand project tree (Project → Chapters → Scenes,
plus loose "Short pieces") — that creates, organizes, reorders, and opens scenes, with every change
persisted to SQLite and every scene backed by its own Yjs doc. Selecting a scene opens it in the
existing TipTap editor.

This slice covers the **full** binder: multiple projects with a switcher, full CRUD on chapters and
scenes, drag-to-reorder, and the Short-pieces section. Drag-reorder is sequenced **last** in the plan so
the rest of the binder is verifiable before the fiddliest part is built.

## 2. Locked product decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Full binder in one plan | User (vision lead) call; drag sequenced last to de-risk. |
| Projects | Multiple, with a switcher | Day-one support for separate novels/collections. |
| Delete a chapter with scenes | Move its scenes to **Short pieces** | Never lose prose by deleting a container. |
| First run | **Seed a sample project** | App is immediately explorable; doubles as a smoke fixture. |

## 3. Data model

New SQL tables hold **structure**; Yjs still holds **prose** (`scene_docs`, unchanged from the skeleton).

- **`projects`** — `id, title, type (novel | collection), sort_order, created_at, updated_at`
- **`folders`** — `id, project_id, title, sort_order` — a "chapter" is a folder.
- **`scenes`** — `id, project_id, folder_id (nullable), title, synopsis, sort_order, word_count`
- **`scene_docs`** — *(already exists)* `scene_id, state_base64, plaintext_projection`

**Short pieces = scenes with `folder_id IS NULL`.** There is no "Short pieces" folder row; the binder
renders all null-folder scenes for the active project under a "Short pieces" heading. This is why
deleting a chapter "moves scenes to Short pieces" — the operation sets the affected scenes'
`folder_id = NULL`. No prose moves; no `scene_docs` row is touched.

**Scope note (this slice):** `folders` are a single level (chapters directly under a project); no nested
sub-folders. The parent design's nullable-`parent_id` idea is deferred — not modeled here to avoid
unused structure (YAGNI). `synopsis`, `word_count`, `type`, and `plaintext_projection` are stored but
only lightly surfaced in the UI this slice (corkboard/goals/search are later plans); they are carried so
later plans don't require a migration.

### Ordering model

Position is a plain integer **`sort_order`**, scoped to a container (siblings within one folder, or the
project's folder list, or the project list). On a drop, the affected container's siblings are renumbered
in a single transaction. For a local single-user app with at most hundreds of scenes, rewriting a handful
of rows per drag is trivially cheap and simple to reason about.

*Fractional indexing* (string position keys that allow insert-between without renumbering — Figma/Linear
style) is the deliberate **Phase-2 upgrade path**: it earns its complexity only under concurrent
multi-device reordering, which is exactly when sync arrives. Not built now.

## 4. Architecture & components

The walking skeleton's seam discipline repeats — a **pure, testable store interface with an in-memory
fake**, mirroring `SceneDocStore` / `InMemorySceneDocStore`.

- **`BinderStore` interface** with two implementations:
  - `SqliteBinderStore` — real, over `tauri-plugin-sql`.
  - `InMemoryBinderStore` — test fake.
  Operations: list projects; create/rename/delete/reorder projects; list a project's folders + scenes;
  create/rename/delete/reorder folders; create/rename/delete/move/reorder scenes; and the
  delete-chapter→null-folder behavior.
- **Pure helpers** (no DB, no React — the riskiest logic, fully unit-tested):
  - `buildTree(folders, scenes)` → nested `{ chapters: [{ folder, scenes }], shortPieces: scenes }`.
  - `computeReorder(...)` → the new `sort_order` values for a move (within or across containers).
- **`schema.ts`** gains three additive `CREATE TABLE IF NOT EXISTS` statements and a one-time **seed**:
  when `projects` is empty, insert a sample project with two chapters and a few scenes (each scene gets a
  `scenes` row; its `scene_docs` row is created lazily on first open, consistent with the skeleton).
- **Editor integration:** `App.tsx`'s hardcoded `SCENE_ID = "skeleton-scene"` is replaced by
  **selected-scene state**. Selecting a scene: unbind the current Yjs doc, load the selected scene's doc
  (`SceneDocStore.load` → `applyEncoded`), bind persistence, remount the editor with the new doc. The
  skeleton's `serialize` / `bindPersistence` / `SceneDocStore` path is reused verbatim, once per scene.
  The old `skeleton-scene` row is harmless legacy; it is not surfaced (the seeded project's scenes are
  what the binder shows).
- **UI pieces:**
  - **Project switcher** — header control listing projects + create-project + active-project selection.
  - **Binder tree** — chapters (folders) each containing their scenes, plus a Short-pieces section.
  - **CRUD affordances** — `+ chapter`, `+ scene`, inline rename, delete (chapter delete uses the
    move-to-Short-pieces rule; scene delete removes the scene and its `scene_docs` row after confirm).
  - **Drag-reorder** — reorder scenes within/between chapters, drag scenes to/from Short pieces, reorder
    chapters. Built **last**.

### Drag-and-drop library

**dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) — the current React standard for sortable and
cross-container drag, keyboard-accessible, actively maintained; it handles dragging a scene between
chapters and in/out of Short pieces. **React 19 compatibility is verified at plan-writing time** (ctx7 /
the dnd-kit docs) before it is locked into the plan — React 19 is new enough not to assume.

## 5. Data flow

1. App start → ensure schema → if `projects` empty, seed → load project list → choose active project
   (first/most-recent) → load its tree (`buildTree`) → render binder.
2. Select a scene → editor loads that scene's Yjs doc (skeleton path) and binds persistence.
3. CRUD op → `BinderStore` writes to SQLite → tree refreshes.
4. Drag drop → `computeReorder` → `BinderStore.reorder` (transactional renumber) → tree reflects new
   order.

## 6. Error handling

- All `BinderStore` writes are awaited; a failed write surfaces a non-blocking error and leaves the tree
  unchanged (no optimistic divergence this slice — re-read from SQLite on failure).
- Deleting the last scene of a chapter is allowed (the chapter simply becomes empty). Deleting a chapter
  with scenes never deletes prose (move-to-Short-pieces).
- Selecting a scene whose `scene_docs` row does not yet exist hydrates an empty Yjs doc (identical to the
  skeleton's first-open behavior).
- Reorder math is validated by pure unit tests (no gaps, stable within-container order, correct
  cross-container insertion index).

## 7. Testing strategy

Same shape that worked for the skeleton: **pure logic gets unit tests; the GUI + DB gets a manual
smoke.**

- **Unit (Vitest, no Tauri):** `buildTree`, `computeReorder`, and every `BinderStore` operation against
  `InMemoryBinderStore` — including delete-chapter→Short-pieces and cross-container reorder.
- **Manual smoke (the gate):** seed → create a chapter and a scene → type prose in a scene → reorder by
  drag → delete a chapter (its scenes appear under Short pieces) → switch projects → **fully relaunch →
  tree structure, scene order, and prose all persist.**

## 8. Task sequencing (de-risking "full binder, one plan")

Indicative order (the `/wave-plan` pass finalizes it):

1. Schema (three tables) + seed.
2. `BinderStore` interface + `InMemoryBinderStore` + pure helpers (`buildTree`, `computeReorder`) — TDD.
3. `SqliteBinderStore` over `tauri-plugin-sql`.
4. Render the tree (read-only) from the seeded project.
5. Scene-switching wired to the editor (replace hardcoded `SCENE_ID`).
6. CRUD — create/rename/delete chapters and scenes (incl. delete-chapter→Short-pieces).
7. Project switcher (list / create / switch).
8. **Drag-reorder** (dnd-kit) — within/across chapters and Short pieces; reorder chapters.
9. Manual smoke + commit.

Everything before step 8 is verifiable on its own, so drag-reorder cannot block the rest of the slice.

## 9. Out of scope (later plans)

Corkboard (Plan 4), story-bible/inspector (Plan 3), quick-capture + goals (Plan 5), export (Plan 6),
backup (Plan 7), nested sub-folders, full-text search over the plaintext projection, and editor visual
polish (placeholder / visible writing surface / autofocus — see `roadmap/HANDOFF.md` open notes; folds in
here or in a small polish dispatch). Word-count computation from the plaintext projection is carried in
the schema but not surfaced this slice.
