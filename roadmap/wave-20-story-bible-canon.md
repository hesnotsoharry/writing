---
status: PLANNED
created: 2026-06-04
---

# Wave 20 — Story lane: inspector + corkboard + story-bible canon wiring

## Plan

### Status

DRAFT · target v1.x (feature wave) · drafted 2026-06-04.

### Goal

After this wave, the three "Story" surfaces match the canon prototype's behavior instead of rendering inert
shells. The Scene Inspector links characters/locations to a scene (persisted), edits and persists a scene's
synopsis, shows role-only entity cards, wraps long notes without horizontal scroll, and renders a "Today's
goal" ring driven by `useDailyGoalProgress` only when goals are enabled. Corkboard cards carry a right-click
scene menu, footer chips (up to two characters + one location), and an editable synopsis. The Story Bible
adds characters/locations by a single click-to-create button that drops the new row into inline-rename mode,
auto-sizes entity notes (no drag-resize), and shows a per-entity "N scenes" footer. One additive store
method (`setSceneSynopsis`) is added to `BinderStore` to back synopsis persistence — the single sanctioned
deviation from the `src/db/` freeze (Cole-authorized 2026-06-04; flagged for the lead at merge).

### Scope

**In scope:**

- `src/db/binderStore.ts` + `src/db/sqliteBinderStore.ts` — **additive only**: a new `setSceneSynopsis(sceneId, synopsis)` method on the `BinderStore` interface, `SqliteBinderStore`, and `InMemoryBinderStore`. No migration (the `synopsis TEXT` column already exists), no signature changes to existing methods.
- `src/test/binderStore.contract.test.ts` — one new contract test asserting `setSceneSynopsis` persists (orchestrator-authored acceptance test for the storage boundary).
- `src/inspector/SceneInspector.tsx` — wire "Link a character"/"Link a location" → entity picker → `replaceSceneLinks`; editable synopsis (pencil → inline edit → `setSceneSynopsis`); confirm role-only entity card (avatar initial + name + role); fix the notes/synopsis text-wrap → horizontal-scroll bug; replace `useSessionGoal` with `useDailyGoalProgress`, self-sourcing manuscript total via a `SqliteBinderStore` singleton, and render the goal ring only when `on`.
- `src/features/corkboard/Corkboard.tsx` — right-click scene context menu via `buildSceneMenu`; footer chips (`scene.characters.slice(0,2)` + `scene.locations.slice(0,1)`, `.chip` class, `shortLabel`); editable synopsis on cards (`setSceneSynopsis`); a self-managed local working tree so menu mutations re-render the board.
- `src/storybible/StoryBibleView.tsx` — single "New character"/"New location" button that creates a blank entity and enters inline rename; remove the textarea drag-resize and fix notes horizontal-scroll (auto-size); per-entity `.be-foot` "N scenes" footer from scene-links; `bible-col-title` icons.
- A small shared pure helper `shortLabel(name)` (strip leading "The ", first word) for corkboard chips — placed in `src/features/corkboard/` (lane-owned), unit-tested.

**Out of scope:**

- `Export` and `Archive` scene-menu actions, and `Duplicate` — no `archiveScene`/`duplicateScene` store method exists and adding them is not authorized; these menu items render as `showToast("… — coming in a later wave")` stubs (Export deferred to Wave 23, Archive to Wave 22).
- Editing `src/App.*`, `src/db/` schema/migrations, `src/styles/*.css` — FROZEN/consume-only per the coordination doc (the one carve-out is the additive `setSceneSynopsis`).
- The corkboard status-dot cycle — already migrated to canonical `STATUS_META`/`STATUS_ORDER` by Wave 17; left intact (next wave / will-not-touch).
- A full Story-Bible entity context menu (`buildEntityMenu`) — not in the Lane 20 scope list; deferred to a later polish wave.
- Unlink-entity UI beyond what `replaceSceneLinks` supports trivially — link (add) is the named scope; remove is a follow-up if it surfaces.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | `setSceneSynopsis` store method + contract test | sonnet-implementer | pyramid · cross-boundary (persistent storage). Additive setter mirroring `renameScene` across interface + SqliteBinderStore + InMemoryBinderStore. Orchestrator authors the failing contract test FIRST (boundary); implementer makes it pass, may not edit it. No migration. | Internal — no observation point |
| 2 | Inspector wiring (links, synopsis, goal ring, text-wrap) | sonnet-implementer | trophy · cross-boundary (storyBibleStore + binderStore singletons; localStorage goal). Picker → `replaceSceneLinks`; pencil → inline synopsis edit → `setSceneSynopsis`; swap `useSessionGoal` → `useDailyGoalProgress` gated on `on`; self-source manuscript total via binderStore singleton; add `overflow-wrap`/`word-break` to kill horizontal scroll. | Inspector panel displays linked character/location cards, an editable synopsis that survives a scene switch, and the Today's-goal ring only when goals are enabled. |
| 3 | Corkboard wiring (right-click menu, chips, synopsis) | sonnet-implementer | trophy · cross-boundary (binderStore + storyBibleStore singletons). `buildSceneMenu` + `<ContextMenu>` mount; Duplicate/Export/Archive → toast stubs, Rename/Set-status/Delete → real store calls; footer chips via `loadSceneEntities` + `shortLabel`; card synopsis edit → `setSceneSynopsis`; local working tree reloaded after mutations. | Corkboard card shows footer chips (character/location names) and an inline-editable synopsis; right-clicking a card displays the scene context menu. |
| 4 | Story Bible wiring (add, auto-size, scene-count footer) | sonnet-implementer | trophy · internal-only (storyBibleStore singleton via prop). Replace persistent add-input row with a single create-then-rename button; remove textarea `resize`/fix overflow; `.be-foot` "N scenes" from `findScenesForEntity`; `bible-col-title` icons. | Story Bible column shows a "New character"/"New location" button that drops a new row into inline rename, each entry shows an "N scenes" footer, and notes wrap without horizontal scroll. |

### Acceptance criteria

- [ ] `setSceneSynopsis(sceneId: string, synopsis: string | null): Promise<void>` exists on the `BinderStore` interface and on both `SqliteBinderStore` and `InMemoryBinderStore`.
- [ ] `src/test/binderStore.contract.test.ts` has a case that calls `setSceneSynopsis`, reloads the project, and asserts the rebuilt tree's scene `synopsis` equals the written value; the test fails against `main` and passes after Phase 1.
- [ ] In `SceneInspector.tsx`, the "Link a character"/"Link a location" buttons open an entity picker whose selection calls `store.replaceSceneLinks` with the prior links plus the chosen entity, and the inspector re-loads (`refreshKey` bump or local reload).
- [ ] The inspector Synopsis pencil toggles an inline editable field that, on commit, calls `setSceneSynopsis` and shows the new text without a remount.
- [ ] The inspector goal section renders `<GoalGroup>` only when `useDailyGoalProgress(...).on === true`, with `words`/`target`/`pct` sourced from that hook (no `useSessionGoal`).
- [ ] No horizontal scrollbar appears on long unbroken strings in the inspector synopsis/role or the Story-Bible notes textarea (`overflow-wrap: anywhere`/`word-break: break-word`; no textarea `resize`).
- [ ] `Corkboard` mounts `<ContextMenu>` and a card's `onContextMenu` builds items via `buildSceneMenu`; Rename/Set status/Delete call real store methods, Duplicate/Export/Archive call `showToast`.
- [ ] Corkboard `.card-foot` renders up to two character chips + one location chip (`.chip` + type class) using `shortLabel`; `shortLabel("The Old Mill") === "Old"` is unit-tested.
- [ ] `StoryBibleView` "New character"/"New location" is a single button that creates a blank entity and immediately puts its name into inline-edit mode; the persistent add-`<input>` row is gone.
- [ ] Each Story-Bible entry renders a `.be-foot` "N scenes" element where N = `store.findScenesForEntity(id).length`.
- [ ] `npm run lint` + `tsc` (`npm run build`) + the touched test files all pass.

### Files the next agent should read first

1. `roadmap/wave-20-DRAFT.md` `## Locked decisions` (this file) — the authorized freeze deviation and the toast-stub/local-tree decisions.
2. `roadmap/coordination/canon-polish-coordination.md` § GLOBAL RULES + "Lane 20 — Story" row — the owned dirs, freeze rules, and handoff format.
3. `design-reference/inspector.jsx` and `design-reference/views.jsx` — canon behavior for inspector and corkboard/story-bible (the target shape).
4. `design-reference/menu.jsx` + `src/components/menu/ContextMenu.tsx` + `src/components/menu/sceneMenu.ts` — the `MenuItem` API and `buildSceneMenu` callbacks.
5. `src/db/binderStore.ts` + `src/db/sqliteBinderStore.ts` — the store to extend (`renameScene` is the shape to mirror) and the singleton pattern (`new SqliteBinderStore()` is side-effect-free).
6. `src/db/storyBibleStore.ts` — `replaceSceneLinks`, `loadSceneLinks`, `loadSceneEntities`, `listEntities`, `createCharacter`/`createLocation`, `findScenesForEntity`.
7. `src/features/goals/useDailyGoalProgress.ts` — the goal hook (returns `{words,target,pct,on,streak}`; `pct` is 0–1).
8. `src/inspector/SceneInspector.tsx`, `src/features/corkboard/Corkboard.tsx`, `src/storybible/StoryBibleView.tsx` — the three components being wired.

### Note to the implementer

This is a **wiring** wave, not a rebuild: the canon `.jsx` files define the target; the React components mostly exist but their handlers are inert. Resist three temptations — (1) do NOT touch the corkboard status-dot cycle (Wave 17 already made it canonical); (2) do NOT edit `App.*`, CSS, or `src/db/` beyond the single authorized `setSceneSynopsis` setter — reach stores via module-level singletons, the established pattern; (3) do NOT add `archiveScene`/`duplicateScene` — those menu items are deliberate toast stubs. First step: confirm the `## Locked decisions` section below is filled before writing code.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — and you cannot for this wave: there is **no Tauri runtime and no human UI smoke available**, browser-smoke hangs — say so explicitly, and fall back to `tsc` + the touched tests + a line-by-line diff comparison against the matching `design-reference/*.jsx`. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient; every UI behavior this wave touches must be listed in the handoff's "Needs Cole's eyes post-merge" section.

## Locked decisions

## Decision 1: synopsis persistence under the `src/db/` freeze
**Context:** Editable synopsis (inspector + corkboard) needs a write path, but no `setSceneSynopsis` exists and `src/db/` is frozen. **Pick:** Add the additive setter to `BinderStore`/`SqliteBinderStore`/`InMemoryBinderStore` (Cole-authorized 2026-06-04). **Rationale:** The coordination doc froze `src/db/` on the premise "the store methods you need already exist" — false for synopsis. Additive, no migration (column exists), zero conflict risk (no other lane touches binderStore); cleaner than raw-SQL-in-component. **Enforcement:** advisory-only — flagged loudly in the handoff for the lead to verify at merge; orchestrator-owned contract test guards the behavior.

## Decision 2: Duplicate/Archive scene-menu items are toast stubs
**Context:** `buildSceneMenu` requires `onDuplicate`/`onArchive`, but BinderStore has no `duplicateScene`/`archiveScene` (archive is a `{}`-returning stub callback). **Pick:** Wire Duplicate/Archive/Export to `showToast("… — coming in a later wave")`, same pattern as the Export stub. **Rationale:** Adding two more store methods exceeds the single authorized freeze deviation; the canon menu's primary value (Rename, Set status, Delete) is fully wired. **Enforcement:** none (convention) — consistent with the coordination doc's Export-stub decision (Wave 17).

## Decision 3: Corkboard self-manages a local working tree
**Context:** Tree refresh is synchronous `setTree` wired only into the parent's own CRUD callbacks (no global event); Corkboard's mount in frozen `App.content.tsx` passes no reload callback, so menu mutations (rename/delete) cannot refresh the board through the parent. **Pick:** Corkboard holds a local working tree seeded from the `tree` prop (re-synced on prop identity change), reloaded via a `SqliteBinderStore` singleton after its own mutations; status keeps its existing optimistic-override path. **Rationale:** Only path to a self-consistent board under the freeze; mirrors the existing `defaultBinderStore` singleton + optimistic-override pattern already in the file. **Enforcement:** advisory-only — reviewed against the canon `views.jsx` menu flow.

## Decision 4: inspector goal ring switches to `useDailyGoalProgress`
**Context:** The inspector currently uses a local `useSessionGoal` (scene-open delta); the coordination doc instructs wiring the ring to `useDailyGoalProgress` and rendering only when on. **Pick:** Replace `useSessionGoal` with `useDailyGoalProgress`, gate `<GoalGroup>` on `on`, and self-source `currentTotal` (manuscript total) via a `SqliteBinderStore` singleton since the frozen mount doesn't thread it. **Rationale:** Direct coordination-doc instruction; `projectId` is already in props (currently dropped), and the singleton pattern supplies the missing manuscript total without editing frozen `App.content.tsx`. **Enforcement:** advisory-only — `pct` scale (0–1 from the hook vs 0–100 in `GoalRing`) verified by `tsc` + diff review.

## Status

| Phase | Dispatched | Completed | Commit | Observation hit |
|---|---|---|---|---|
| 1 setSceneSynopsis store method | ✅ | ✅ | d0284c6 | Internal — verified via contract test (5/5) |
| 2 Inspector wiring | ✅ | ✅ | de7b816 | Not directly observable (no Tauri runtime) — tsc + 4 component tests + diff-vs-canon + adversarial review |
| 3 Corkboard wiring | ✅ | ✅ | fc3f9eb | Not directly observable — tsc + corkboard contract (10) + shortLabel (7) + adversarial review |
| 4 Story Bible wiring | ✅ | ✅ | 3f445fd | Not directly observable — tsc + 4 component tests + adversarial review |

## Follow-up candidates

(none qualify the Tier-3 triple gate — minor reviewer notes were addressed inline or are
zero-present-harm future-field items; see handoff "Needs Cole's eyes" + flags.)

## Result

**Shipped (4 phases, commits d0284c6..3f445fd):** the three Story surfaces now match the canon prototype.

- **Phase 1** — additive `setSceneSynopsis` on `BinderStore`/`SqliteBinderStore`/`InMemoryBinderStore`
  (the one Cole-authorized `src/db/` freeze deviation; no migration). Orchestrator-owned contract test.
- **Phase 2** — Inspector: entity-link picker → `replaceSceneLinks` (full-replace preserves prior links);
  editable synopsis → `setSceneSynopsis` (single-commit guarded); Today's-goal ring →
  `useDailyGoalProgress`, rendered only when `on`, manuscript total self-sourced via a binder singleton;
  role-only cards; long-text overflow-wrap.
- **Phase 3** — Corkboard: right-click `buildSceneMenu` (Rename/Set-status/Delete real; Duplicate/Export/
  Archive toast stubs); footer chips (≤2 char + 1 loc via `shortLabel`); editable card synopsis;
  self-managed local working tree (frozen mount has no reload path). Status-dot cycle left byte-unchanged.
- **Phase 4** — Story Bible: single "New character"/"New location" → create-then-rename; `.be-foot`
  "N scenes" footer; notes drag-resize removed + overflow fix; `bible-col-title` icons.

**Gates:** full lint PASS · full tsc PASS · full suite 391/391 pass (52 files). Per-phase adversarial
reviews (attack-diff, single) all PASS-after-FLAG-addressed. No live UI smoke (no Tauri runtime) — human
verification deferred to the lead's post-merge integrated smoke.
