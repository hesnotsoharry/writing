---
status: PLANNED
created: 2026-06-04
---

# Wave 18: binder-canon

## Plan

### Status

PLANNED · canon-polish lane (parallel batch, forks post-Wave-17) · drafted 2026-06-04 · reviewer tier: single

### Goal

After this wave, `src/binder/*` renders the canon binder from `design-reference/binder.jsx` + `menu.jsx`
instead of the current bare-bones tree. The native `<select>` project switcher becomes the
cover-card `ProjectSwitch` dropdown; scene rows show a status dot (or Final check) + a hover/active
word-counter; chapter headers show a live scene-count and collapse via a rotating twist chevron;
"New chapter" moves to a bottom dashed button (with a small `+` in the section head); the
always-visible inline ✎/× icons are gone and **every mutation lives behind a right-click context
menu** (built with the Wave-17 `buildSceneMenu`/`buildChapterMenu`), with double-click-to-rename
retained; and a quick-notes footer sits at the binder bottom wired to the existing
`onOpenQuickNotes`/`onOpenArchive` callbacks. Scene status changes persist via a newly-threaded
`onSetSceneStatus` callback (store method already exists). Verification is automated only
(lint + tsc + Vitest/RTL component tests) — no human UI smoke until all lanes merge.

### Scope

**In scope (owned dir: `src/binder/*`):**
- `src/binder/ProjectSwitcher.tsx` — rebuild as canon `ProjectSwitch` (cover graphic + title +
  "type · N words" subtitle + dropdown listing projects w/ checkmark on active + "New manuscript…").
- `src/binder/BinderCrud.tsx` — rebuild `SceneRow` (status dot/check via `STATUS_META`, `.scene-words`
  counter, right-click `buildSceneMenu`, double-click rename; remove ✎/× icons) and
  `ChapterHeader`/`ChapterDisplay` (`.twist` chevron + open/onToggle, `.ch-count` scene count,
  right-click `buildChapterMenu`; remove ✎/+/× icons). Extend `BinderCallbacks` with `onSetSceneStatus`.
- `src/binder/Binder.tsx` — chapter collapsibility state + conditional scene render, "New chapter"
  relocation (bottom `.add-chapter` dashed button + small `+` in `.bsection-head`), `.binder-foot`
  quick-notes footer, mount `BinderToast` provider + `<Toast>`, pass active-project word count to
  `ProjectSwitch`, thread optional `quickCount`/`archivedCount`.
- `src/binder/binderToast.tsx` (NEW) — tiny local toast context (provider + `useBinderToast`) so binder
  components can fire "coming in a later wave" stubs; no global toast exists.
- Component tests under `src/binder/*.test.tsx` (NEW — binder currently has zero tests).

**Authorized single-file boundary edit (outside owned dir, approved by Cole 2026-06-04):**
- `src/App.handlers.ts` — add `onSetSceneStatus: (id, status) => binderStore.setSceneStatus(...).then(doReload)`
  to `buildCrudCallbacks`. This is the ONLY non-`src/binder/*` edit. `App.content.tsx` passes the
  `callbacks` object through unchanged, so no frozen-file edit is needed.

**Out of scope:**
- Real Duplicate (no store method; `src/db` frozen) → menu item fires a local toast stub. Foundation follow-up.
- Real Archive (store has no archive method; callbacks are no-op stubs) → menu item wired to the existing
  `onArchiveScene`/`onArchiveChapter` callbacks (currently no-op). Foundation follow-up.
- Real numeric `quickCount`/`archivedCount` (App passes neither; only a `hasQuickItems` boolean exists) →
  footer renders gracefully when undefined (no badge / Archived button hidden). Foundation follow-up.
- Export (Wave 23) → menu item fires the canon toast stub.
- Per-project word counts for NON-active projects in the dropdown (no per-project tree available) →
  subtitle shows type only for inactive projects. Foundation follow-up.
- Any `src/db/` change, any migration, any edit to App.tsx/App.content.tsx/App.state.ts/App.overlays.tsx/TitleBar.tsx.
- CSS — `app.css`/`tokens.css` are consume-only; every canon class already exists.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | `ProjectSwitch` rebuild | sonnet-implementer | pyramid · internal-only · Replace `<select>` in `ProjectSwitcher.tsx` with canon dropdown (`.proj-btn`/`.proj-cover`/`.proj-meta`/`.proj-menu`/`.proj-item`/`.proj-new`). Accept optional `activeWords?: number` prop for subtitle; `sub(p)` = `(type==="novel"?"Novel · ":"Collection · ") + words.toLocaleString() + " words"` (active project only; inactive → type label only). Checkmark `Icon name="check"` on active; "New manuscript…" calls `onCreateProject`. Open/close via local state + `.cm-backdrop`. RTL test: renders active title, opens menu, switch + new fire callbacks. | Cole's eyes post-merge: cover-card renders, dropdown opens/positions, subtitle reads correctly. |
| 2 | Scene row + chapter header rebuild + status threading | sonnet-implementer | trophy · cross-boundary (App.handlers.ts) · **First deliverable = ONE working right-click menu end-to-end (scene Rename) before adding all items** — ContextMenu has zero live consumers, this is its first mount. Then: status dot/check (`STATUS_META[normalizeStatus(scene.status)]`, display-only, `.scene-dot`/`.scene-check`), `.scene-words` counter (`scene.word_count.toLocaleString()` or "—"), remove ✎/× from `SceneDisplay`, per-row `useState<MenuDescriptor\|null>` + `<ContextMenu>` built via `buildSceneMenu` (Rename→inline edit; Set status→`onSetSceneStatus`; Duplicate/Export→`useBinderToast` stub; Archive→`onArchiveScene`; Delete→`window.confirm`+`onDeleteScene`). Same for `ChapterHeader`/`ChapterDisplay`: `.twist` chevron (accept `open`/`onToggle` props), `.ch-count`={scenes.length}, remove ✎/+/× , `buildChapterMenu`. Add `onSetSceneStatus` to `BinderCallbacks` + thread in `App.handlers.ts`. | Cole's eyes post-merge: right-click opens canon menu; Set-status persists + dot recolors; double-click renames; no inline icons; chapter scene-count correct. |
| 3 | Binder shell: collapsibility, footer, New-chapter, toast mount | sonnet-implementer | pyramid · internal-only · `binderToast.tsx` provider + `<Toast>` mounted in `Binder`. `DraggableChapterSection` holds `open` state (default true), renders `ChapterSceneList` only when open, passes `open`/`onToggle` to `ChapterHeader`. Relocate "New chapter": small `+` in `.bsection-head` Manuscript head + bottom dashed `.add-chapter` button. `.binder-foot` footer: "Quick notes" `.foot-btn` (`Icon inbox`) → `onOpenQuickNotes`, badge when `quickCount>0`; "Archived" `.foot-btn` (`Icon square`) shown only when `archivedCount>0` → `onOpenArchive`. Pass `activeWords` (sum of `tree` scene `word_count`) to `ProjectSwitch`. RTL tests: collapse toggle hides/shows scenes; footer badge logic; New-chapter button fires `onCreateChapter`. | Cole's eyes post-merge: twist rotates + scenes collapse; footer renders at bottom; New-chapter at bottom + section `+`. |

### Acceptance criteria

- [ ] `ProjectSwitcher.tsx` renders the canon cover-card button + dropdown (no native `<select>`); active project ticked; "New manuscript…" fires `onCreateProject`; active subtitle reads "Novel · N words".
- [ ] Scene rows render a status dot colored by `STATUS_META` (Final → check icon), a `.scene-words` counter, and NO inline ✎/× buttons.
- [ ] Right-clicking a scene opens `buildSceneMenu`; "Set status" submenu ticks current status and changing it calls `onSetSceneStatus` (threaded to `binderStore.setSceneStatus` + reload).
- [ ] Right-clicking a chapter opens `buildChapterMenu`; chapter header shows `.ch-count` = `scenes.length` and a `.twist` chevron.
- [ ] Double-click still renames scene + chapter; "Rename" menu item also enters inline edit.
- [ ] Chapter collapse: clicking the header toggles scene visibility (scenes render only when open).
- [ ] "New chapter" is a bottom dashed `.add-chapter` button + a small `+` in the Manuscript section head; both fire `onCreateChapter`.
- [ ] `.binder-foot` footer renders "Quick notes" (→ `onOpenQuickNotes`); "Archived" appears only when `archivedCount>0` (→ `onOpenArchive`); counts degrade gracefully when undefined.
- [ ] Export + Duplicate menu items fire a local toast (no crash); Archive fires the existing callback.
- [ ] `npm run lint` + `tsc` (`npm run build` typecheck) + touched Vitest tests all green.

### Files the next agent should read first

1. `roadmap/canon-polish-coordination.md` § "Lane 18 — Binder" + GLOBAL RULES — scope contract + ownership boundary.
2. `design-reference/binder.jsx` — canon target for ProjectSwitch, SceneRow, Chapter, Binder, footer.
3. `design-reference/menu.jsx` — canon ContextMenu/MenuItems/RenameInput/Toast shapes (already ported).
4. `src/binder/{Binder,BinderCrud,ProjectSwitcher,BinderDrag,buildTree}.tsx` — current state (owned).
5. `src/lib/status.ts` + `src/components/menu/sceneMenu.ts` + `src/components/menu/ContextMenu.tsx` — Wave-17 contracts consumed (STATUS_META/STATUS_ORDER/normalizeStatus, buildSceneMenu/buildChapterMenu, MenuDescriptor/MenuItem).
6. `src/App.handlers.ts` + `src/App.content.tsx` — the callbacks contract + Binder mount (content.tsx FROZEN; handlers.ts gets the one authorized edit).
7. `src/components/menu/Toast.tsx` + `src/components/Icon.tsx` — presentational Toast + valid IconNames (chevDown/chevRight/check/plus/inbox/square/x/focus all exist).

### Note to the implementer

This is a **wiring + presentation** wave, not a build-from-scratch: the CSS classes, the ContextMenu
component, the menu builders, and the status model all already exist — your job is to consume them to
match `binder.jsx`. Resist two temptations: (1) writing any CSS (every class exists — flag the lead if
one is missing, don't invent), and (2) editing frozen App files (only `App.handlers.ts` gets the single
authorized `onSetSceneStatus` thread; `App.content.tsx` passes `callbacks` through untouched). The
status **dot is display-only** — all mutation is behind right-click, per the coordination doc. Several
features are deliberately graceful stubs this wave (Duplicate, Archive, footer counts) because
`src/db` is frozen — wire them to their stub/no-op path, don't try to implement them.

First step: verify the `## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate the Observation-column point in your own words and describe
what you observed. **You cannot run the Tauri app** (browser smoke hangs; no Tauri runtime) — so for
every phase, say so explicitly and substitute: (a) the passing RTL component test, and (b) a
line-by-line diff comparison against the matching `design-reference/*.jsx` region. Tests passing at the
unit boundary is necessary but not sufficient — name what still needs Cole's eyes post-merge.

## Locked decisions

## Decision 1: Set-status callback threading
**Context:** Right-click "Set status" (the headline mutation) needs a callback App doesn't currently thread.
**Pick:** Add `onSetSceneStatus` to `BinderCallbacks` (owned file) and implement it in `src/App.handlers.ts` → `binderStore.setSceneStatus(id, status).then(doReload)`.
**Rationale:** Store method already exists; only the thread is missing. `App.content.tsx` passes `callbacks` through unchanged, so no frozen-file edit. Approved by Cole 2026-06-04 as a one-file boundary stretch.
**Consequences:** One edit outside `src/binder/*`; the lead should be aware at merge.
**Enforcement:** advisory-only (handoff flag + this decision record).

## Decision 2: Graceful stubs for db-gated features
**Context:** Duplicate, Archive, and numeric quick/archived counts all require `src/db` changes, which is frozen this sweep.
**Pick:** Duplicate/Export → local toast stub; Archive → wired to existing (no-op) `onArchive*` callbacks; footer counts → render gracefully when `undefined` (no badge / Archived hidden).
**Rationale:** Maximizes shippable UI within the frozen boundary; the wiring lights up automatically once the foundation adds the methods. Approved by Cole 2026-06-04.
**Consequences:** These three features look present but are inert until a future foundation wave fills them. Flagged in handoff + Follow-up candidates.
**Enforcement:** advisory-only (handoff + follow-up candidates).

## Decision 3: Status dot is display-only
**Context:** Canon `SceneRow` makes the dot clickable to cycle; coordination doc says all mutations go behind right-click.
**Pick:** Dot is display-only (tooltip = status label); status changes only via the right-click "Set status" submenu.
**Rationale:** Coordination doc is explicit ("all mutations behind right-click"); avoids needing a cycle handler. Minor deviation from canon click-to-cycle.
**Consequences:** Clicking a dot does nothing (canon cycles). Flagged for Cole.
**Enforcement:** none (convention).

## Decision 4: Local binder toast (no global toast)
**Context:** No global `showToast` exists; only Settings has a local one. Binder needs to fire "coming soon" stubs.
**Pick:** New `src/binder/binderToast.tsx` — a small context (provider + `useBinderToast`) mounting the shared `<Toast>` component, owned entirely within `src/binder/*`.
**Rationale:** Keeps the stub toasts inside the owned dir; no App/frozen-file changes; reuses the existing presentational `Toast`.
**Consequences:** Toast is scoped to the binder pane (fine for these messages).
**Enforcement:** none (convention).

## Decision 5: Delete keeps a confirm
**Context:** Canon deletes immediately and offers an Undo toast; no undo/restore store path exists this wave.
**Pick:** Right-click "Delete" keeps a `window.confirm` guard (no undo available).
**Rationale:** Without undo, an instant delete is a data-loss footgun; confirm is the pragmatic safety net. Deviates from canon (which has no confirm but has undo).
**Consequences:** Extra confirm dialog vs. canon. Flagged for Cole — revisit when an undo path exists.
**Enforcement:** none (convention).

## Status

| Phase | Dispatched | Completed | Commit | Observation hit |
|---|---|---|---|---|

## Follow-up candidates

## Result
