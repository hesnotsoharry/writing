---
status: SHIPPED
created: 2026-06-04
note: status corrected 2026-06-13 — foundation deliverables shipped in commit 7addfa4 and were consumed by downstream waves now in v0.6.0 production; the IN-PROGRESS marker was stale bookkeeping.
---

# Wave 17 — Canon-polish foundation (shared contracts)

## Plan

### Goal
After this wave, master carries the shared contracts the 4 canon-polish lanes consume — a 5-status
metadata module, scene/chapter context-menu builders, the daily/whole-manuscript goal model, the
manuscript word-count hook, the editor-style application hook, an `open_path` Tauri command, and the
App-level prop/state wiring — all additive, no component rewrites, **no migration**. The 4 lanes
(18 binder · 19 editor · 20 story · 21 settings/goals/status) then fork and run in parallel against these.

### Scope
**In scope:** `src/lib/status.ts`, `src/components/menu/sceneMenu.ts`, `src/lib/manuscriptWords.ts`,
`src/features/goals/goalModel.ts` + `useDailyGoalProgress.ts`, `src/theme/useEditorStyle.ts` (+ mount),
`open_path` in `src-tauri/src/lib.rs` + `src/lib/ipc.ts`, widen `SceneStatus`/`setSceneStatus` in
`src/db/binderStore.ts`, App freeze-wiring in `App.content.tsx`/`App.overlays.tsx`/`App.state.ts`.
Exact contracts: `roadmap/canon-polish-coordination.md` § "WAVE 17 — Foundation".

**Out of scope:** all component UI (binder/editor/inspector/corkboard/storybible/settings/goals/statusbar
rows) — that's the lanes. Any migration. Export/Archive features (deferred 22/23).

### Phases
| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | status.ts + sceneMenu.ts + binderStore widen | sonnet-implementer | pyramid · internal-only · unit-test normalizeStatus + menu builders | Internal — no observation point (consumed by lanes) |
| 2 | goalModel + useDailyGoalProgress + manuscriptWords | sonnet-implementer | pyramid · localStorage logic · unit-test daily-delta | Internal — no observation point (consumed by lanes) |
| 3 | useEditorStyle + open_path (Rust+ipc) + App wiring | sonnet-implementer | trophy · IPC boundary · tsc is the net | Internal — no observation point (lanes consume; visible post-merge) |

### Acceptance criteria
- [ ] `STATUS_META`/`STATUS_ORDER`/`normalizeStatus` exported from `src/lib/status.ts`; `normalizeStatus("done") === "final"`.
- [ ] `buildSceneMenu`/`buildChapterMenu` return canon-ordered `MenuItem[]` (set-status submenu ticks current).
- [ ] `useDailyGoalProgress` returns `{words,target,pct,on,streak}`; daily delta = max(0, total − today-baseline).
- [ ] `openPath` registered in `generate_handler!` + wrapped in `ipc.ts`.
- [ ] App passes `goalsOn`→StatusBar, `onOpenGoals`→Settings, footer props→Binder; `goalsOn` inits from storage; `useEditorStyle` mounted.
- [ ] `npm run lint` + `tsc` + touched tests green.

### Files the next agent should read first
1. `roadmap/canon-polish-coordination.md` § WAVE 17 (exact contracts).
2. `design-reference/data.jsx` (STATUS_META dot colors), `design-reference/menu.jsx` (menu shape).
3. `src/components/menu/ContextMenu.tsx` (MenuItem API), `src/db/binderStore.ts`, `src/lib/ipc.ts`, `src-tauri/src/lib.rs`.

### Note to the implementer
This is the load-bearing foundation for 4 parallel sessions — get the contracts EXACTLY as specified in
the coordination doc; lanes import them by name. Additive only: do NOT rewrite any component UI. Before
declaring a phase complete, restate the observation point and what you observed; these phases are
Internal — no user observation point, so verify via unit tests + tsc, and say so explicitly. Do not
substitute "tests pass" for runtime observation where a real surface exists. Unit tests at the boundary
are necessary but not sufficient.

## Locked decisions
- **No migration** (status column free-text TEXT verified; goal progress → localStorage). Enforcement: `src/db/` frozen for lanes.
- **Goal model = Daily, whole-manuscript, persisted** (Cole, 2026-06-04). durable: candidate. Enforcement: `goalModel.ts` is the single source.
- **Export menu items stubbed** (toast); full Export = deferred Wave 23. Enforcement: lanes pass toast stub to `onExport`.
- **App name "Writers Nook"** in About + window title; titlebar logo stays; wordmark deferred. Enforcement: advisory-only.

## Status
| Phase | Dispatched | Completed | Commit | Observation hit |
|---|---|---|---|---|

## Follow-up candidates

## Result
