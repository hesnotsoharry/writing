---
batch: wave-29 canon-burndown
created: 2026-06-08
variant: additive-store
lead: Cole (merge master) + Claude (this session = lead/foundation/integration)
---

# Wave 29 — Canon Burndown — Parallel Coordination Runbook

> **This file is the operational contract for the wave-29 follow-up burndown.** Three parallel
> Claude Code sessions run in git worktrees; the lead merges each branch back to master in order.
> Each lane session reads its Section 5 brief as its opening instruction.

---

## SECTION 1 — Preamble

**Strategy.** We are burning down the 13 open follow-ups as a UI fix-sweep.

- **Serial foundation (lead, lands on master first):** the snapshots cross-scene restore
  data-loss bug (Lane B fix). Disjoint from every lane's files, so lanes MAY fork immediately;
  the lead lands the fix concurrently and it reaches master before final integration.
- **3 parallel lanes** fan out by subsystem (binder/tree, editor, inspector/chrome).
- **2 items are lead post-merge work, NOT lanes:** screen-ports visual-polish and the
  transparent-window aesthetic. Both edit shared `app.css` across subsystems and both require
  live side-by-side validation against `design-reference/` — which lane sessions structurally
  cannot do (Rule 3). The lead does these last, against the live app via CDP smoke.
- **Lead role:** merge master. Opens no code itself in the lanes; owns every `App.*` wiring
  edit, runs all post-merge verification gates, does foundation + post-merge polish.
- **Human-driver model:** each lane implements end-to-end, returns the Section 7 handoff, pushes
  its branch; the lead merges. No lane pushes to master itself.
- **Work category:** wiring batch (dead-affordance completion) + one Lane B data-loss fix +
  lead-owned polish pass.

**Variant in force: `additive-store`.** Lanes own NEW/EXISTING component dirs PLUS additive store
methods only. The lead owns every `App.*` edit and every integration touchpoint. A lane delivers a
self-contained component + a clean prop contract; the lead wires it into `App.*` on merge.

> **No new schema migration in this batch.** Verified 2026-06-08: scene `status` already persists
> end-to-end (migration `scenes ADD COLUMN status`, `SqliteBinderStore.setSceneStatus`,
> rendered at `BinderCrud.tsx:192`). `src/db/migrations.ts` stays frozen and untouched by all lanes.

---

## SECTION 2 — GLOBAL RULES (every lane — read before touching code)

**Rule 1 — Hydrate node_modules.** Run `npm install` FIRST in your fresh worktree. No
`node_modules` exist there; hydrate from the committed lockfile before any gate.

**Rule 2 — Gate discipline (worktree cwd).** Per `~/.claude/rules-deferred/worktree-batch-discipline.md`:
gates MUST run inside YOUR worktree directory, never the main repo. Prefix every gate command with
`cd '<your-worktree-path>' &&`. A gate run from the wrong cwd produces false results. Close-out is
the LEAD's job: after merge the lead runs `git worktree remove '<path>'` and `git branch -d <branch>`.
Do not leave stray worktrees.

**Rule 3 — No UI smoke during the lane.** You CANNOT see the rendered app (Tauri runtime + WebView2
CDP required; the lead holds the only live instance). Verify via automated gates (`npm run lint`,
`npx tsc --noEmit`, `npm run test -- <touched>`) AND line-by-line review against the matching
`design-reference/*.jsx` / `*-SPEC.md` file. Do NOT claim "verified in the UI." Your handoff MUST
list every behavior only a human can confirm post-merge (hover, right-click render, animation,
focus states, drag).

> **Do NOT try to launch your own dev server.** It will not work: Vite port `1420` is `strictPort`
> (`vite.config.ts`), the WebView2 CDP port `9222` is hardcoded (`src-tauri/src/lib.rs`), and the
> SQLite DB (`writing.db`) + bundle id are shared — a second instance crashes or clobbers the DB.
> **The LEAD is the visual oracle.** Route any "does this look right against canon?" question to the
> lead, who holds the one live CDP instance. Put visual uncertainties in the handoff's "Needs lead's
> eyes" field — that is the design, not a gap in your work.

**Rule 4 — Disjoint ownership (additive-store).** Own ONLY the dirs in your lane row PLUS additive
store methods. Store edits are ADDITIVE-ONLY: append new methods to the `*Store` interface + BOTH
impls (`Sqlite*` and `InMemory*`); never change an existing signature; back every new store method
with a contract test. If you need to change a file outside your dirs, STOP and flag the lead — it is
an integration touchpoint the lead owns on master. DO NOT touch `App.*` or shared shell files.

**Rule 5 — FREEZE LIST (shared-file protection — do NOT edit; flag the lead if you need a change).**
- `src/App.tsx`, `src/App.state.ts`, `src/App.handlers.ts`, `src/App.detection.ts`,
  `src/App.snapshots.ts`, `src/App.content.tsx`, `src/App.content.viewstage.tsx`,
  `src/App.content.editor.tsx`, `src/App.entryView.tsx`, `src/App.keybindings.ts`,
  `src/App.overlays.tsx` — all App.* modules. The lead owns ALL wiring here.
- `src/styles/app.css`, `src/styles/tokens.css` — shared CSS + design tokens. **Consume-only** (Rule 6).
- `src/shell/AppShell.tsx`, `src/shell/TitleBar.tsx`, `src/shell/WindowControls.tsx` — shell chrome.
- `src/db/migrations.ts`, `src/db/migrations2.ts`, `src/db/schema.ts` — no migration this batch.
- `src/db/binderStore.ts`, `src/db/storyBibleStore.ts` interfaces — additive edits ONLY, and only
  by the lane that owns that store's writes (see Section 5). Coordinate via the lead if two lanes
  need the same interface.
- `src-tauri/tauri.conf.json` — lead-owned (transparent-window is a lead post-merge item).
- `package.json` / `package-lock.json` — do not add deps without flagging the lead.

**Rule 6 — CSS / tokens are CONSUME-ONLY.** Every canon class already exists in `app.css` /
`tokens.css` (verified: `.chapter-row.closed`, `.proj-menu`, `.scene-status`, `.al-hideunder`, etc.
are all present and currently unused). If a class you need is missing, flag the lead — do NOT invent
one or edit the shared stylesheet. Two lanes editing `app.css` = guaranteed conflict. Scope any
truly component-local style inside your own component (CSS module / inline) if unavoidable, and note
it in the handoff.

**Rule 7 — Plan command.** Plan with `/wave-plan-lite` (these are well-scoped follow-ups; full
`/wave-plan` Sites-validation is overkill). Honor the wave-process: one commit per item/phase.

**Rule 8 — Handoff protocol.** Fill in the Section 7 template and return it. Push your lane branch
(`git push -u origin <branch>`); the lead merges. Do NOT push to master.

---

## SECTION 3 — FOUNDATION WAVE (serial — lead runs on master)

**Strategy: additive + isolated.** The only serial-first work is a Lane B data-loss fix. It exports
NO new contracts the lanes import — lanes consume EXISTING store interfaces (documented below for
citation). Because the fix touches only frozen App.* files no lane owns, lanes may fork from current
master immediately; the lead lands the fix concurrently and it is on master before final integration.

### Foundation item — Snapshots cross-scene restore corruption (Lane B, lead)
- **Bug:** restoring a snapshot for a scene opened via the binder context-menu (while a *different*
  scene is the active editor) writes the restored content to the ACTIVE scene, not the intended one.
  Data-loss. Source: `src/App.snapshots.ts` (snapRestore / snapTakeFromMenu path), `src/db/snapshotStore.ts`.
- **Lead process:** Lane B B0–B5 — reproduce via CDP smoke, instrument, confirm the scene-id
  threading defect, single targeted fix + regression test, re-verify via CDP, clean up.
- **Forbidden to lanes:** `src/App.snapshots.ts`, `src/db/snapshotStore.ts` — Lane 3 owns the
  inspector History UI (`HistoryRail.tsx`) but NOT the restore logic.

### Existing contracts the lanes consume (cite these in lane plans — already on master)
- **`BinderStore`** (`src/db/binderStore.ts`): `moveScene(sceneId, toFolderId, toIndex)`,
  `setSceneStatus(sceneId, status: SceneStatus)`, `setSceneSynopsis(sceneId, synopsis|null)`,
  `renameScene`, `listProjects`, `createProject`, `loadProject` — Lanes 1 consume; do not modify signatures.
- **`SceneStatus`** (`src/lib/status.ts`): `"blank" | "outline" | "draft" | "revise" | "final"`.
- **`LabelStore`** (`src/db/labelStore.ts`): full label CRUD + `getAllSceneLabels()` — Lane 1 (outliner).
- **`StoryBibleStore`** (`src/db/storyBibleStore.ts`): `listCharacters`, `listLocations`,
  `createCharacter`, `createLocation`, `replaceSceneLinks`, `loadSceneEntities`, `findScenesForEntity`
  — Lane 3 (inspector) consumes for the link-picker.
- **`SnapshotStore`** (`src/db/snapshotStore.ts`): `listSnapshots`, `takeSnapshot` — read-only to lanes.

### App freeze-wiring summary (what already exists when lanes fork)
- `AppView = "editor" | "bible" | "cork" | "outline" | "entry"` (`App.state.ts`). No lane adds a view.
- `useModalFlags` (`App.state.ts`) holds every overlay open/close boolean. New modal flags (e.g.
  inspector link-picker, synopsis editor) are added HERE by the lead on merge from each lane's prop contract.
- `OverlayStackProps` / `OverlayStack` (`App.overlays.tsx`) — overlay render tree, lead-owned.
- `useAppContentSlots` (`App.content.tsx`, degree-19 hotspot) — wires every panel slot, lead-owned.

---

## SECTION 4 — MANIFEST + COVERAGE CHECK (mandatory gate — lead ran before creating worktrees)

> Optional advisory gates get skipped. This gate is structural — UI work ships with gaps without it.
> Manifest source: `design-reference/` (canon), NOT the existing implementation.

| Item | Subsystem | State/Variant | Interaction | Lane |
|---|---|---|---|---|
| Project-switcher dropdown (`.proj-menu`/`.proj-item`) | Binder | closed / open / active-item check | click toggle; click item→switch; "New manuscript…" | **1** |
| Chapter row collapse (`.chapter-row.closed` + chevron) | Binder | open (default) / closed | click row → toggle; persist open state | **1** |
| Scene status glyph (`.scene-status`, 5 statuses) | Binder + Outliner | blank/outline/draft/revise/final | click dot → status picker | **1** (verify binder done; add outliner render+picker if missing) |
| Outliner drag-reorder (drag handle) | Outliner | resting / dragging / drop | drag row → `BinderStore.moveScene` | **1** |
| Scene header chrome (eyebrow + H1 + byline) | Editor | static | click status label → picker | **2** |
| Editor empty-state placeholder | Editor | empty doc | TipTap Placeholder extension | **2** |
| Auto-link "Find mentions" (context-menu + peek "Find") | Editor | inert→active | click → open Find&Replace prefilled | **2** |
| Inspector synopsis edit (pencil) | Inspector | view / editing | click pencil → edit synopsis → save | **3** |
| Inspector add/link character + location (InspPicker) | Inspector | empty / list / picker-open | "+"→create+open; "Link a…"→picker→`onLinkScene` | **3** |
| StatusBar live data (scene/manuscript words, goals, backup) | StatusBar | dashes → live | display-only; lead wires data | **3** |
| Detection wiring integration coverage | Detection (test) | n/a | new test file, no UI | **3** |
| Screen-ports visual polish (4 screens, `app.css`) | All screens | cosmetic | — | **LEAD post-merge** |
| Transparent/floating window aesthetic | Window shell | square→floating | — | **LEAD post-merge** |

**Coverage assertion:** every manifest item maps to exactly ONE owner. No dispatch gaps, no
ownership conflicts. Shared-file edits (App.*, app.css, tokens.css, migrations, tauri.conf.json,
shell/*) are all assigned to the LEAD (frozen to lanes) per Section 2 Rule 5. **Gate decision: PROCEED.**

---

## SECTION 5 — PARALLEL LANES (fork from current master)

Worktree creation (lead runs these; sibling dirs to the repo):

```
git worktree add "C:/Web App/writing-wave29-binder-tree"     -b wave-29-binder-tree
git worktree add "C:/Web App/writing-wave29-editor"          -b wave-29-editor
git worktree add "C:/Web App/writing-wave29-inspector-chrome" -b wave-29-inspector-chrome
```

| Wave | Worktree / branch | Owns (disjoint) | Source canon | Plan cmd | Reviewer |
|---|---|---|---|---|---|
| 29 | `writing-wave29-binder-tree` / `wave-29-binder-tree` | `src/binder/`, `src/features/outliner/` | `design-reference/binder.jsx`, `outliner.jsx`, `OUTLINER-SPEC.md` | `/wave-plan-lite` | single |
| 29 | `writing-wave29-editor` / `wave-29-editor` | `src/editor/` (+ `extensions/`) | `design-reference/canvas.jsx`, `AUTOLINK-SPEC.md` | `/wave-plan-lite` | single |
| 29 | `writing-wave29-inspector-chrome` / `wave-29-inspector-chrome` | `src/inspector/`, `src/shell/StatusBar.tsx`, `src/test/` (new) | `design-reference/inspector.jsx`, `chrome.jsx` | `/wave-plan-lite` | single |

### Lane 1 — Binder & tree ops

**a. Owns:** `src/binder/`, `src/features/outliner/`. May additively extend `LabelStore`
(`src/db/labelStore.ts` + both impls) if needed. Consumes existing `BinderStore` (no signature changes).

**b. Scope:**
- **Chapter collapse** — add per-chapter `open` state + toggle handler; conditionally render the
  scene list; rotate the chevron. The `.chapter-row.closed` CSS already exists (`app.css`, do not
  edit it). Persist open/closed per chapter (localStorage key, your choice — document it). Canon:
  `design-reference/binder.jsx:58–95`.
- **Project-switcher custom dropdown** — replace the native `<select>` in `ProjectSwitcher.tsx` with
  the custom overlay dropdown (`.proj-menu` / `.proj-item` / `.cm-backdrop`): click-outside to close,
  keyboard nav, active-project checkmark, "New manuscript…" row. CSS exists unused (`app.css:612–634`).
  Canon: `design-reference/binder.jsx:3–41` (`ProjectSwitch()`).
- **Scene status dots — VERIFY & CLOSE** — binder already renders the dot (`BinderCrud.tsx:192`).
  Confirm it matches canon (`binder.jsx:48–49`, 5 statuses, click→picker). If the binder is correct,
  mark this follow-up resolved in your handoff. THEN add the same status dot + click-to-pick to the
  **outliner** scene rows if missing (`outliner.jsx:41–68`). `setSceneStatus` already exists.
- **Outliner drag-reorder** — wire the existing drag handle to dnd-kit (already a dep, used by
  corkboard) → call `BinderStore.moveScene(sceneId, toFolderId, toIndex)` (exists + tested). Canon:
  `OUTLINER-SPEC.md` §known-follow-up.

**c. Contracts consumed:** `BinderStore.moveScene/setSceneStatus/renameScene` (`src/db/binderStore.ts`),
`SceneStatus` (`src/lib/status.ts`), `LabelStore` (`src/db/labelStore.ts`).

**d. Walking-skeleton note:** not applicable (no new architectural surface; dnd-kit already wired in corkboard).

**e. Forbidden / already-done:**
- **Forbidden:** all `App.*`, `src/styles/app.css`, `src/styles/tokens.css`, `src/db/migrations*.ts`,
  `src/shell/*`. ⚠ **NO schema migration** — scene `status` already persists; do not add a column.
- ⚠ **Already done — do NOT rebuild:** the binder status-dot RENDER (verify only). `moveScene` store
  method (exists + tested — just call it).

> **Lead integrates on merge:** any new binder→App callback (e.g. project-switch already wired via
> `useProjectActions`) — confirm your prop contract; the lead threads it. State your contract and stop.

### Lane 2 — Editor / canvas

**a. Owns:** `src/editor/` (incl. `extensions/`). Consumes `SceneDocStore` via existing
`bindPersistence` (do not touch the yjs binding layer).

**b. Scope:**
- **Scene header chrome** — render the chapter eyebrow + scene H1 + byline (word count, character/
  location counts) above the prose. The Editor currently gets only `doc`; it needs scene metadata.
  **Expose a prop contract** (`EditorHeaderProps`: `chapterTitle`, `sceneTitle`, `status`, `words`,
  `charCount`, `locCount`) — the LEAD supplies these from App on merge. Build the component to accept
  optional+guarded props (render nothing if absent — never make them required, per the lead-call-site
  rule). Canon: `design-reference/canvas.jsx:58–79, 107–121`.
- **Empty-state placeholder** — add TipTap's Placeholder extension (research current API via ctx7
  before wiring — TipTap v3) so an empty scene shows a typing cue. Canon: `canvas.jsx`.
- **Auto-link "Find mentions"** — the context-menu item and peek-card "Find" currently fire mock
  toasts. Wire them to open Find & Replace prefilled with the entity name. Find&Replace lives in
  `src/features/findreplace/` (NOT yours) and mounts via `App.overlays.tsx` (frozen). **Expose a
  callback prop** `onFindMentions(entityName: string)` from the AutoLink extension/peek; the LEAD
  wires it to open the overlay prefilled. Canon: `AUTOLINK-SPEC.md`.

**c. Contracts consumed:** `SceneDocStore` (read-only via existing binding); `StoryBibleStore`
entity names for auto-link (already available in the extension context).

**d. Walking-skeleton note:** not applicable.

**e. Forbidden / already-done:**
- **Forbidden:** all `App.*`, `src/features/findreplace/`, `src/styles/*`, the yjs binding layer
  (`src/yjs/`), `src/shell/*`.
- ⚠ **Already done — do NOT rebuild:** Find & Replace itself (exists, wave-28); you only emit the
  `onFindMentions` callback. The AutoLink detection/underline (exists); you wire the "Find" affordance only.

> **Lead integrates on merge:** thread scene metadata into `EditorPane` (`App.content.editor.tsx`);
> wire `onFindMentions` → `FindReplace` overlay open+prefill (`App.overlays.tsx` + `useModalFlags`).
> State both prop contracts in your handoff and stop.

### Lane 3 — Inspector & chrome

**a. Owns:** `src/inspector/`, `src/shell/StatusBar.tsx` (display-only component), `src/test/` (new
test file). Consumes `StoryBibleStore` (read for picker) — additive methods only if genuinely needed.

**b. Scope:**
- **Inspector entity interactions** — the add-character / link-character / synopsis-edit buttons
  render but have no handlers. Build: (1) the **InspPicker** link modal (`design-reference/inspector.jsx:107–130`)
  — filterable candidate list, click→link, Esc→close; (2) synopsis inline edit (pencil → editable →
  save via `BinderStore.setSceneSynopsis`). Expose prop contracts for the picker open/close + onLink
  + onCreateEntity; the LEAD wires the modal flags + handlers in App. Canon: `inspector.jsx:55–88, 188–207`.
- **StatusBar live data** — `StatusBar.tsx` currently shows `—`. It is display-only and receives
  `sceneWords`, `manuscriptTotal`, `goalProgress`, `backupStatus` as props. Define the **prop
  contract** and render all four live; the LEAD computes + supplies the data from App (Yjs observer
  for scene words, SQL aggregate for manuscript, goals store, backup timestamp). Canon: `chrome.jsx:70–107`.
- **Detection-wiring integration coverage** — add a new test file
  `src/test/appDetectionIntegration.test.tsx` covering `App.detection.ts` wiring (`onSaved`→`linkScene`,
  `onEntitiesChanged`→`rescanProject`). Test against `App.detection.ts` (frozen — you TEST it, you do
  not edit it). Use the in-memory store impls for the seam.

**c. Contracts consumed:** `StoryBibleStore.listCharacters/listLocations/createCharacter/createLocation/replaceSceneLinks`
(`src/db/storyBibleStore.ts`), `BinderStore.setSceneSynopsis`, in-memory store impls for the detection test.

**d. Walking-skeleton note:** not applicable.

**e. Forbidden / already-done:**
- **Forbidden:** all `App.*` (incl. `App.detection.ts` — test only, don't edit; and `App.snapshots.ts`
  — the lead's foundation fix lives there), `src/styles/*`, `src/shell/AppShell.tsx`/`TitleBar.tsx`,
  `src-tauri/tauri.conf.json`.
- ⚠ **Already done — do NOT rebuild:** the snapshots History UI render (`HistoryRail.tsx` exists);
  the snapshots RESTORE bug is the lead's foundation fix — do not touch it.

> **Lead integrates on merge:** wire inspector picker/synopsis modal flags + handlers (`App.state.ts`
> `useModalFlags`, `App.content.tsx`); compute + pass StatusBar data props from App. State your prop
> contracts in the handoff and stop.

---

## SECTION 6 — MERGE ORDER (lead)

1. **Foundation (snapshots fix)** — lands on master first (or concurrently; it is disjoint). Gate:
   `cd 'C:/Web App/writing' && npm run lint && npx tsc --noEmit && npm run test`. Rationale:
   stabilizes the base; data-loss fix should not wait behind UI lanes.
2. **Lane 2 — editor** (`wave-29-editor`) — merge first of the lanes. Rationale: smallest App.* wiring
   surface (two callbacks), no store-interface edits → lowest conflict risk on a fresh base.
   `git merge --no-ff wave-29-editor` → gate (below) → integration commit (wire EditorPane metadata +
   `onFindMentions`).
3. **Lane 1 — binder-tree** (`wave-29-binder-tree`) — merge second. Rationale: self-contained
   (binder + outliner dirs), minimal App.* wiring. May carry an additive `LabelStore` method.
   `git merge --no-ff wave-29-binder-tree` → gate → integration commit (any new binder callbacks).
4. **Lane 3 — inspector-chrome** (`wave-29-inspector-chrome`) — merge LAST. Rationale: largest App.*
   wiring surface (picker + synopsis modal flags + StatusBar data plumbing) → merges onto the most
   stabilized base. `git merge --no-ff wave-29-inspector-chrome` → gate → integration commit.

**Post-merge gate (lead, in the main checkout — NOT a worktree path):**
```
git merge --no-ff <branch>
cd 'C:/Web App/writing' && npm run lint && npx tsc --noEmit && npm run test
# Then the integration commit: wire the lane's prop contract into App.* per its handoff.
```

**After all 3 lanes merged + integrated:**
1. **Lead post-merge polish pass (serial, live oracle):**
   - Screen-ports visual-polish — side-by-side against `design-reference/*.jsx` via CDP smoke;
     edit `app.css`/`tokens.css` + component spacing across the 4 screens.
   - Transparent/floating window aesthetic — `src-tauri/tauri.conf.json` `transparent:true` +
     uncomment `.win @media` CSS; validate on Windows/WebView2 via live run (risk-gated).
2. **Full CDP smoke** of every touched surface (first human-grade UI verification) — binder collapse,
   project dropdown, outliner drag (needs a human drag — dnd-kit), editor header + placeholder,
   auto-link find, inspector picker + synopsis, statusbar live counts, snapshots restore (the fix).
3. **Wrap** — `/review` (mechanical) + adversarial attack-diff at wave granularity → ship v0.3.0
   (minor: feature-completion wave) → wrap-team (follow-up audit closes the 13, decisions, gotchas,
   HANDOFF). Then `git worktree remove` + `git branch -d` each lane.

---

## SECTION 7 — HANDOFF FORMAT (each lane returns this to the lead)

```
## Wave 29 <lane> — handoff for merge
- Branch: wave-29-<slug>   ·   Plan: roadmap/wave-29-<slug>.md
- Gates: lint <PASS/FAIL> · tsc <PASS/FAIL> · touched tests <N pass>
- Reviewer verdict: <PASS/FLAG/BLOCK + one-line summary>
- What shipped: <2-4 bullets>
- Files touched: <list — confirm all within owned dirs + additive store only>
- NEW store methods added (additive, if any): <signatures + contract-test names>
- COMPONENT PROP CONTRACT (what the lead must supply on integration): <exact props + types>
- ⚠ Needs lead's eyes post-merge: <every behavior only a human can confirm — drag-reorder,
  dropdown click-outside, hover peek, status-picker render, synopsis edit, live counts, etc.>
- Follow-ups resolved/obsolete found: <e.g. scene-status-dots already done in binder>
- Flags / deviations / anything the lead should know before merging: <…>
```

**"Needs lead's eyes post-merge" is DEFAULT-ON** for all lanes — no project visual-regression CI exists.
