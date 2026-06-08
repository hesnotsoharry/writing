---
status: PLANNED
created: 2026-06-08
---

# Wave 29: binder-tree

## Plan

### Status

PLANNED · Lane 1 of wave-29 canon burndown · single reviewer · drafted 2026-06-08 · no version bump (lead ships v0.3.0 post-merge)

### Goal

After this wave the binder and outliner finish four dead/partial affordances against `design-reference/` canon, entirely within `src/binder/` and `src/features/outliner/` — no store signature changes, no schema migration. Chapter open/closed state survives an app reload (today it resets to all-open). The project switcher gains full keyboard navigation (it already renders the custom `.proj-menu` dropdown). Clicking a scene's status dot — in both the binder and the outliner — opens a small status picker popover and persists the choice (today the binder dot is inert and the outliner dot emits an ambiguous signal). Outliner rows become drag-reorderable via their existing handle (handle-only, gated to manual sort), mirroring the corkboard's `CorkGroupDnd` pattern and delegating the move to a new optional `onMoveScene` prop the lead wires to `BinderStore.moveScene`.

### Scope

**In scope:**

- `src/binder/Binder.tsx` — `DraggableChapterSection` open-state: replace `useState(true)` with localStorage-backed persistence (new local hook, e.g. `useChapterOpen(chapterId)`).
- `src/binder/BinderCrud.tsx` — `SceneRow` / `SceneStatusIndicator`: add click→status-picker on the binder dot, persisting via the already-wired `callbacks.onSetSceneStatus`.
- `src/binder/ProjectSwitcher.tsx` — `ProjMenu` / `ProjectSwitcher`: keyboard nav (ArrowUp/Down roving highlight, Enter to switch, Escape to close, open on Enter/Space/ArrowDown from the trigger).
- `src/features/outliner/Outliner.tsx` — `RowStatusCell`: click→local status-picker popover, persisting via the existing `h.onStatus(e, {...scene, status})` contract (same path the context-menu set-status already uses).
- `src/features/outliner/Outliner.tsx` (+ a new `src/features/outliner/OutlinerDrag.tsx`) — handle-only drag-reorder mirroring `CorkGroupDnd`; new optional `onMoveScene?: (sceneId, toFolderId, toIndex) => void` prop on `OutlinerProps`; active only when `sort.col === "manual"`.
- New unit tests colocated under `src/binder/` and `src/features/outliner/` for the persistence helper, the keyboard-nav reducer, and the reorder index math.

**Out of scope:**

- All `App.*` files, `src/styles/app.css`, `src/styles/tokens.css`, `src/db/migrations*.ts`, `src/shell/*` — frozen (lead-owned wiring). Defer any needed change to a lead integration note in the handoff.
- New schema migration / `status` column work — scene status already persists end-to-end (verified in coordination doc §1). Defer: not needed.
- Cross-chapter drag in the outliner — mirror the corkboard's per-group containment (reorder within a chapter only). Cross-group moves remain a binder-tree affordance. Defer: future wave if requested.
- The status-picker popover's dedicated CSS — none exists; reuse the existing `ContextMenu` (`.cm-*`) infrastructure. Defer: bespoke `.status-picker` styling is a lead polish item if desired.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Chapter-collapse persistence | sonnet-implementer | honeycomb · internal-only · Replace `useState(true)` in `DraggableChapterSection` with a localStorage-backed `useChapterOpen(chapterId)` hook. Single JSON map under one key (see Decision 1). Read lazily in the `useState` initializer; write in the toggle handler — NO setState-in-effect. Chevron rotation is pure CSS (`.chapter-row.closed .twist`), untouched. | Reload the app → chapters collapsed before reload stay collapsed (lead confirms via CDP; unit test asserts the persistence helper round-trips). |
| 2 | Project-switcher keyboard nav | sonnet-implementer | trophy · internal-only · Add roving `activeIndex` + key handlers to `ProjMenu`/`ProjectSwitcher`. Arrow keys move highlight (incl. the "New manuscript…" row), Enter activates, Escape closes + returns focus to the trigger, trigger opens on Enter/Space/ArrowDown. Focus the menu on open via a ref (DOM side-effect in effect is fine; the lint ban is setState-in-effect only). Extract the index-advance logic to a pure helper for unit test. | Open the dropdown, press ArrowDown/Up → highlight moves; Enter → project switches; Esc → closes (lead confirms via CDP; unit test covers the index reducer). |
| 3 | Status-dot click→picker (binder + outliner) | sonnet-implementer | honeycomb · internal-only · Build the status menu inline from `STATUS_ORDER`/`STATUS_META` (lib/status — read-only import) and render via the existing `ContextMenu`. Binder: add `onClick` (with `stopPropagation`) to the dot in `SceneRow` → picker → `callbacks.onSetSceneStatus(id, s)`. Outliner: `RowStatusCell` onClick → same local picker → `h.onStatus(syntheticEvent, {...scene, status: s})` (identical to the existing context-menu persist path). Do NOT edit `src/components/menu/sceneMenu.ts` (not owned). | Click a binder dot and an outliner dot → 5-status picker opens; pick a status → dot color/check updates and persists across reload (lead confirms via CDP; unit test asserts the picker emits the chosen status to the persist callback). |
| 4 | Outliner drag-reorder | sonnet-implementer | pyramid · internal-only · New `OutlinerDrag.tsx` mirroring `CorkGroupDnd`: one `DndContext`+`SortableContext` per chapter group, optimistic `liveIds`, render-phase clear guard, `dragEnd → onMoveScene(aid, folderId, toIndex)` with `toIndex = final.indexOf(aid)`. Handle-only drag: spread `listeners`/`attributes` on the `.otl-handle` element, `ref` on the row — the row keeps its clickable title + contentEditable synopsis. Wrap rows in DnD only when `onMoveScene && sort.col === "manual"`; otherwise render plain (handle inert). New optional `onMoveScene?` prop on `OutlinerProps`. Unit-test the index-computation helper. | In manual sort, drag an outliner row by its handle → order changes and persists (DnD is human-only — lead confirms the live drag via CDP; unit test covers the reorder index math). |

Walking-skeleton rule: **not applicable** — dnd-kit is already wired in-repo (`BinderDrag.tsx`, `Corkboard.tsx`); Phase 4 mirrors an existing pattern, introducing no new architectural surface.

### Acceptance criteria

- [ ] Collapsing a chapter, reloading the app, and reopening shows that chapter still collapsed; an untouched chapter defaults to open.
- [ ] The chapter-open persistence helper round-trips through localStorage under a single documented key and tolerates absent/corrupt JSON (defaults to open).
- [ ] In the open project dropdown, ArrowDown/ArrowUp move the highlight across all rows incl. "New manuscript…"; Enter activates the highlighted row; Escape closes and returns focus to the trigger.
- [ ] Clicking the binder status dot opens a 5-status picker; choosing a status calls `onSetSceneStatus` with that status and does NOT also select/deselect the row (propagation stopped).
- [ ] Clicking the outliner status dot opens the same picker; choosing a status calls `h.onStatus` with the new-status scene (the existing persist contract).
- [ ] In manual sort, dragging an outliner row by its handle reorders it within its chapter and calls `onMoveScene(sceneId, folderId, toIndex)` with the landed index; the title-click and synopsis edit still work (handle-only).
- [ ] Outliner drag is inert when `sort.col !== "manual"` or when `onMoveScene` is absent.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the touched-file tests all pass; no file outside `src/binder/` and `src/features/outliner/` is modified.

### Files the next agent should read first

1. `roadmap/canon-burndown-coordination.md` — the operational contract (Section 5 → Lane 1 brief; GLOBAL RULES Section 2).
2. `src/binder/Binder.tsx` — `DraggableChapterSection` holds the chapter open-state (Phase 1 target).
3. `src/binder/BinderCrud.tsx` — `SceneRow` / `SceneStatusIndicator` (Phase 3 binder target).
4. `src/binder/ProjectSwitcher.tsx` — the already-built custom dropdown (Phase 2 target).
5. `src/features/outliner/Outliner.tsx` — `RowStatusCell` (Phase 3 outliner) + the rows/groups (Phase 4 drag target).
6. `src/features/corkboard/Corkboard.tsx` — `CorkGroupDnd` / `useGroupDragHandlers` — the exact pattern to mirror for Phase 4.
7. `src/lib/status.ts` — `STATUS_ORDER` / `STATUS_META` for building the picker.
8. `design-reference/binder.jsx`, `outliner.jsx`, `OUTLINER-SPEC.md` — canon to review line-by-line against.

### Note to the implementer

The spirit of this lane is **finishing affordances, not rebuilding them**. Three of the four items already have most of their machinery — resist the urge to rewrite working code. Item 1 already toggles and rotates the chevron; you are only adding persistence. Item 2's dropdown already renders; you are only adding keyboard nav. Item 3's dots already render; you are adding the click→picker affordance. Only Item 4 is net-new, and even it mirrors `CorkGroupDnd` rather than inventing a drag system. First step: verify the `## Locked decisions` section below has its decisions filled in.

You CANNOT see the rendered app (Rule 3 — Tauri runtime + CDP held by the lead). Verify via gates (`lint`, `tsc`, touched tests) AND line-by-line review against the design-reference `.jsx`. Before declaring a phase complete, restate that phase's Observation point in your own words and state plainly what you could and could NOT observe — every one of these four observations is a live-UI behavior (reload persistence, keyboard highlight, picker render, drag) that only the lead can confirm. Do NOT substitute "tests pass" for that runtime observation; list each in the handoff's "Needs lead's eyes" field. Keep new/changed props optional + guarded (the lead's `App.*` call sites must not break — see the `lane-prop-required-breaks-lead-call-site` lesson).

## Locked decisions

> The four decisions below are trivial / in-pattern (skip-tier per `~/.claude/rules/best-practice-spectrum.md` — single defensible option each, no cross-axis tension). They are recorded for the lead's integration context, not as ADR-worthy tensions.

## Decision 1: chapter open-state persistence shape
**Context:** Chapter collapse must survive reload; need a localStorage shape.  **Pick:** A single JSON-map key `writing.binder.openChapters` → `{ [chapterId]: boolean }`; absent entry defaults to open (`true`).  **Rationale:** One key (not N keys) is atomic to read/write and trivial to clear; default-open matches today's behavior so first run is unchanged.  **Enforcement:** none (convention) — documented here + in the hook's JSDoc.

## Decision 2: status picker reuses ContextMenu, not a new popover
**Context:** Canon wants click-dot→status picker; no `.status-picker` CSS exists.  **Pick:** Render the picker via the existing `ContextMenu` with an inline-built 5-status `MenuItem[]`.  **Rationale:** Reuses styled `.cm-*` infra; avoids editing the frozen `app.css` and the non-owned `sceneMenu.ts`.  **Enforcement:** advisory-only (review against canon).

## Decision 3: outliner status persists via existing `h.onStatus` contract
**Context:** Outliner has no direct `setStatus(id,status)` handler — only `h.onStatus`.  **Pick:** The local picker calls `h.onStatus(syntheticEvent, {...scene, status: s})`, identical to the existing context-menu set-status path (`OutlinerMenu.tsx:31-33`).  **Rationale:** Reuses the App-wired persist path the context menu already depends on; adds no new prop the lead must wire.  **Consequences:** The outliner's status persistence remains lead-wired (App supplies `h.onStatus`); flagged in the handoff.  **Enforcement:** none (convention).

## Decision 4: outliner drag gated to manual sort, handle-only, per-group
**Context:** Outliner rows have clickable title + contentEditable synopsis; sorting reorders within chapters.  **Pick:** Mirror `CorkGroupDnd` (per-group `DndContext`); attach drag listeners to the `.otl-handle` only; enable only when `sort.col === "manual"` and `onMoveScene` is provided.  **Rationale:** Whole-row drag would break synopsis editing/title click; dragging while sorted fights the derived order (OUTLINER-SPEC: reorder is manual order).  **Consequences:** Reorder maps to `moveScene(sceneId, sameFolderId, toIndex)`; cross-chapter drag is out of scope.  **Enforcement:** advisory-only.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-08 | 2026-06-08 | (this commit) | Pending lead CDP — reload persistence (unit: 5/5 PASS) |
| 2 | 2026-06-08 | 2026-06-08 | (this commit) | Pending lead CDP — arrow highlight / Enter-switch / Esc-refocus (unit: 25/25 PASS) |
| 3 | 2026-06-08 | 2026-06-08 | (this commit) | Pending lead CDP — dot-click opens picker + persists, row not selected (unit: 35/35 PASS incl. stopPropagation + persist contracts) |
| 4 | — | — | — | — |

## Follow-up candidates

_(empty — mid-wave friction is fixed inline per the scope-creep tiers; lead-owned integration touchpoints are stated in the handoff, not staged as follow-ups.)_

## Result

_(filled at lane handoff / lead merge.)_
