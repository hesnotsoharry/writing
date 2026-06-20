---
status: PLANNED
created: 2026-06-04
---

# Wave 12 — Corkboard + scene status

## Plan

### Status

DRAFT · target v1.x (feature wave) · drafted 2026-06-04.

### Goal

After this wave the app has a working Corkboard view: navigating to it (the TitleBar grid button) renders every scene as an index card, grouped by chapter, showing the scene's title, synopsis (or a "No synopsis yet." placeholder), a colored status dot, and a word count. Clicking a card opens that scene in the editor; clicking a card's status dot cycles the scene through blank → draft → done and persists the change to SQLite (a new `status` column added by migration 5). Today `src/features/corkboard/Corkboard.tsx` is a `(coming soon)` stub rendered with zero props, and scenes have no status concept anywhere in the stack — after this wave the corkboard is live and scene status round-trips through the binder store.

### Scope

**In scope:**

- **Migration 5** — append a version-5 entry to `MIGRATIONS` in `src/db/migrations.ts`: `ALTER TABLE scenes ADD COLUMN status`, idempotent via a `PRAGMA table_info(scenes)` guard (matching the crash-recovery contract of the existing runner). Default `'blank'`.
- **Scene status data layer** — add `SceneStatus = "blank" | "draft" | "done"` and `status: SceneStatus` to the `Scene` interface (`src/db/binderStore.ts`); read `status` in `sqliteBinderStore` SELECTs; add `setSceneStatus(id, status)` to the `BinderStore` interface + both implementations (`sqliteBinderStore` UPDATE, `InMemoryBinderStore` parity); update every test `Scene` fixture with the new field.
- **Corkboard component** — replace the stub at `src/features/corkboard/Corkboard.tsx` with the real view + a `CorkCard` subcomponent + a `STATUS_META` TS constant (status → `{ label, dot color, done }`), porting `design-reference/views.jsx` Corkboard. Render `tree.chapters` as `.cork-chgroup` groups of `.cork-grid` cards plus a short-pieces group; empty chapter → `.empty-hint`.
- **Live mount** — thread `tree`, `onSelectScene`, and `onViewChange` from `AppContent` through `buildViewStage` into `<Corkboard>` in `src/App.content.tsx` (lead-authorized; only this lane touches the view-stage branch → merge-safe).
- **Card interactions** — click card → `onSelectScene(id)` then `onViewChange("editor")`; click status dot → cycle status via `setSceneStatus` (with `stopPropagation` so it doesn't also open the scene), color updates and persists.

**Out of scope:**

- **Character/location chips on cards** — `design-reference` CorkCard shows entity chips, but per-scene character/location data lives in `scene_links` + the story bible, not on the `Scene` type. Pulling it in is separate cross-subsystem plumbing → deferred to a follow-up candidate; cards render no `.card-foot` chips this wave.
- **Synopsis editing** — synopsis is nullable and has no write path anywhere in the app today. Cards render it read-only with a fallback. Adding synopsis-editing is a separate feature → not this wave.
- **Persisted word counts** — DB `word_count` is always `0` (no write-back path exists; live counts come from Yjs for the active scene only). Cards show `"—"` when the stored count is `0`. Wiring word-count persistence is its own concern → not this wave.
- **Drag-to-reorder scenes on the corkboard** — the `.card` CSS has `cursor: grab`, but reordering is a binder-mutation concern → future wave.
- **Any edit to the frozen surfaces** — `App.tsx`, `App.state.ts`, `shell/TitleBar.tsx`, `styles/app.css`, `styles/tokens.css` are consume-only (coordination rule). Only `App.content.tsx` (not frozen) is touched, by lead authorization.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Scene status data layer — migration 5 + `SceneStatus` type + `Scene.status` + store read/write | sonnet-implementer | pyramid · **cross-boundary (persistent storage)** · Append migration 5 to `MIGRATIONS` matching `migration_004_feature_tables` style; idempotent via `PRAGMA table_info(scenes)` guard (`ALTER … ADD COLUMN` is not re-runnable, so the no-try/catch crash-recovery runner would fail on re-run without the guard). Add `setSceneStatus(id, status)` to `BinderStore` + both impls; extend `Scene` + all test fixtures. Orchestrator authors a failing store round-trip acceptance test first. | Internal — no observation point |
| 2 | Corkboard view + live mount — `Corkboard.tsx` + `CorkCard` + `STATUS_META`; thread `tree`/`onSelectScene`/`onViewChange` through `buildViewStage` (`App.content.tsx`) | sonnet-implementer | trophy · **cross-boundary (consumes frozen App-shell mount + binder tree)** · Replace the stub; render chapters → cards (title, synopsis fallback, status dot inline-colored from `STATUS_META`, word-count `"—"` fallback). Consume existing `.corkboard`/`.card` CSS — author no CSS. Chips deferred (empty `.card-foot`). | Navigating to Corkboard via the TitleBar grid button renders scene index cards grouped by chapter, each showing the scene title, synopsis (or "No synopsis yet."), and a colored status dot |
| 3 | Card interactions — open-on-click + status-cycle-on-dot-click | sonnet-implementer | trophy · internal-only (wires already-threaded callbacks + the new store write) · Click card → `onSelectScene(id)` + `onViewChange("editor")`. Click dot → `stopPropagation`, cycle blank→draft→done→blank via `setSceneStatus`, update local render + persist. | Clicking a card opens that scene in the editor; clicking a card's status dot cycles its color (blank→draft→done) and the new color is still there after leaving Corkboard and returning |

### Acceptance criteria

- [ ] `MIGRATIONS` in `src/db/migrations.ts` contains a `{ version: 5, name: …, up }` entry; after `runMigrations` against a fresh DB, `PRAGMA table_info(scenes)` includes a `status` column with default `'blank'`.
- [ ] Migration 5 is idempotent: calling `runMigrations` twice (or invoking migration 5's `up` twice) does not throw a "duplicate column name" error — verified by a test that runs it against a DB already carrying the column.
- [ ] `Scene` (`src/db/binderStore.ts`) has `status: SceneStatus` where `SceneStatus = "blank" | "draft" | "done"`.
- [ ] `setSceneStatus(id, status)` exists on the `BinderStore` interface and both implementations; a round-trip test (`setSceneStatus` then reload tree) returns the updated status. `sqliteBinderStore` SELECTs include `status`.
- [ ] `src/features/corkboard/Corkboard.tsx` renders `tree.chapters` as `.cork-chgroup` groups containing a `.cork-grid` of cards, plus a short-pieces group; an empty chapter renders `.empty-hint`.
- [ ] Each card renders `.card-title`, `.card-syn` (showing "No synopsis yet." when `synopsis` is null), a `.card-status` row with a `.dot` (or `.scene-check` when status is `done`) inline-colored from `STATUS_META`, and `.w` showing the word count or `"—"` when `word_count` is `0`.
- [ ] `buildViewStage` in `src/App.content.tsx` passes `tree`, `onSelectScene`, and `onViewChange` into `<Corkboard>`; `tsc` is clean.
- [ ] A component test asserts: clicking a card calls `onSelectScene(scene.id)` and then `onViewChange("editor")`.
- [ ] A component test asserts: clicking a card's status dot calls `setSceneStatus` with the next status in the cycle (blank→draft→done→blank) and does NOT call `onSelectScene` (event does not bubble).
- [ ] `npm run lint`, `tsc --noEmit` (via build/typecheck), and the touched `vitest` files all exit 0; `no-explicit-any` is satisfied (no `any` in the new code).
- [ ] No diff to `src/App.tsx`, `src/App.state.ts`, `src/shell/TitleBar.tsx`, `src/styles/app.css`, or `src/styles/tokens.css` (`git diff --name-only` excludes all five).

### Files the next agent should read first

1. `roadmap/coordination/parallel-feature-waves-coordination.md` — lane rules + the frozen-surfaces list (this lane's hard boundary).
2. `design-reference/views.jsx` — the Corkboard + CorkCard visual spec being ported (JSX, class names, `STATUS_META` shape, interactions).
3. `src/db/migrations.ts` — `migration_004_feature_tables` is the style to match; the `runMigrations` runner's no-try/catch crash-recovery contract is why migration 5 must be idempotent.
4. `src/db/binderStore.ts` + `src/db/sqliteBinderStore.ts` — the `Scene` interface + `BinderStore` methods to extend; `InMemoryBinderStore` needs parity.
5. `src/App.content.tsx` — `buildViewStage` is the authorized mount-point edit site (thread the three props here; do not touch `App.tsx`/`App.state.ts`).
6. `src/styles/app.css` (the `.corkboard` … `.card-foot` block, ~lines 443–481) — consume-only reference for the exact class names the component must use.
7. This wave file's `## Locked decisions` section — read before touching the migration.

### Note to the implementer

The spirit of this wave: light up the Corkboard by **consuming** what the wiring wave and the design system already built — don't re-author CSS (every class exists), don't widen the frozen App-shell files, and don't invent data the `Scene` type doesn't carry. The status column is the only schema change; keep migration 5 strictly additive and idempotent (it ships to a real `writing.db`). Resist three temptations: adding entity chips (deferred — the data isn't on `Scene`), adding a synopsis or word-count write path (out of scope — render the fallbacks), and "fixing" the frozen files. First step: verify the `## Locked decisions` section below has its decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

## Decision 1: Migration 5 idempotency strategy

**Context:** `ALTER TABLE … ADD COLUMN` is not re-runnable (SQLite has no `ADD COLUMN IF NOT EXISTS`), but the migration runner has no try/catch and re-runs any migration whose `user_version` stamp didn't land (crash-recovery contract) — a naive ALTER would throw "duplicate column" on re-run.
**Pick:** Guard the ALTER with a `PRAGMA table_info(scenes)` check — only add `status` if the column is absent.
**Rationale:** Single defensible pattern given the existing runner; matches migration 4's idempotent posture (`CREATE TABLE IF NOT EXISTS`) without changing the runner contract. Trivial decision — no architect/decision-review cell needed.
**Consequences:** Migration 5's `up` reads `table_info` before mutating; every future column-add migration follows the same guard.
**Enforcement:** Acceptance criterion (idempotency test runs migration 5 twice without throwing) + Phase 1 reviewTier `single`.

## Decision 2: `status` column shape — `TEXT NOT NULL DEFAULT 'blank'`

**Context:** New scene-status column needs a default for the ~existing rows and a closed value set.
**Pick:** `status TEXT NOT NULL DEFAULT 'blank'`, app-level union `SceneStatus = "blank" | "draft" | "done"` (no DB CHECK constraint — matches the schema's existing no-constraint convention).
**Rationale:** Mirrors the project's TEXT-column + app-level-typing convention (migrations 1–4 use no CHECK constraints); `'blank'` makes every pre-existing scene a valid, neutral status with zero backfill work.
**Enforcement:** TypeScript `SceneStatus` union at the store boundary; acceptance criterion on the default.

## Decision 3: Deferred chips + read-only synopsis/word-count are scope boundaries, not omissions

**Context:** `design-reference` CorkCard shows entity chips, real synopsis, and word counts; our `Scene` carries none of that data with a write path.
**Pick:** Render fallbacks ("No synopsis yet.", `"—"`) and an empty `.card-foot`; stage chips as a follow-up candidate.
**Rationale:** Pulling entity-link data or adding synopsis/word-count write paths is separate cross-subsystem work; the core corkboard (cards + open + status) stands alone and ships.
**Enforcement:** Out-of-scope list + Follow-up candidates entry (chips); `advisory-only` for the synopsis/word-count fallbacks.

## Status

| Phase | Topic | Completed | Commit | Review (reviewTier) |
|---|---|---|---|---|
| 1 | Scene status data layer (migration 5 + setSceneStatus) | ✅ | 78506df | single — FLAG (LATEST regression) fixed |
| 2 | Corkboard view + live mount (render + click-to-open) | ✅ | 1afae34 | single — FLAG (test precision) fixed |
| 3 | Status cycle (dot click → blank/draft/done, persisted) | ✅ | 998fd6a | single — 2 FLAGs (rapid-click, observability) fixed |
| wrap | createScene status explicit (wave-end review fix) | ✅ | b3ce875 | wave-end attack-diff FLAG fixed |

## Follow-up candidates

- Corkboard entity chips (character/location): cannot be done in-wave — per-scene entity associations live in `scene_links` + the story-bible store, not on the `Scene` type; surfacing them on cards needs link-traversal plumbing across ≥2 subsystems (binder store + story bible) plus a card-data shape change. | present-harm: K2 — `design-reference/views.jsx` CorkCard renders `.chip.character`/`.chip.location` per scene; shipped cards omit them, a visible gap vs the approved design (named consumer: the design reference + the pre-authored `.chip` CSS in `styles/app.css`).

## Result

**Delivered (branch `wave-12-corkboard`, commits 2f3b46b..b3ce875):** a working Corkboard view + scene status.
- Migration 5 — idempotent `ALTER scenes ADD COLUMN status TEXT NOT NULL DEFAULT 'blank'` (PRAGMA table_info guard; append-only; crash-recovery-safe).
- `SceneStatus = blank|draft|done` on `Scene`; `setSceneStatus` on `BinderStore` + both impls; `createScene` sets `'blank'` explicitly.
- `Corkboard.tsx` — chapter-grouped index cards (title, synopsis fallback, status dot/check, word-count `—` fallback); click card → open scene; click dot → cycle status (optimistic + persisted). 3-state model per locked product decision (NOT the 5-state design mock).
- `App.content.tsx` — lead-authorized: `ViewStageCtx` threads `tree`/`onSelectScene`/`onViewChange` to Corkboard. Frozen surfaces (App.tsx/App.state.ts/TitleBar/app.css/tokens.css) untouched.
- Gates: full suite **182/182** (+13), tsc 0, lint 0.

**Deferred:** entity chips (follow-up candidate above), synopsis/word-count write paths, drag-reorder, binder-sidebar status dots (binder renders no status today — no staleness defect).

### Mechanical review

**Inputs resolved:**
- Plan: `roadmap/wave-12-corkboard-scene-status.md`
- Diff range: `4891b2a..b3ce875`
- Graph: fallback (codebase-graph not indexed for this worktree — Check 1/3 via grep + import-following)
- Run: 2026-06-04

- **Check 1 (forward-trace):** PASS — all new symbols (`SceneStatus`, `setSceneStatus`, `migration_005_scene_status`, `Scene.status`, `Corkboard`, `ViewStageCtx` fields) reach production consumers (fallback trace). 0 dead paths.
- **Check 2 (plan universals):** PASS — "every scene gets status" (table-wide migration), "each card renders status" (CorkCard covers all chapters + short pieces). No narrowed universal.
- **Check 3 (export audit):** PASS — net-new export `SceneStatus` consumed in `binderStore.ts`/`sqliteBinderStore.ts`/`Corkboard.tsx` (production); `Corkboard` consumed by `App.content.tsx`. 0 dead exports (fallback trace).
- **Check 4 (schema-removal migration):** N/A — additive column add; no schema-property removals (and SQLite, not electron-store JSON-Schema).
- **Check 5 (boundary acceptance tests):** PASS — Phase 1 (persistent storage) + Phase 2 (frozen-mount consume) carry orchestrator-authored acceptance tests (`sceneStatus.contract.test.ts`, `corkboard.test.tsx`), authored before dispatch, implementer-unmodified, run evidence 182/182. Pipeline commits test+impl together (orchestrator commits all), so the git first-commit heuristic is inapplicable; the substantive orchestrator-owned/implementer-unmodified constraint holds.
- **Check 6 (mutation score):** skipped — no `stryker.config` / no `mutation:test` script.

#### Verdict

**PASS** — Checks 1/2/3/5 ran clean (graph-fallback for 1/3); Check 4 N/A; Check 6 skipped. Wave-end adversarial attack-diff returned one FLAG (createScene status default-reliance), fixed in b3ce875. Branch is mergeable.

> Wave-wrap tail (HANDOFF rewrite, durable-decision promotion, stub-collapse, push) deferred to the LEAD's post-merge wrap — this is a parallel lane (12·13·14·15·16); global artifacts are coordinated after merge to avoid cross-lane collisions.
