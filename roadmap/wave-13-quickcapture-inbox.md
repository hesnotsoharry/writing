---
status: PLANNED
created: 2026-06-04
---

# Wave 13: quickcapture-inbox

## Plan

### Status

PLANNED · parallel feature lane (forks post-wave-11 master) · drafted 2026-06-04 · gates tsc/lint/vitest

### Goal

After this wave the app has a working **Quick Capture → Inbox** loop. Pressing ⌘K (or the TitleBar
trigger) opens a top-right popover that writes a row to the `quick_notes` table (migration 4) scoped to
the active project. The TitleBar inbox dot lights whenever the active project has unfiled notes —
including on a cold launch, not just after an overlay opens. The Inbox overlay lists those notes
(newest first), lets the user edit a note inline, delete it, or **promote** it into a new binder scene
(seeded with the note's text, the note then marked filed). All persistence flows through a new
`SqliteQuickNoteStore` in `src/features/quickcapture/`; the only shared-shell edits are the minimal,
lead-authorized threading of `activeProjectId` + the badge hook into `App.overlays.tsx` /
`App.content.tsx`. `App.tsx`, `App.state.ts`, `TitleBar`, and `app.css` are untouched.

### Scope

**In scope:**

- `src/features/quickcapture/SqliteQuickNoteStore.ts` — `quick_notes` CRUD via an injected `DbHandle`
  (default `getDb`): `create(projectId, body)`, `listUnfiled(projectId)`, `countUnfiled(projectId)`,
  `updateBody(id, body)`, `markFiled(id)`, `delete(id)`. `$1` positional binds, `created_at = Date.now()`
  (INTEGER epoch ms), `filed` 0/1.
- `src/features/quickcapture/promoteNoteToScene.ts` — `noteBodyToSceneDoc(body): string` (build a `content`
  Y.XmlFragment of paragraph→XmlText, `encodeDoc` → base64) + `promoteNoteToScene(...)` orchestrating
  `binderStore.createScene` → `sceneDocStore.save` → `quickNoteStore.markFiled`.
- `src/features/quickcapture/QuickCapture.tsx` — rewrite stub: `.qc-pop` popover, autofocused textarea,
  Capture/Cancel, empty-guard, writes via the store, calls `setHasQuickItems(true)`.
- `src/features/quickcapture/useQuickItemsBadge.ts` — hook: on mount + `activeProjectId` change, query
  `countUnfiled` → `setHasQuickItems(count > 0)`. Drives the cold-launch badge.
- `src/features/inbox/Inbox.tsx` — rewrite stub: `.scrim > .sheet` modal + `NoteCard` subcomponent
  (inline edit, promote, delete), empty-state, recompute badge after every mutation.
- Tests in `src/test/`: store round-trips against `makeSqlJsDb`, `noteBodyToSceneDoc` ↔ `extractPlainText`
  round-trip, promote orchestration.
- **Shared-shell threading (lead-authorized in-lane, flagged in merge report):**
  `App.overlays.tsx` — widen `OverlayStack`'s PARAM to `OverlayStackProps & { activeProjectId: string | null }`
  (do NOT add `activeProjectId` to `OverlayStackProps` itself — `OverlayFlags extends OverlayStackProps` and
  the frozen `App.tsx` builds that object without `activeProjectId`, so widening the interface breaks tsc),
  destructure `setHasQuickItems` + `activeProjectId`, forward both to `<QuickCapture>` and `<Inbox>`.
  `App.content.tsx` — pass `activeProjectId` to `<OverlayStack>` separately at the call site (line ~128) and
  invoke `useQuickItemsBadge`.

**Out of scope:**

- **Live binder refresh after promote** — App.tsx (frozen) owns `setTree`; the new scene appears on the
  next project load/switch, not instantly. Documented as a Locked decision; revisit when the freeze lifts
  (deferral: post-merge polish follow-up if the UX proves jarring in smoke).
- Goals / Archive / Settings / Corkboard / Export / Spelling — other lanes.
- `src/db/` changes — coordination rule #3 reserves `src/db/` for the Corkboard lane (migration 5). This
  lane consumes `getDb`/`SqliteBinderStore`/`SqliteSceneDocStore` but adds no files there.
- Multi-project inbox / cross-project notes — Inbox is scoped to the active project only.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Data layer: `SqliteQuickNoteStore` + `promoteNoteToScene`/`noteBodyToSceneDoc` + tests | sonnet-implementer | honeycomb (DB-seam + encoder round-trip) · cross-boundary (persistent storage) · Build the store against an injected `DbHandle` (ctor default `getDb`) so tests run real SQL on `makeSqlJsDb`. First step: write store + one round-trip test and RUN it to confirm sql.js accepts `$1`+array binding (see Risk R1). `created_at=Date.now()`. `noteBodyToSceneDoc` builds `content` XmlFragment (paragraph→XmlText), multi-line body → one paragraph per line. | Internal — no observation point (verified via vitest: round-trips + `user_version`-independent table ops). |
| 2 | QuickCapture popover + `activeProjectId` threading + badge hook | sonnet-implementer | honeycomb (component + DB write seam) · cross-boundary (DB write + shared shell) · Rewrite QuickCapture using `.qc-pop` (NOT `.scrim`). Add `activeProjectId` to `OverlayStackProps`; forward `activeProjectId`+`setHasQuickItems` to `<QuickCapture>` only (Inbox stub still `onClose`-only — don't forward to it yet or tsc breaks). Wire `useQuickItemsBadge` in `App.content`. Disable Capture when body empty or `activeProjectId` null. Mark shared-file edits with `// wave-13:`. | In `npm run tauri dev`: ⌘K opens a top-right popover (no dimmed backdrop); typing + Capture persists a row and the TitleBar inbox dot lights. Cold launch with seeded unfiled notes also lights the dot. |
| 3 | Inbox + NoteCard (list / edit / delete) + forward props to Inbox | sonnet-implementer | trophy (interactive component over a real store) · cross-boundary (DB read + shared shell) · Rewrite Inbox using `.scrim > .sheet` + `NoteCard` per `dialogs.jsx`. Load `listUnfiled(activeProjectId)` newest-first; inline edit → `updateBody`; delete → `delete`; after every mutation recompute `countUnfiled` → `setHasQuickItems`. Forward `activeProjectId`+`setHasQuickItems` to `<Inbox>` in `App.overlays.tsx`. | Click the TitleBar inbox dot → Inbox lists the project's unfiled notes; editing persists across reopen; deleting removes it and the dot reflects the new count (clears at zero). |
| 4 | Promote-to-scene wiring | sonnet-implementer | pyramid (orchestration over Phase-1 helper) · cross-boundary (DB write to `scenes`+`scene_docs`) · Wire `NoteCard` onPromote → `promoteNoteToScene` (create scene in active project, `folderId: null` → Short pieces, title = first line/truncated body, seed `scene_docs` with `noteBodyToSceneDoc`, `markFiled`). Recompute badge. Document the no-live-refresh limitation inline. | Promote a note → it leaves the inbox and the dot updates; after a project reload the new scene appears under Short pieces seeded with the note text. |

**Walking-skeleton check:** NOT triggered. This wave introduces no new architectural surface — it reuses
the established `tauri-plugin-sql` (`getDb`/`DbHandle`) persistence pattern and the existing Yjs
serialize helpers (`encodeDoc`/`extractPlainText`). Phase 1 is nonetheless the thinnest end-to-end data
slice and is gated by vitest before any UI is built.

### Acceptance criteria

- [ ] `SqliteQuickNoteStore` round-trip on `makeSqlJsDb`: `create` → `listUnfiled(projectId)` returns the
      row (and ONLY for that `project_id`) → `markFiled` → `listUnfiled` excludes it; `countUnfiled`
      matches list length.
- [ ] `noteBodyToSceneDoc(body)` produces a base64 Yjs update whose `extractPlainText` equals `body`,
      including a multi-line body (one paragraph per line).
- [ ] `promoteNoteToScene` creates exactly one `scenes` row in the given project, writes a `scene_docs`
      row whose plaintext equals the note body, and marks the note `filed` (verified on `makeSqlJsDb`).
- [ ] ⌘K opens QuickCapture rendered with class `.qc-pop` (no `.scrim` element present); an empty body
      cannot be captured; Capture inserts a `quick_notes` row and closes the popover.
- [ ] After a capture, `hasQuickItems` is true (TitleBar dot lit). On cold launch / project-switch with
      pre-existing unfiled notes, the dot is lit WITHOUT opening any overlay.
- [ ] Inbox lists the active project's unfiled notes newest-first and shows the empty-state when none.
- [ ] Editing a note persists the new body (survives close/reopen); deleting removes it and updates the dot.
- [ ] Promote removes the note from the inbox, updates the dot, and the seeded scene is present after reload.
- [ ] `tsc`, `lint`, and `vitest` all green; `git diff` shows NO changes to `src/App.tsx`,
      `src/App.state.ts`, `src/shell/TitleBar.tsx`, or `src/styles/*.css`.

### Files the next agent should read first

1. `design-reference/dialogs.jsx` — source of truth for QuickCapture / NoteCard / Inbox markup + props.
2. `src/App.overlays.tsx` — overlay mount points + `OverlayStackProps`; where threading lands.
3. `src/App.content.tsx` (~line 128) — `<OverlayStack>` call + where `useQuickItemsBadge` is invoked.
4. `src/db/sqliteSceneDocStore.ts` — store pattern to mirror (`$1` binds, `getDb`, upsert shape).
5. `src/db/binderStore.ts` — `createScene` contract (args/return) for promote.
6. `src/yjs/serialize.ts` — `encodeDoc` / `extractPlainText`; the inverse you build in `noteBodyToSceneDoc`.
7. `src/db/migrations.ts` (~line 223) — `quick_notes` schema (project_id NOT NULL, created_at INTEGER, filed).
8. `src/test/support/sqljsDb.ts` + `src/test/migration004.test.ts` — the test harness + `DbHandle` seam.
9. `src/components/Icon.tsx` — all needed icon names (zap/check/inbox/clock/arrowRight/trash/x) confirmed present.

### Note to the implementer

The spirit: a frictionless "jot it and keep your place" capture, and an inbox that's a calm staging area —
not a second editor. Resist two temptations: (1) editing the frozen shell beyond the two surgical threading
points (`App.overlays.tsx` + `App.content.tsx` — mark every edit `// wave-13:`); if you find you need
`setTree` or any other App-internal, STOP and flag the lead rather than reaching into `App.tsx`. (2)
Over-building promote — it creates a scene + seeds text + files the note; it does NOT live-refresh the
binder (that's a documented, accepted limitation, not a bug to fix here). First step: verify the
`## Locked decisions` section below is filled in. Before declaring each phase complete, restate that
phase's Observation-column point in your own words and say what you actually observed — and for the UI
phases, note honestly that runtime observation needs `npm run tauri dev` (a Tauri runtime; a plain browser
hangs at "Loading…"), so if you only ran vitest, say so explicitly rather than claiming the dot lit.

## Locked decisions

> Decisions here are routine pattern-application + one documented scope limitation — none carry 3+-axis
> architectural tension or multi-subsystem reach, so they are recorded directly (decision-review cell not
> triggered; no `sonnet-architect` dispatched). See `~/.claude/rules/best-practice-spectrum.md` firing bar.

**Context:** Where the `quick_notes` data layer lives.  **Pick:** `src/features/quickcapture/SqliteQuickNoteStore.ts` (NOT `src/db/`).  **Rationale:** Coordination rule #3 reserves `src/db/` for the Corkboard lane (migration 5); keeping the store in the owned feature dir preserves lane isolation.  **Enforcement:** none (convention) — coordination doc rule #3.

**Context:** How to unit-test real SQL without a network/Tauri runtime.  **Pick:** `SqliteQuickNoteStore` takes a `dbProvider: () => Promise<DbHandle> = getDb` ctor arg; tests inject a migrated `makeSqlJsDb`.  **Rationale:** Exercises the actual `$1` SQL against real SQLite (sql.js) rather than an InMemory fake; production call-site stays `new SqliteQuickNoteStore()`.  **Consequences:** The store never calls the module singleton implicitly — the provider is the only db source.  **Enforcement:** advisory-only (the P1 tests are the de-facto gate).

**Context:** Getting `activeProjectId` (needed for `project_id NOT NULL` + inbox filtering) to the overlays.  **Pick:** Thread it in-lane through `OverlayStackProps` + the `App.content.tsx` `<OverlayStack>` call; `App.tsx` untouched.  **Rationale:** `App.content` already receives `activeProjectId`, so threading it onward needs no frozen-file edit; lead authorized the `App.overlays`/`App.content` edits.  **Consequences:** Waves 14/17 also need `activeProjectId` on the overlay surface — flagged in the merge report so the lead resolves the shared `OverlayStackProps`/`OverlayStack` lines once.  **Enforcement:** advisory-only (merge-report flag + `// wave-13:` markers).  `durable: candidate`

**Context:** Whether promote-to-scene live-refreshes the binder.  **Pick:** No live refresh — create scene + seed text + mark filed; the scene surfaces on the next project load/switch.  **Rationale:** `setTree` lives in frozen `App.tsx`; reaching it would breach the freeze. The data is correct and persisted; only the in-session tree view lags.  **Consequences:** Minor UX lag for promote; revisit post-merge if smoke shows it's jarring.  **Enforcement:** none (convention) — documented limitation.

**Context:** Driving the TitleBar inbox dot incl. cold launch.  **Pick:** `useQuickItemsBadge` hook (queries `countUnfiled` on mount + project-switch) in `App.content`, plus direct `setHasQuickItems` calls from QuickCapture (on capture) and Inbox (after each mutation).  **Rationale:** The hook covers startup/switch (which components can't, since overlays only mount when opened); component calls keep it live in-session. All three read the same DB truth, so no divergence.  **Enforcement:** advisory-only (P2/P3 acceptance criteria).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |
| 4 | — | — | — | — |

## Follow-up candidates

<!-- DEFAULT empty. Stage here only if Tier-3 TRIPLE gate (VALUE+STRUCTURAL+CLEARABILITY) is met. -->

## Result

<!-- filled at ship by wrap team -->
