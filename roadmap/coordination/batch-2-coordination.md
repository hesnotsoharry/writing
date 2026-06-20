# Batch-2 — parallel feature streams alongside the cleanup sweep

Second parallel batch (2026-06-04). Runs **concurrently** with the serial **canon-polish cleanup sweep**
that the lead executes on `master`. Three feature lanes fan out in worktrees; the lead integrates each
on `master` when it lands.

This is NOT the same shape as the first sweep (disjoint UI dirs). These features each have an
**integration touchpoint inside a file the cleanup sweep is actively editing** (menus, footer, story-bible
right-click, App overlays/views). The model that keeps it clean:

> **Lanes own NEW dirs + ADDITIVE store methods. Master owns every `App.*` edit and every integration
> touchpoint.** A lane delivers a self-contained component/overlay + a clean store API; the lead wires it
> into `App.*` on merge. Additive store edits + new dirs ⇒ near-zero conflicts.

---

## GLOBAL RULES (every lane — read before touching code)

1. **`npm install` FIRST** in the fresh worktree (no `node_modules`; hydrate from the committed lockfile).
2. **NO human UI smoke during the lane.** Cole verifies after merge. You also cannot see the Tauri surface
   (browser-smoke hangs). Verify via gates (`npm run lint`, `npx tsc --noEmit`, `npm run test` on touched
   files) + line-by-line review against the design-reference source. Handoff MUST list every
   "Needs Cole's eyes post-merge" behavior.
3. **Own ONLY your dirs (below) + additive store methods.** If you need to change a file outside your dirs,
   STOP and flag the lead — it is an integration touchpoint the lead owns on `master`.
4. **Store edits are ADDITIVE-ONLY.** Append new methods to the `*Store` interface + both impls
   (`Sqlite*` and `InMemory*`). Do NOT modify existing signatures (that conflicts with the cleanup sweep).
   Back every new store method with a contract test.
5. **DO NOT touch `src/App.*` / `src/shell/TitleBar.tsx`.** These are the integration surface the lead owns.
   Your component/overlay exposes a **prop contract**; the lead supplies the props on merge. State your
   component's prop interface explicitly in your handoff so the lead can wire it.
6. **`src/styles/app.css` + `tokens.css` — consume canon classes; flag the lead if one is missing.**
   (The sweep-era consume-only freeze is lifted for genuine canon-class additions, but coordinate so two
   workstreams don't both edit the stylesheet.)
7. **Plan with the cmd in your row** (`/wave-plan` for feature waves; honor the wave-process).
8. **Report a handoff** (format at the bottom). Push your lane branch; the lead merges (no remote — local).

---

## THE 3 FEATURE LANES (fork from current `master`)

```
git worktree add "C:/Web App/writing-wave22-archive"   -b wave-22-archive
git worktree add "C:/Web App/writing-wave23-export"    -b wave-23-export
git worktree add "C:/Web App/writing-wave24-fullentry" -b wave-24-full-entry
```

| Wave | Worktree / branch | Owns (new dirs + additive store) | Source | Plan |
|---|---|---|---|---|
| 22 Archive | writing-wave22-archive / wave-22-archive | `src/features/archive/*` + additive `src/db/binderStore.ts` + `sqliteBinderStore.ts` archive methods | `design-reference/` (archive bin) | `/wave-plan` |
| 23 Export | writing-wave23-export / wave-23-export | `src/features/export/*` (read-only doc access via `sceneDocStore`/`extractPlainText`) | `design-reference/` (export sheet) | `/wave-plan` |
| 24 Full-Entry | writing-wave24-fullentry / wave-24-full-entry | `src/storybible/fullEntry/*` (or `src/features/fullEntry/*`) + additive `src/db/storyBibleStore.ts` + `sqliteStoryBibleStore.ts` (`getEntity`, `updateEntityAliases` if needed) | `design-reference/` (NEW — mirrored character + location full-entry pages; Cole drops shortly) | `/wave-plan` |

---

## LANE 22 — Archive (BUILD THE STORE — it does not exist)

The HANDOFF was wrong: there is **no archive store**. `onArchiveScene`/`onArchiveChapter` are no-ops
(`App.handlers.ts:71-72`). The `archive` table exists (migration 4):

```sql
archive(id TEXT PK, project_id TEXT, kind TEXT, original_id TEXT, title TEXT, sub TEXT,
        state_base64 TEXT, archived_at INTEGER)
```
`kind` ∈ {"scene","chapter"} (define a const). `sub` = chapter title for archived scenes. `state_base64`
= the Yjs snapshot (TEXT, per the BLOB gotcha). `archived_at` = Unix ms.

**Build (additive to `src/db/`):**
- `BinderStore` interface + `SqliteBinderStore` + `InMemoryBinderStore`:
  `archiveScene(sceneId, projectId)`, `archiveChapter(folderId, projectId)`,
  `listArchived(projectId): ArchivedItem[]`, `restoreArchived(archiveId)`, `archivedCount(projectId): number`.
  Archiving a scene must snapshot its `scene_docs.state_base64` into `archive.state_base64`; restore reverses.
- Contract tests for each (mirror `binderStore.contract.test.ts`).
- `src/features/archive/Archive.tsx` — the archive-bin browsing overlay (currently a 10-line stub).
  Lists archived items, restore action, empty state. Define its **prop contract**
  (`{ items, onRestore, onClose }` or `{ store, projectId, onClose }`) and state it in the handoff.

**Lead integrates on master:** wire `onArchiveScene`/`onArchiveChapter` (App.handlers.ts) → store;
compute `archivedCount` in App.content.tsx → `<Binder>` footer; mount `<Archive>` in App.overlays;
wire footer "Archived" button + `onOpenArchive`. The corkboard "Archive — coming in a later wave" toast
also becomes a real call (lead).

## LANE 23 — Export

`onExport` is zero-arg — it CANNOT pass scene context. So the Export overlay receives context via PROPS,
not the menu callback.

- `src/features/export/Export.tsx` (currently a 10-line stub) — the export sheet. Define its prop contract:
  `{ projectId, scope: "scene"|"chapter"|"manuscript", targetId, sceneDocStore, tree, onClose }` (refine).
- Reads prose: `sceneDocStore.load(sceneId)` → `applyEncoded(new Y.Doc(), base64)` →
  `extractPlainText(doc)` (`src/yjs/serialize.ts`). Iterate scenes for chapter/manuscript scope.
- Formats: Markdown + docx + PDF. **ADR at plan time — resolve jsPDF-in-renderer vs Tauri-sidecar via
  `sonnet-architect`** (best-practice-spectrum). Markdown is trivial; docx/PDF drive the decision.
- **Lead integrates on master:** widen `OverlayStackProps` + `App.overlays.tsx` to pass the context props;
  swap the three `onExport` toast stubs (`BinderCrud.tsx:134,191`, `Corkboard.tsx:71`) → `setShowExport(true)`
  with the right scope/target; same for the TitleBar Export button (already wired to `showExport`).

## LANE 24 — Full-Entry (character + location full pages)

**DESIGN IS IN.** Read `design-reference/FULL-ENTRY-SPEC.md` (authoritative) + `full-entry.jsx` +
`full-entry.css` + `entry.jsx` (working prototype). Mirrored pages — character + location share layout,
content differs. **Direction B (Split) is decided**: prose (left) + details rail (right), reusing
`.panel-inspector`/`.insp-group`. It is a **VIEW, not an overlay** (renders in `.center` like Corkboard;
hide the global Inspector while in it).

Entity model is minimal (`storyBibleStore.ts`): `Entity { id, projectId, type, name, notes, aliases }`.
NO stored role/facts/sections/arc/portrait/relationships. Per spec §3:

**NEW TABLES (additive migrations — `setSceneSynopsis` precedent; ⚠ adding a migration breaks prior
migration tests — run the FULL suite after, see memory `adding-migration-breaks-prior-migration-tests`):**
- `entity_fields(entity_id, key, value, sort)` — generic custom fields (the design's `+ Add field`) vs a
  column per field. ADR-worthy (spec §7.4 open) → resolve via `sonnet-architect` at plan time; recommended generic.
- `entity_links(from_id, to_id, relation)` — entity→entity relationships (character Relationships /
  location Characters-here, reversed).
- Portrait field (path/blob) + asset storage (spec §7.3); empty = monogram fallback.
- Additive store methods: `getEntity(type,id)`, field CRUD, link CRUD, portrait set — contract-tested.
- **Zero-schema first cut is acceptable** (spec §3): render `name` + `notes` (one prose section) + the
  live `Appears in` list, stub the rest behind `+ Add field`. Decide scope at plan time WITH Cole.

`Appears in` is buildable TODAY: `findScenesForEntity(id)` → scene_ids → join the BinderTree for
`{title, chapterTitle, status, words}`; row click = `setActiveId(sceneId)` + `setView("write")`.

- Own: `src/storybible/fullEntry/*` (the `FullEntry` view component) + additive `storyBibleStore` methods.
  State the component PROP CONTRACT (entity, onBack, onPushEntry, scenesUsingEntity, origin, store hooks)
  in the handoff.
- **Lead integrates on master (App-owned nav + entry points — spec §4, §8):**
  - View/nav state: `entryStack: {id,kind}[]` + `entryOrigin: "write"|"bible"` + `openEntry`/`pushEntry`/
    `entryBack`/`exitEntry`; add to `AppView`/view-switch (or sub-mode of `"bible"`).
  - Story-bible right-click "Open full entry" (cleanup #18.4) → `openEntry`.
  - **Write-panel inspector entry points (cleanup #14 — SAME flow):** header `+` = add-new (create →
    `replaceSceneLinks` auto-link to open scene → `openEntry` in rename mode); footer "Link a
    character/location" = picker for EXISTING → `replaceSceneLinks`; card click = `openEntry`. These use
    the EXISTING `replaceSceneLinks` (scene→entity), NOT the new `entity_links` table — so #14 is
    DECOUPLED from Lane 24's new tables and can be fixed independently in the cleanup sweep.

---

## MERGE / INTEGRATION ORDER (lead)

Cleanup sweep runs serial on `master` throughout. As each feature lane lands:
1. `git merge --no-ff <lane>` — expect clean (new dirs + additive store methods).
2. Combined gates in the merged tree (lint + tsc + full suite).
3. **Integration commit on master** — wire the lane's component into `App.*` per its handoff prop contract
   (the touchpoints above). This is where the toast-stub swap / footer wire / open-trigger happen.
4. Smoke the integrated feature with Cole.

No ordering dependency between the three lanes (disjoint store files: Archive→binderStore,
Full-Entry→storyBibleStore, Export→none). Land them as they finish.

---

## HANDOFF FORMAT (each lane → lead)
```
## Wave NN <lane> — handoff for merge
- Branch: wave-NN-slug · Plan: roadmap/wave-NN-slug.md
- Gates: lint <P/F> · tsc <P/F> · touched tests <N pass>
- Reviewer verdict: <PASS/FLAG/BLOCK + one-line>
- What shipped: <2-4 bullets>
- Files touched: <list — confirm new dirs + additive store only>
- NEW store methods added (additive): <signatures + contract-test names>
- COMPONENT PROP CONTRACT (what the lead must supply on integration): <exact props + types>
- ⚠ Needs Cole's eyes post-merge: <behaviors only a human can confirm>
- Flags / deviations: <…>
```
