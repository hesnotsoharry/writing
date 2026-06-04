---
status: PLANNED
created: 2026-06-04
---

# Wave 14: goals

## Plan

### Status

PLANNED · parallel feature lane (batch waves 12–16) · drafted 2026-06-04 · branch `wave-14-goals`

### Goal

After this wave, the Goals overlay is a real feature instead of a "coming soon" stub. Opening it
(⌘-trigger or TitleBar) shows the ported design — an on/off toggle, the six-type goal grid, and a
daily-word target field. Toggling goals **on** lights the TitleBar target-icon accent tint (dead until
now), and that on/off state plus the chosen goal-type/target persist to the `goals` table (migration 4)
via a new `SqliteGoalsStore` that mirrors the existing `SqliteBinderStore` pattern. Saving a target
mirrors it into `localStorage["writing.goalTarget"]`, the exact key the wave-9 `SceneInspector` goal
ring already reads — so the ring reflects the user's real target with **no edit to SceneInspector**. A
persistent writing streak (`localStorage["writing.streak"]`) with a pure, unit-tested advance/reset
helper is displayed in the sheet. The lane stays disjoint: it writes only `src/features/goals/`,
`src/db/sqliteGoalsStore.ts`, and the Goals-only forwarding lines in `src/App.overlays.tsx`.

### Scope

**In scope:**

- `src/features/goals/Goals.tsx` — replace the stub with the ported sheet (design-reference/dialogs.jsx
  L123–198): `.scrim`/`.sheet` shell, `.sheet-head`, the `.toggle` (+`.on`), the `.goal-type-grid` of
  six `.goal-type` buttons, the "Target (words / day)" field, the "Counts toward" field, `.sheet-foot`
  Done button. Props become `{ onClose, goalsOn, setGoalsOn }`.
- `src/features/goals/goalTypes.ts` — the `GOAL_TYPES` constant (six entries) ported from the reference.
- `src/features/goals/streak.ts` — pure `advanceStreak(prev, todayISO, metToday)` + `readStreak()`/
  `writeStreak()` localStorage helpers. No React, no DB.
- `src/features/goals/goalStorage.ts` — localStorage mirror helpers: `writeGoalTarget(n)` →
  `localStorage["writing.goalTarget"]`; `readGoalsOn()`/`writeGoalsOn(b)` → `localStorage["writing.goalsOn"]`.
- `src/db/sqliteGoalsStore.ts` — `GoalsStore` interface + `SqliteGoalsStore` impl: `getGoal(projectId)`,
  `upsertGoal({projectId, goalType, target, enabled})`. Follows `SqliteBinderStore` (`getDb()`,
  `db.select`/`db.execute`, `crypto.randomUUID()`, `Date.now()`). One row per (project, goal_type).
- `src/features/goals/*.test.ts(x)` — unit tests for streak logic + store CRUD (mocked `getDb`) +
  a Goals render/toggle component test.
- `src/App.overlays.tsx` — **Goals path only**: destructure `setGoalsOn` (+ `goalsOn` if threaded) and
  forward to `<Goals>`. Do NOT touch the QuickCapture/Inbox `setHasQuickItems` lines (lane 13 owns those).

**Out of scope:**

- DB schema migration — the `goals` table (migration 4) already exists; **no migration 5** (that's the
  Corkboard lane's; two lanes adding "migration 5" would collide). Streak persists to localStorage, not DB.
- Editing `src/inspector/SceneInspector.tsx` — the ring already reads `writing.goalTarget`; mirroring the
  key is the integration seam. Deferral: any ring change is a SceneInspector-owner concern.
- Session-start auto-light of the TitleBar tint — blocked by frozen `App.state.ts` (`goalsOn` is
  `useState(false)`). Deferred to a follow-up (see `## Follow-up candidates`).
- Live "daily goal met" streak auto-advance from the editor — needs an app-wide daily-words localStorage
  signal that does not exist yet (lives in SceneInspector). Deferred to a follow-up.
- The other five goal types' bespoke logic (deadline pace, time-at-desk, etc.) — wave-14 persists the
  selected type and wires the **daily word count** type end-to-end; the rest are selectable + stored but
  their specialized tracking is later polish.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Persistence + pure logic | `haiku-test-author` (pre-impl oracle) → `sonnet-implementer` | honeycomb · internal-only · Build `sqliteGoalsStore.ts` (GoalsStore iface + Sqlite impl, mock-getDb CRUD test), `streak.ts` (pure advance/reset + edge tests), `goalStorage.ts` (localStorage mirror helpers + `goalTypes.ts`). No UI. | Internal — no observation point. Verified by vitest: streak edge cases + store upsert against mocked db. |
| 2 | Goals sheet UI | `sonnet-implementer` | trophy · internal-only · Port dialogs.jsx L123–198 into `Goals.tsx` consuming existing CSS classes (CONSUME-ONLY). Local state for selected type + target; toggle reflects `goalsOn`; render streak from `readStreak()`. Wire Save → `upsertGoal` + `writeGoalTarget` + `writeGoalsOn`. Component test: renders 6 types, toggle flips, save calls store. | Rendered Goals sheet shows toggle, six goal-type cells, target field, streak — observable when the overlay mounts. |
| 3 | Integration wiring | `sonnet-implementer` | pyramid · **cross-boundary** (shared `App.overlays.tsx` + localStorage → wave-9 ring + TitleBar tint) · Forward `setGoalsOn`→`<Goals>` in App.overlays.tsx (Goals line only). Toggle drives `setGoalsOn`. Reconcile streak on open. Acceptance test asserts: save writes `writing.goalTarget`; toggle-on sets `goalsOn` true at the prop boundary. | TitleBar target icon turns accent-colored when goals toggled on; SceneInspector ring uses the saved target. Requires `npm run tauri dev` for full visual confirmation. |

### Acceptance criteria

- [ ] Opening Goals renders the ported sheet: an on/off `.toggle`, the `.goal-type-grid` with all six
      `GOAL_TYPES`, a "Target (words / day)" field, a "Counts toward" field, and a `.sheet-foot` Done
      button — using only pre-existing CSS classes (zero new CSS).
- [ ] Toggling "Goals on" calls `setGoalsOn(true)`; the TitleBar target icon renders
      `style={{ color: "var(--accent)" }}`. Toggling off reverts it to `undefined`.
- [ ] Saving a daily target writes/updates exactly one `goals` row for the project (upsert by
      project_id + goal_type) with the chosen `target` and `enabled`.
- [ ] Saving also sets `localStorage["writing.goalTarget"]` to the chosen target (string of the integer),
      so `SceneInspector.readGoalTarget()` returns it on next read.
- [ ] `advanceStreak` unit tests pass for: first-ever met day → 1; same-day re-call → unchanged;
      consecutive-day met → +1; one-or-more-day gap → reset to 1; not-met day → unchanged.
- [ ] The current streak count renders in the Goals sheet from `localStorage["writing.streak"]`.
- [ ] `npx tsc --noEmit`, `npm run lint`, and `npm run test` (vitest) are green **run from the worktree dir**.
- [ ] `git diff --name-only` touches only `src/features/goals/**`, `src/db/sqliteGoalsStore.ts`, the
      Goals lines of `src/App.overlays.tsx`, and `roadmap/wave-14-goals.md` — no frozen files, no
      `SceneInspector.tsx`, no `migrations.ts`.

### Files the next agent should read first

1. `design-reference/dialogs.jsx` (L123–198) — the source-of-truth Goals UI being ported; `GOAL_TYPES` at L123–130.
2. `src/features/goals/Goals.tsx` — the stub being replaced (current signature: `{ onClose }`).
3. `src/db/sqliteBinderStore.ts` — the store-class pattern to mirror (`getDb`, `db.select`/`db.execute`).
4. `src/db/migrations.ts` (L234–242) — the `goals` table schema (id, project_id, goal_type, target, enabled, created_at).
5. `src/inspector/SceneInspector.tsx` (L102–105) — `readGoalTarget()`; the `writing.goalTarget` key (read-only reference, do NOT edit).
6. `src/App.overlays.tsx` (L17–50) — the OverlayStack prop surface + Goals render line to forward `setGoalsOn` through.
7. `src/shell/TitleBar.tsx` (L68–70) — the target-icon tint conditioned on `goalsOn` (read-only reference, do NOT edit).

### Note to the implementer

The spirit: make Goals feel real and persistent without leaking outside the lane. The two temptations to
resist — (1) adding a DB migration for streak/goalsOn (don't; streak + goalsOn live in localStorage,
migration 5 is the Corkboard lane's), and (2) "fixing" the ring by editing `SceneInspector` (don't;
mirror `writing.goalTarget` and the ring picks it up for free). CSS is consume-only — every class you
need already exists in `app.css`/`tokens.css`. In `App.overlays.tsx`, touch ONLY the Goals render line
and its destructure — leave the `setHasQuickItems` gap alone (lane 13). First step: verify the
`## Locked decisions` section below has decisions filled in.

Before declaring a phase complete, restate that phase's Observation-column point in your own words and
say what you actually observed. Phase 3's observation (TitleBar tint + live ring) needs `npm run tauri
dev` to confirm visually — if you can't launch the Tauri runtime, say so explicitly and fall back to the
prop-boundary acceptance test (assert `setGoalsOn` fired and `writing.goalTarget` was written). Do not
substitute "tests pass" for the runtime observation.

## Locked decisions

> Routine pattern-reuse decisions — abbreviated form, no spectrum. These mirror existing established
> patterns in the codebase (SqliteBinderStore class pattern; the wave-9 ring's localStorage read), so
> they bypass the decision-review cell as skip-tier (no novel architecture in tension).

### Decision 1: Goal config persistence store

**Context:** Where/how to persist the selected goal type + target + enabled.
**Pick:** New `src/db/sqliteGoalsStore.ts` (`GoalsStore` iface + `SqliteGoalsStore`) writing to the
existing `goals` table (migration 4), one row per (project_id, goal_type), upsert on save.
**Rationale:** Mirrors the established `SqliteBinderStore` class pattern (`getDb`, `db.select`/
`db.execute`, `crypto.randomUUID`, `Date.now`) — zero new infrastructure, zero new migration.
**Enforcement:** none (convention) — code review confirms the pattern match.

### Decision 2: Streak storage = localStorage, not DB

**Context:** Persistent writing streak needs durable storage; DB would require a schema column.
**Pick:** `localStorage["writing.streak"]` = `{ count, lastMetDate }`, with a pure `advanceStreak` helper.
**Rationale:** The `goals` table has no streak column; adding one = migration 5, which collides with the
Corkboard lane (also adding migration 5). localStorage keeps the lane disjoint and the streak is a
small, single-user, client-only value — no relational need.
**Consequences:** Streak is not queryable via SQL and not in DB backups; acceptable for a per-user UI counter.
**Enforcement:** none (convention).

### Decision 3: Goal-ring target wiring via localStorage mirror

**Context:** The wave-9 `SceneInspector` ring reads `localStorage["writing.goalTarget"]` synchronously;
the new target must reach it without editing SceneInspector (outside this lane's dir).
**Pick:** On Save, `writeGoalTarget(target)` sets `localStorage["writing.goalTarget"]` to the integer string.
**Rationale:** The ring already reads that exact key with a synchronous `parseInt`; mirroring the DB value
into it is the lowest-coupling integration seam and keeps the lane to its own files.
**Consequences:** The target lives in two places (DB row = source of truth, localStorage = ring cache);
Save must always write both. A future refactor could make the ring read the DB async (out of scope).
**Enforcement:** advisory-only — acceptance criterion asserts the key is written on save. `durable: candidate`
(the localStorage-mirror seam is likely cited by future ring/goal work).

### Decision 4: TitleBar tint wiring via forwarded `setGoalsOn`

**Context:** The TitleBar target tint is conditioned on `goalsOn`, but `setGoalsOn` is declared on
`OverlayStackProps` yet never forwarded to `<Goals>` (wave-11 wiring gap, confirmed in App.overlays.tsx).
**Pick:** Forward `setGoalsOn` (+`goalsOn`) through `OverlayStack` into `<Goals>` — Goals line only — and
have the toggle call `setGoalsOn(next)`.
**Rationale:** Lead authorized touching `App.overlays.tsx` to complete the lane ("merge master will handle
merging"). Scoping the edit to the Goals render line avoids stepping on lane 13's `setHasQuickItems` lines.
**Consequences:** `App.overlays.tsx` is touched by two lanes (13 + 14) at adjacent lines → a trivial merge
conflict the lead resolves at merge. goalsOn still does not auto-light at session start (frozen App.state).
**Enforcement:** advisory-only — acceptance criterion asserts the prop-boundary `setGoalsOn` fire.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | — | — | — | — |
| 2 | — | — | — | — |
| 3 | — | — | — | — |

## Follow-up candidates

- goalsOn does not auto-light the TitleBar tint at session start: requires hydrating `App.state.ts`
  `goalsOn` from `localStorage["writing.goalsOn"]`, but `App.state.ts`/`App.tsx` are frozen shared-shell
  files this lane cannot edit. | present-harm: K2 — `src/App.state.ts` `const [goalsOn] = useState(false)`
  (frozen); user who toggled goals ON sees the tint dark again after restart until they reopen Goals.
- Live "daily goal met" streak auto-advance has no app-wide signal: the editor's daily word count lives in
  `src/inspector/SceneInspector.tsx` (session-delta, not persisted to localStorage), outside this lane;
  the streak can only reconcile on Goals-open, not in real time. | present-harm: K2 —
  `src/inspector/SceneInspector.tsx` L146–152 computes session words but writes no `writing.dailyWords`
  signal; streak cannot increment automatically as the user crosses their target mid-session.

## Result

<filled at ship by wrap team>
