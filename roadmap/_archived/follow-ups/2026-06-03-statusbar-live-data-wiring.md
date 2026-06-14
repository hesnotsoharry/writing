---
status: RESOLVED
resolved-during: followups-ui-batch
created: 2026-06-03
updated: 2026-06-13
source: wave-5
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K3 — src/shell/StatusBar.tsx shows `—` for scene/manuscript word counts; src/App.tsx passes `sceneWordCount={null}`; user sees no live word count in the status bar once the shell lands.
---

# Follow-up: StatusBar live-data wiring

## Context

Wave 5 shipped the three-pane shell with a rendered `StatusBar` component (`src/shell/StatusBar.tsx`), which displays scene and manuscript word counts, goals mini-bar, and backup timestamp. However, the status bar currently renders **placeholder dashes** for all live data — `sceneWordCount={null}` is passed from `App.tsx`, and no live observers or aggregates are wired.

## Issue

- **Scene word count:** requires a Yjs doc observer that recomputes on edit, not a freeze-on-load memo (a static freeze would mislead the user as they write)
- **Manuscript-wide word-count aggregate:** requires a `SUM(plaintext_projection)` query over all scenes, which belongs in a persistent SQL aggregate or a computed store
- **Goals mini-bar:** `goalsOn` / session target reads come from a future goals store (not yet scaffolded)
- **Backup timestamp:** requires last-backup state from the backup service (to be wired once backup is implemented)

Currently, `StatusBar` renders honest `—` (dash) placeholders for all four metrics, with no implementation path.

## Why this is a follow-up

Wiring live status bar data naturally groups with the word-count and goals feature work, and cannot be completed as a single sonnet-implementer dispatch:

1. **Yjs observer pattern design:** needs to establish how the doc observer integrates with React's render cycle (external state subscription + cleanup)
2. **Manuscript aggregate:** requires either (a) a persistent SQL-backed aggregate view, or (b) a derived store that computes the sum on scene mutations
3. **Goals store scaffolding:** the goals feature is a separate wave; StatusBar integration waits on that store existing
4. **Multi-boundary coordination:** changes span `src/App.tsx` (hook/observer plumbing), `src/stores/` (new or extended), `src/shell/StatusBar.tsx` (live prop acceptance)

This is a feature-tier design piece, not a cheap wiring fix.

## Suggested approach

1. **Wave 6 (or dedicated word-count feature wave):** Design a live Yjs observer hook (e.g. `useDocWordCount`) that subscribes to the scene doc and updates the component on mutation; integrate into `App.tsx` and pass to `StatusBar`
2. **Manuscript aggregate:** Add a SQL-backed computed column or a derived store (`manuscriptWordCountStore`) that aggregates the sum; wire to StatusBar
3. **Placeholder migration:** Keep `—` rendering until each metric has a real data source; migrate `sceneWordCount` / `manuscriptWordCount` / `goalsMini` / `backupTimestamp` props as their sources are implemented
4. **Testing:** Cover the observer contract with a synthetic test (Yjs doc mutation → component update)

---

*Filed from wave-5 follow-up candidates. Naturally groups with goals and word-count feature work.*

## Resolution (2026-06-13)

Closed by orchestrator mechanical audit on 2026-06-13.
Evidence: Implemented: `useLiveWordCount` / `useManuscriptWordCount` / `useDailyGoalProgress` wired into `<StatusBar>` (prior wave).
