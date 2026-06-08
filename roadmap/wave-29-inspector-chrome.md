---
status: PLANNED
created: 2026-06-08
---

# Wave 29: inspector-chrome

## Plan

### Status

PLANNED · Lane 3 of the wave-29 canon-burndown · target v0.3.0 (lead ships) · drafted 2026-06-08

### Goal

After this lane, the inspector's "Link a character/location" affordance opens the **canon
`InspPicker`** — an inline, autofocused, filterable candidate list with avatar+name rows, click-to-link,
Esc-to-close, and a "Nothing left to link" empty state — instead of the current bare label-only
`ContextMenu`. The bottom `StatusBar` gains a single optional `backupStatus` prop so the lead can feed
real backup state through it, while preserving the honest "Local only" fallback when no status is
supplied (no fabricated "2m ago" timestamps). And `App.detection.ts`'s `useDetectionWiring` hook —
previously untested — gains a dedicated integration test proving `onSaved → setSceneWordCount +
linkScene→replaceSceneLinks` and `onEntitiesChanged → rescanProject` actually fire through the real
detection-sync seam. The synopsis inline-edit (already shipped) is verified, not rebuilt.

### Scope

**In scope:**

- `src/inspector/SceneInspector.tsx` — replace the `ContextMenu`-based picker in `EntityGroup` with an
  inline canon `InspPicker` toggled by a per-group `picking` boolean. Keep linking self-contained
  (component calls `store.replaceSceneLinks` directly — established pattern; no new App wiring).
- `src/inspector/InspPicker.tsx` (NEW) — the filterable candidate picker component (canon
  `inspector.jsx:107–130`).
- `src/inspector/InspPicker.module.css` (NEW) — component-local styles, because the canon `fe-picker*`
  classes are **absent from `app.css`** and Rule 6 forbids editing the shared stylesheet.
- `src/shell/StatusBar.tsx` — add ONE optional `backupStatus?: BackupStatus` prop + render it in the
  backup slot; honest "Local only · {clock}" fallback retained.
- `src/test/appDetectionIntegration.test.tsx` (NEW) — integration coverage for `useDetectionWiring`.

**Out of scope:**

- Synopsis inline edit — **already shipped** (`InspectorSynopsis.tsx` matches canon). Verify-and-mark-
  resolved only; no rebuild. Deferral path: if a defect is found, file under Lane B, not this lane.
- All `App.*` wiring (incl. `App.detection.ts` — test only, do not edit). Lead owns integration.
- Promoting the `fe-picker*` classes into `app.css`. Deferral path: handoff flag → lead post-merge.
- Renaming StatusBar's existing props (`sceneWordCount`, `goal`). Deferral path: never — renaming
  breaks the lead-owned App call site (additive-only per the lane-prop-required rule).
- StatusBar `goalProgress`/manuscript live rendering — **already works**; verify only.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Canon `InspPicker` for entity linking | `sonnet-implementer` | trophy · internal-only (component-local store writes, no boundary crossed) · Extract `InspPicker` (search input autofocus, `candidates.filter` by lowercased name, avatar+name rows, `onPick`/`onClose`, Esc-close, empty state) into `src/inspector/InspPicker.tsx` + `InspPicker.module.css`. In `EntityGroup`, add a `picking` boolean; render `<InspPicker>` when true (candidates = unlinked entities), else the existing "Link a…" button. On pick: `replaceSceneLinks([...links, newLink])` then `onLinked()` + close. Keep `useEntityCreate` ('+' header) unchanged. Synopsis: verify `InspectorSynopsis.tsx` matches canon, no edit. | **Needs lead's eyes:** click "Link a character" → picker opens, autofocused; typing filters; click row links + closes; Esc closes; "Nothing left to link" when empty. |
| 2 | StatusBar `backupStatus` prop | `haiku-implementer` | trophy · internal-only · Add `export interface BackupStatus { state: "local-only" \| "backed-up" \| "syncing" \| "error"; label: string }`. Add optional `backupStatus?: BackupStatus` to `StatusBarProps`. Render: when present, show its `label` + an icon keyed off `state`; when absent, keep the current "Local only · {clock}" honest fallback. Do NOT touch existing prop names or the goal/manuscript render. | **Needs lead's eyes:** with `backupStatus` supplied, the backup slot shows the live label; with it omitted, "Local only · {clock}" still renders. |
| 3 | Detection-wiring integration test | `haiku-test-author` | trophy · cross-boundary (exercises the detection-sync seam end-to-end through in-memory stores) · NEW `src/test/appDetectionIntegration.test.tsx`. `renderHook(() => useDetectionWiring({...}))` with fake stores. Test A: call `onSavedRef.current(sid, 42)` → assert `setSceneWordCount(sid, 42)` AND (via `linkScene`) `replaceSceneLinks` fired for `sid`. Test B: call `onEntitiesChanged()` → assert `rescanProject` ran `listSceneIds` then `replaceSceneLinks` per scene. `beforeEach(vi.resetModules)` + dynamic `import("../App.detection")` per test to dodge the `_sync` module singleton. | **Internal — no UI observation point.** Observation = the new test file passes under `vitest run`. |

Walking-skeleton rule: **not applicable** — no new architectural surface. `InspPicker` is a UI extraction of an existing pattern; the detection seam already exists (this phase only adds coverage).

### Acceptance criteria

- [ ] `src/inspector/InspPicker.tsx` exports an `InspPicker` that renders an autofocused search input,
  filters candidates by case-insensitive name substring, renders avatar+name rows, calls `onPick(c)`
  on row click, calls `onClose()` on Esc, and shows "Nothing left to link." when the filtered list is
  empty.
- [ ] `EntityGroup` opens `InspPicker` (not `ContextMenu`) from the "Link a…" affordance; linking still
  routes through `store.replaceSceneLinks` and refreshes via `onLinked()`.
- [ ] `InspPicker` styling lives in `src/inspector/InspPicker.module.css` (or inline) — `app.css` and
  `tokens.css` are untouched (verified by diff).
- [ ] Synopsis inline-edit verified against canon; marked resolved in handoff; `InspectorSynopsis.tsx`
  unchanged.
- [ ] `StatusBarProps` gains an optional `backupStatus?: BackupStatus`; existing prop names unchanged.
- [ ] StatusBar renders `backupStatus.label` when supplied and the "Local only · {clock}" fallback when
  omitted (no fabricated relative timestamp).
- [ ] `src/test/appDetectionIntegration.test.tsx` exists and asserts both the `onSaved` and
  `onEntitiesChanged` wiring paths; `App.detection.ts` is NOT modified.
- [ ] Gates green in-worktree: `npm run lint` PASS · `npx tsc --noEmit` PASS · `npm run test -- <touched>`
  all pass.

### Files the next agent should read first

1. `design-reference/inspector.jsx` — canon for `InspPicker` (107–130) and its group usage (188–207).
2. `design-reference/chrome.jsx` — canon for `StatusBar` (64–111), incl. the backup slot.
3. `src/inspector/SceneInspector.tsx` — current `EntityGroup` + `useEntityPicker` (the `ContextMenu`
   path being replaced) and `useEntityCreate` (unchanged).
4. `src/inspector/InspectorSynopsis.tsx` — already-shipped synopsis edit (verify, do not rebuild).
5. `src/shell/StatusBar.tsx` — current props + the Wave-25 data-honesty fallback to preserve.
6. `src/App.detection.ts` — the FROZEN hook under test; `useDetectionWiring` shape + the `_sync` singleton.
7. `src/lib/detectionSync.ts` — `createDetectionSync` deps + `linkScene`/`rescanProject` behavior.
8. `src/db/inMemoryBinderStore.ts` + `src/db/inMemoryStoryBibleStore.ts` — store seams for the test.

### Note to the implementer

This is canon burndown, not greenfield: two of three items are already partly done. Resist the
temptation to rebuild the synopsis editor (it's canon-correct) or to "improve" the StatusBar's
goal/manuscript rendering (it works). The one real build is the `InspPicker` — match canon's interaction
shape exactly (autofocus, live filter, Esc, empty state), and because the shared CSS classes don't
exist, keep its styles component-local and flag the lead to promote them later. For StatusBar, the trap
is fabricating a backup timestamp to match the canon mockup's "Backed up · 2m ago" — DON'T; the Wave-25
data-honesty ADR is load-bearing. You CANNOT run the app: every visual behavior goes to "Needs lead's
eyes." First step: verify the `## Locked decisions` section below has its decisions filled in.

Before declaring a phase complete, restate that phase's Observation point in your own words and say what
you actually observed. For Phases 1–2 you cannot observe the rendered UI — say so explicitly and route
it to the lead; do not substitute "tests pass" for runtime observation. Phase 3's observation IS the
test passing (it has no UI surface) — that one is fully verifiable in-lane.

## Locked decisions

> Decisions below cleared the trivial bar (single defensible option each, codebase-native, no
> cross-axis tension) and are recorded inline per `best-practice-spectrum.md` (skip-tier — no
> architect/adversarial cell needed for these).

## Decision 1: InspPicker styling home

**Context:** Canon `InspPicker` needs `fe-picker*` classes that are absent from `app.css`; Rule 6 bars editing shared CSS.  **Pick:** Co-located `src/inspector/InspPicker.module.css` (component-local).  **Rationale:** Rule 6's sanctioned escape hatch for missing shared classes; keeps the lane self-contained and conflict-free with other lanes editing nothing in `app.css`.  **Enforcement:** advisory-only (diff review confirms `app.css`/`tokens.css` untouched; flagged to lead for later promotion).

## Decision 2: Keep self-contained entity linking (no App-wired onLink prop)

**Context:** The brief anticipated exposing `onLink`/`onCreateEntity` props for the lead to wire; the current component already links internally via the store.  **Pick:** Keep linking self-contained inside `SceneInspector`/`EntityGroup`; expose no new App-wired link callbacks.  **Rationale:** The internal pattern already works and is the codebase norm; lifting working store writes into App is churn with no behavior gain and more integration surface for the lead.  **Consequences:** Lead wires nothing new for the picker — less merge work than the brief assumed (reported in handoff).  **Enforcement:** none (convention).

## Decision 3: StatusBar `backupStatus` is additive + optional; existing names frozen

**Context:** Brief lists desired prop names (`sceneWords`, `goalProgress`) that differ from the shipped ones (`sceneWordCount`, `goal`).  **Pick:** Add only `backupStatus?` as a new optional prop; keep all existing names.  **Rationale:** Renaming a lane-owned component's props breaks the lead-owned App call site (lane-prop-required-breaks-lead-call-site); additive-optional is the safe contract.  **Consequences:** Lead supplies `backupStatus` when real backup state exists; until then the honest fallback renders.  **Enforcement:** tsc gate (optional prop = no call-site break).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |

## Follow-up candidates

<!-- DEFAULT empty. Tier-3 triple-gate only. Note: the missing fe-picker* CSS classes are NOT a
follow-up — they are handled in-lane via a component-local CSS module (Decision 1) and flagged to the
lead for optional app.css promotion. No present-harm beyond cosmetic-consistency, fails the VALUE gate. -->

## Result

<!-- filled at ship by wrap team -->
