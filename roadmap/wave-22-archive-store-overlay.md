---
status: PLANNED
created: 2026-06-04
---

# Wave 22 — Archive store + browsing overlay

## Plan

### Status

DRAFT · target v1.x (feature wave) · drafted 2026-06-04.

### Goal

After this wave the app has a working archive layer that today is entirely absent: `onArchiveScene`/`onArchiveChapter` are no-ops (`src/App.handlers.ts:71-72`) and `src/features/archive/Archive.tsx` is a 10-line "coming soon" stub. The wave adds six additive methods to the `BinderStore` interface and both implementations (`SqliteBinderStore`, `InMemoryBinderStore`) — `archiveScene`, `archiveChapter`, `listArchived`, `restoreArchived`, `purgeArchived`, `archivedCount` — backed by the existing migration-4 `archive` table, plus a real `Archive` browsing overlay that lists archived items, restores them, and removes them for good. Archiving a scene snapshots its Yjs doc (`scene_docs.state_base64`) into `archive.state_base64` and removes it from the binder; restore reverses it. Archiving a chapter captures the folder and every scene+doc beneath it as one atomic archive entry that restores as a whole unit. No `src/App.*` files and no migrations are touched — the lead wires integration on master.

### Scope

**In scope:**

- `src/db/binderStore.ts` (additive): new types `ArchiveKind` + `ARCHIVE_KIND` const, `ArchivedItem` interface; six new method signatures on the `BinderStore` interface; full `InMemoryBinderStore` implementation of all six.
- `src/db/sqliteBinderStore.ts` (additive): `SqliteBinderStore` implementation of all six methods against the `archive`, `scenes`, `folders`, and `scene_docs` tables.
- `src/test/archiveStore.contract.test.ts` (new): InMemory contract tests for archive/restore/purge/list/count tree semantics (scene + atomic chapter).
- `src/test/sqliteArchiveStore.test.ts` (new): SqlJs-backed round-trip tests proving real `scene_docs.state_base64` snapshot + restore for scenes and atomic chapters.
- `src/features/archive/Archive.tsx`: replace the stub with the real browsing overlay — lists items, Restore + Remove-for-good actions, empty state, canon `scrim`/`sheet` chrome.
- `src/features/archive/Archive.test.tsx` (new): component test with an injected fake store (renders list, Restore calls store, empty state).

**Out of scope:**

- Wiring `onArchiveScene`/`onArchiveChapter` to the store, computing `archivedCount` for the `<Binder>` footer, mounting `<Archive>` in `App.overlays`, the footer "Archived" button, and the corkboard "Archive — coming later" toast → real call. **Deferral path:** lead integrates on master per the coordination doc (`batch-2-coordination.md` LANE 22 → "Lead integrates on master").
- Any change to `src/App.*` or `src/shell/TitleBar.tsx`. **Deferral path:** integration touchpoints owned by the lead.
- Adding a migration / new column. **Deferral path:** Lane 24 owns new migrations this batch; Lane 22 stays within the existing migration-4 `archive` table to avoid a version-number collision on merge.
- Restoring a scene back into its *original* chapter (the `archive` table stores no original `folder_id` for scenes). **Deferral path:** lone scenes restore to "Short pieces" (`folder_id = null`), matching the design prototype (`design-reference/app.jsx:163`); a future wave can add folder-id retention if Cole wants it.
- "Undo" toast integration for archive (the design's `withUndo`). **Deferral path:** the lead's App layer owns toast/undo wiring.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Store contract + types + `InMemoryBinderStore` impl + contract tests | sonnet-implementer | trophy · internal-only · Add `ArchiveKind`/`ARCHIVE_KIND`, `ArchivedItem` ({id, kind, originalId, title, sub, archivedAt}); six method sigs on `BinderStore`; implement all six in `InMemoryBinderStore`. Atomic chapter = capture folder + child scenes (+ each scene's in-memory doc, may be null) as one logical entry. Scene `sub` = chapter title (or "Short pieces"); chapter `sub` = "N scenes". Restore reinserts using original ids; lone scenes → `folder_id=null`. Author `archiveStore.contract.test.ts` (TDD). | Internal — no observation point |
| 2 | `SqliteBinderStore` impl + SqlJs round-trip tests | sonnet-implementer | trophy · cross-boundary (SQLite persistence + Yjs base64 snapshot) · Implement all six against `archive`/`scenes`/`folders`/`scene_docs`. `archiveScene`: read `scene_docs.state_base64` → INSERT archive row → DELETE scene + scene_docs. `archiveChapter`: encode `{folder, scenes:[{meta, doc_base64}]}` JSON → base64 into the chapter row's `state_base64` (single-table atomic; no new migration) → DELETE all. Restore decodes + reinserts. `crypto.randomUUID()` ids, `$1` params per existing store style. Author `sqliteArchiveStore.test.ts` with `makeSqlJsDb()` + `runMigrations()`. | Internal — no observation point |
| 3 | `Archive.tsx` browsing overlay + component test | sonnet-implementer | trophy · internal-only (renderer; no App wiring) · Replace stub. Props `{ projectId, store?, onClose, onChanged? }`; load `listArchived(projectId)` on mount; Restore → `restoreArchived` + reload + `onChanged?()`; Remove → `purgeArchived` + reload + `onChanged?()`. Canon `scrim`/`sheet`/`sheet-head`/`sheet-body`/`sheet-foot` chrome mirroring `Goals.tsx`. Empty state "Nothing archived." Author `Archive.test.tsx` with injected fake store. | Archive overlay panel renders the list of archived items, each row showing title + sub, with Restore and Remove buttons; an empty archive shows "Nothing archived." (Cole confirms live post-merge — this lane cannot Tauri-smoke the surface.) |

### Acceptance criteria

- [ ] `BinderStore` interface (`src/db/binderStore.ts`) declares all six: `archiveScene(sceneId, projectId): Promise<void>`, `archiveChapter(folderId, projectId): Promise<void>`, `listArchived(projectId): Promise<ArchivedItem[]>`, `restoreArchived(archiveId): Promise<void>`, `purgeArchived(archiveId): Promise<void>`, `archivedCount(projectId): Promise<number>`.
- [ ] `ArchivedItem` and `ARCHIVE_KIND`/`ArchiveKind` are exported from `src/db/binderStore.ts`.
- [ ] `InMemoryBinderStore` and `SqliteBinderStore` both implement all six methods (no `throw "not implemented"`).
- [ ] After `archiveScene(id, p)`, the scene is absent from `loadProject(p).scenes` and present in `listArchived(p)`; `archivedCount(p)` increments by 1.
- [ ] SqlJs test proves: archiving a scene copies the live `scene_docs.state_base64` into the archive row and deletes the `scene_docs` row; `restoreArchived` recreates the scene AND its `scene_docs` row with byte-identical `state_base64`.
- [ ] `archiveChapter` then `restoreArchived` on the chapter row reproduces the folder and every child scene (titles, statuses, and docs) — verified in the SqlJs test.
- [ ] `purgeArchived(id)` removes the row from `listArchived` and does NOT recreate any scene/folder.
- [ ] `Archive.tsx` exports `Archive` with props `{ projectId, store?, onClose, onChanged? }`; renders the item list, Restore + Remove actions, and the "Nothing archived." empty state.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the three new test files all pass in the worktree.

### Files the next agent should read first

1. `roadmap/wave-22-DRAFT-research.md` — N/A this wave (research grounding skipped; no version-sensitive surface). Skip.
2. The `## Locked decisions` section of THIS file — the manifest-encoding and no-migration decisions are load-bearing.
3. `roadmap/batch-2-coordination.md` (LANE 22 section + GLOBAL RULES) — the lane contract: additive-only, own dirs only, no `App.*`, no migration.
4. `src/db/binderStore.ts` — the `BinderStore` interface + `InMemoryBinderStore` (the impl pattern to mirror; methods are `async`, ids via `crypto.randomUUID()`, gap ordering `(n+1)*1000`).
5. `src/db/sqliteBinderStore.ts` — `const db = await getDb()`, `$1` params, `normalizeStatus` at read boundary; mirror `createScene`/`deleteFolder`.
6. `src/db/sqliteSceneDocStore.ts` + `src/yjs/serialize.ts` — `scene_docs` load/save contract and `encodeDoc`/`applyEncoded`/`extractPlainText`.
7. `src/db/migrations.ts` (migration 4, ~line 244) — the exact `archive` table schema (nullable `state_base64`, `archived_at INTEGER`).
8. `src/test/migration004.test.ts` + `src/test/support/sqljsDb.ts` — the `makeSqlJsDb()`/`runMigrations()` real-SQLite test pattern for Phase 2.
9. `src/features/goals/Goals.tsx` (or equivalent) — canon overlay chrome + `store?` DI seam to mirror in `Archive.tsx`.
10. `design-reference/dialogs.jsx` (`Archive` at line 88) + `design-reference/app.jsx` (`archiveScene`/`archiveChap`/`restoreItem`, lines 136-166) — the authoritative visual + behavior source.

### Note to the implementer

The spirit of this wave is a clean, additive, fully-tested store layer plus a faithful overlay — the lead bolts it onto the running app on master. Resist three temptations: (1) editing anything under `src/App.*` or `src/shell/` — you expose a prop contract, the lead supplies props; (2) modifying any *existing* store signature (additive-only — changing a signature collides with the cleanup sweep); (3) adding a migration or column — Lane 24 owns migrations this batch, so encode the atomic chapter inside the existing `archive` table. First step: verify the `## Locked decisions` section below has its decisions filled in before writing code.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

### Decision 1: Both scene and chapter archives are stored as a JSON manifest in `state_base64` (full-fidelity restore)

**Context:** The `archive` table has columns only for `title`/`sub`/`state_base64` — no `status`/`synopsis`/`word_count`/`sort_order`/`folder` columns. Storing only the raw Yjs doc (the coordination doc's literal wording) makes scene restore lossy (status/synopsis/word_count default on restore) and diverges from `InMemoryBinderStore`, which keeps the full `Scene` object. Lane 22 also cannot add a migration (Lane 24 owns migrations; two lanes appending = version collision) and the table has no parent-link column for cascading a chapter's scenes.
**Pick:** Encode a JSON manifest into `state_base64` for BOTH kinds. Scene (kind=`scene`): `{ meta: { synopsis, status, sort_order, word_count }, doc: <raw scene_docs.state_base64 | null> }`. Chapter (kind=`chapter`): `{ folder: { sort_order }, scenes: [ { id, title, meta: {...}, doc } ] }`. Stored as raw JSON **text** in the TEXT column (no outer base64 wrapping — avoids btoa/Buffer browser-vs-Node portability issues; the embedded per-scene `doc` values are already base64 strings from `scene_docs`).
**Rationale:** Restore must faithfully reverse archive (design prototype preserves full `_data`, `design-reference/app.jsx:139,151,162`), and `SqliteBinderStore` must mirror `InMemoryBinderStore` (Decision 3 consequence). A single self-contained manifest row per archive matches the one-row-per-bin-item UI with atomic chapter restore and needs zero schema change. Raw JSON-in-TEXT round-trips cleanly through `tauri-plugin-sql` (TEXT, per the BLOB gotcha) and `sql.js` in tests.
**Consequences:** `state_base64` holds a JSON manifest (NOT raw Yjs base64) for both kinds; `restoreArchived` branches on `kind` and `JSON.parse`s the column. **⚠ Clarifying deviation from the coordination doc's literal "snapshot scene_docs.state_base64 into archive.state_base64" — flagged to the lead in the handoff.** The lead must NOT assume `archive.state_base64` is a bare Yjs base64 string.
**Enforcement:** SqlJs round-trip test in `src/test/sqliteArchiveStore.test.ts` asserts scene restore reproduces status + synopsis + byte-identical doc, and atomic chapter restore reproduces folder + scenes + docs — gate-enforced via `npm run test`.

### Decision 2: No migration this wave — stay within the existing migration-4 `archive` table

**Context:** Whether to add columns (e.g., scene `folder_id` retention, a chapter parent-link) for richer restore.
**Pick:** Add nothing to the schema; use the existing `archive(id, project_id, kind, original_id, title, sub, state_base64, archived_at)` columns only.
**Rationale:** Lane 24 is concurrently appending migrations 6+; a second lane appending a migration produces a duplicate version number on merge. The existing columns + Decision 1's manifest cover the required behavior.
**Consequences:** Lone scenes restore to "Short pieces" (`folder_id=null`), not their original chapter (no stored folder_id) — matches the design prototype.
**Enforcement:** advisory-only (lane discipline; reviewed in the merge diff — no migration file appears).

### Decision 3: Additive methods live on `BinderStore` (not a new `ArchiveStore`)

**Context:** Where the six archive methods belong.
**Pick:** Append them to the existing `BinderStore` interface + `SqliteBinderStore` + `InMemoryBinderStore`.
**Rationale:** The coordination doc (LANE 22) specifies exactly this; `SqliteBinderStore` already holds the DB handle that reaches `scenes`/`folders`/`scene_docs`, so it can self-snapshot docs with no cross-store injection.
**Consequences:** `InMemoryBinderStore` has no `scene_docs`, so its archive methods exercise tree/metadata semantics with `doc_base64` as null/passthrough; the real doc round-trip is proven by the SqlJs test (Decision 1's enforcement).
**Enforcement:** none (convention) — matches the coordination-doc lane contract.

### Decision 4: `Archive.tsx` is a self-loading overlay with a `store?` DI seam + `onChanged` callback

**Context:** Smart (self-loading via store) vs dumb (items passed in) component, and how the lead keeps the footer `archivedCount` fresh.
**Pick:** `{ projectId, store?, onClose, onChanged? }` — loads `listArchived(projectId)` on mount, performs restore/purge via the store and reloads, and calls `onChanged?()` so the lead can recompute the footer badge.
**Rationale:** Matches the canon `Goals`/`Inbox` self-loading overlay pattern (`store?` defaulting to the production singleton); `onChanged` is the minimal seam the lead needs without owning the list state.
**Consequences:** The lead supplies `projectId` + `onClose` + `onChanged` on integration; the component owns its own list state.
**Enforcement:** advisory-only (prop contract stated in the handoff; verified at integration).

## Status

| Phase | Completed | Commit SHA | Observation point hit |
|---|---|---|---|
| 1 — store contract + InMemory + contract tests | yes | d51fa0a | Internal (9 contract tests green) |
| 2 — SqliteBinderStore + SqlJs round-trip | yes | 7953f99 | Internal (6 SqlJs tests green) |
| 3 — Archive overlay + component tests | yes | d6dd663 | Deferred to Cole post-merge (lane cannot Tauri-smoke); 7 component tests green |

## Follow-up candidates

(none)

## Result

### Wave 22 Archive — handoff for merge

- **Branch:** `wave-22-archive` · **Plan:** `roadmap/wave-22-archive-store-overlay.md`
- **Gates:** lint **PASS** · tsc **PASS** · full suite **512/512 PASS** (22 new archive tests: 9 InMemory contract + 6 SqlJs round-trip + 7 overlay component).
- **Reviewer verdict:** **PASS** — each phase ran an attack-diff (single-tier) `sonnet-adversarial-reviewer`; every FLAG adjudicated and addressed (status-normalization into the manifest, cross-project + edge-case tests, onChanged-after-reload ordering, `type="button"`, projectId guard). No open flags.
- **What shipped:**
  1. Six additive `BinderStore` methods + `ArchivedItem`/`ArchiveKind`/`ARCHIVE_KIND` types, implemented in BOTH `InMemoryBinderStore` and `SqliteBinderStore`.
  2. Full-fidelity archive: archiving a scene/chapter snapshots a JSON manifest (meta + Yjs doc) into `archive.state_base64`; restore reproduces status/synopsis/word_count/sort_order + byte-identical docs, reusing original ids. Chapter archive is atomic (one bin row, restores folder + all scenes).
  3. Real `Archive` browsing overlay (canon `scrim`/`sheet` chrome, mirrors `design-reference/dialogs.jsx`): lists items, **Restore** → `restoreArchived`, **Delete forever** → `purgeArchived`, "Nothing archived." empty state.
  4. No migration added; no `App.*`/`shell` touched; stayed within the existing migration-4 `archive` table.
- **Files touched:** `src/db/binderStore.ts` (additive) · `src/db/sqliteBinderStore.ts` (6 stubs→impl) · **NEW** `src/db/sqliteArchiveHelpers.ts` (manifest build/restore helpers, extracted for the 40-line lint rule) · `src/features/archive/Archive.tsx` · **NEW tests** `src/test/archiveStore.contract.test.ts`, `src/test/sqliteArchiveStore.test.ts`, `src/test/archive.test.tsx`.
- **NEW store methods (additive — on `BinderStore` + both impls):**
  - `archiveScene(sceneId: string, projectId: string): Promise<void>`
  - `archiveChapter(folderId: string, projectId: string): Promise<void>`
  - `listArchived(projectId: string): Promise<ArchivedItem[]>` (archivedAt DESC)
  - `restoreArchived(archiveId: string): Promise<void>`
  - `purgeArchived(archiveId: string): Promise<void>`
  - `archivedCount(projectId: string): Promise<number>`
  - `ArchivedItem = { id, kind, originalId: string|null, title, sub: string|null, archivedAt: number }`
  - Contract tests: `archiveStore.contract.test.ts` (9) + `sqliteArchiveStore.test.ts` (6).
- **COMPONENT PROP CONTRACT (lead supplies on integration):**
  ```ts
  Archive({ projectId?: string, store?: BinderStore, onClose: () => void, onChanged?: () => void })
  ```
  - `projectId` is **required in practice** — typed optional ONLY so the lead's existing `<Archive onClose=.../>` call site compiles unchanged. When absent, the overlay renders the empty state and runs no query. **Lead MUST pass `projectId={activeProjectId}`** for real behavior.
  - `store` defaults to a module-level `new SqliteBinderStore()`; tests inject a fake.
  - `onChanged` fires AFTER a restore/purge fully settles (mutation + list reload) — wire it to recompute the footer `archivedCount`.
- **⚠ Needs Cole's eyes post-merge (lane could not Tauri-smoke):**
  - The overlay rendering live (rows, Restore, Delete-forever, empty state, scrim click-to-close) — verified only by component tests + design-reference line-up.
  - End-to-end archive→restore against the real `writing.db` (back up the DB first).
- **Flags / deviations:**
  - **⚠ DEVIATION (Decision 1):** `archive.state_base64` holds a **JSON manifest** (NOT a bare Yjs base64 string) for BOTH kinds — chosen for full-fidelity restore + cross-impl consistency, since the table lacks status/synopsis/folder columns and we can't add a migration (Lane 24 owns migrations). The coordination doc's literal "snapshot scene_docs.state_base64 into archive.state_base64" is satisfied in spirit (the doc is embedded in the manifest). Lead/integrators must not assume the column is raw base64.
  - Added one new file `src/db/sqliteArchiveHelpers.ts` (additive, no conflict) beyond the literal "binderStore.ts + sqliteBinderStore.ts" — needed to keep methods under the 40-line lint cap.
  - `purgeArchived` (design's "remove for good") was added beyond the 5 methods the brief listed — the design-reference Archive has a remove-forever action, so it's wired.
