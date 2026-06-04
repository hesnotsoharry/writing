---
status: PLANNED
created: 2026-06-03
---

# Wave 9 — Inspector full expansion

## Plan

### Status

DRAFT · target v0.x (feature wave) · drafted 2026-06-03.

### Goal

After this wave, the writing app's right-hand Inspector panel renders the full design-reference experience instead of today's name-only stub: the active scene's **synopsis**, a live **"Today's goal" ring** driven by real session word-count progress, and **character/location cards** (avatar initials + role subtitles) wired to the scene's actual linked Story-Bible entities through a new additive join read-query. `src/App.tsx` threads the active `Scene` object to the inspector to feed the synopsis, and sheds the last `EditorPane` inline-style debt that no style-only lane can reach. All styling comes from existing CSS classes — no new tokens, no schema changes.

### Scope

**In scope:**

- `src/db/storyBibleStore.ts` + `src/db/sqliteStoryBibleStore.ts`: new **additive read-query** `loadSceneEntities(sceneId): Promise<{ characters: Entity[]; locations: Entity[] }>` (SELECT join `scene_links` → `entities`), plus its `InMemoryStoryBibleStore` double. No schema/migration change.
- `src/inspector/SceneInspector.tsx`: full rewrite from name-only stub → synopsis block, `GoalRing` SVG subcomponent + goal-card, `EntityCard` subcomponent (avatar initial + name + notes-as-role + chevron), characters-in-scene + locations-in-scene groups, empty-hints, add buttons. Styling via existing classes only.
- Goal ring: live progress arc from in-memory session-words baseline (captured per scene-open via `useRef` keyed on `sceneId`) + `localStorage` goal target (with a sensible default). Streak rendered gracefully **without** a number.
- `src/App.tsx`: thread `scene={activeScene}` (the `Scene` matching `selectedSceneId`, read from the already-loaded binder tree) into `SceneInspector`; clean the `EditorPane` wrapper inline styles (~107–119) → `.center` / `.view-stage` classes.
- `src/test/sceneInspector.test.tsx`: updated to the new component contract; new test for `loadSceneEntities`.

**Out of scope:**

- **Persistent streak / writing-session history** — needs a new DB table (schema migration), forbidden in this lane. Deferred to the future **Goals** feature wave (staged as a follow-up candidate). The goal section renders without a streak number until then.
- **Goal-target editing UI** — the target is read from `localStorage` (default if absent) but no settings control to change it ships this wave. Deferred to the Settings/Goals wave.
- **Adding a `role` column to entities** — out of scope (schema change); the role subtitle uses the existing freeform `notes` field. → next schema wave if a structured role is ever wanted.
- **Any other screen** (Binder/Editor/Story Bible) — owned by the parallel lanes (waves 7/8/10). Do not touch.
- **`src/styles/app.css`, `src/styles/tokens.css`, `src/App.state.ts`, `src/db/migrations.ts`, `src/db/schema.ts`** — frozen by the coordination contract.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Additive read-query `loadSceneEntities(sceneId)` | sonnet-implementer | Trophy/static · cross-boundary (persistent-storage read). `reviewTier: single`. Add to `StoryBibleStore` interface + `sqliteStoryBibleStore.ts` (SELECT join `scene_links`→`entities`) + `InMemoryStoryBibleStore` double; returns `{ characters: Entity[]; locations: Entity[] }` with full fields incl `notes`. Additive only — no schema/migration touch. Orchestrator authors the failing acceptance test first. | Internal — no observation point. |
| 2 | Full inspector component + App.tsx scene threading | sonnet-implementer | Trophy/integration · cross-boundary (UI ↔ store ↔ App state). `reviewTier: panel`. Rewrite `SceneInspector.tsx` (synopsis, `GoalRing` SVG, `EntityCard`, char/loc groups, empty hints) consuming `loadSceneEntities`; new `scene: Scene \| null` prop; session-words via `useRef` baseline keyed on `sceneId`; target from `localStorage` (default); streak omitted. Thread `scene={activeScene}` at the App.tsx call site. Existing classes only. Update `sceneInspector.test.tsx`. | Inspector panel in the running app shows the active scene's synopsis text, character/location cards with avatar initials + role subtitles, and a goal ring arc filled to the session-progress percentage. |
| 3 | EditorPane inline-style cleanup | sonnet-implementer | Trophy/static · internal-only. `reviewTier: skip`. Replace the `EditorPane` wrapper inline styles in `App.tsx` (~107–119) with the existing `.center` / `.view-stage` classes. Mechanical class swap; no behavior change. | Editor pane in the running app renders the centered scene view via CSS classes — visually identical, with no inline-style wrapper in the DOM. |

### Acceptance criteria

- [ ] `StoryBibleStore.loadSceneEntities(sceneId)` exists and returns `{ characters: Entity[]; locations: Entity[] }`; both `sqliteStoryBibleStore.ts` and `InMemoryStoryBibleStore` implement it.
- [ ] A test seeding a scene with 1 linked character + 1 linked location asserts `loadSceneEntities` returns each as a full `Entity` (including `notes`), grouped by type, and excludes entities not linked to that scene.
- [ ] `SceneInspector.tsx` renders a `.synopsis` element containing `scene.synopsis` text when a scene with a synopsis is selected.
- [ ] `SceneInspector.tsx` renders a `.goal-ring` SVG whose accent arc `strokeDashoffset` corresponds to `clamp(round(sessionWords / target * 100), 0, 100)`.
- [ ] Each linked character/location renders an `.entity-card` with an `.avatar` showing the name's first letter, an `.entity-name`, and an `.entity-role` showing the first line of `notes`.
- [ ] Empty states render an `.empty-hint` when a scene has no linked characters / no linked locations.
- [ ] No inline `style={…}` object literals remain in `SceneInspector.tsx` (all styling via classes; per-icon `width/height` sizing on `<Icon>` is allowed as in the design-reference).
- [ ] `App.tsx` passes `scene={activeScene}` (the `Scene` matching `selectedSceneId`) to `SceneInspector`.
- [~] DEFERRED (Phase 3, follow-up): The `EditorPane` block in `App.tsx` (~107–119) uses CSS classes with no inline `style` object literals remaining — blocked by the `app.css` freeze (empty-state needs a new class); see follow-up candidates.
- [ ] `git diff` shows **no** changes to `src/styles/app.css`, `src/styles/tokens.css`, `src/App.state.ts`, `src/db/migrations.ts`, or `src/db/schema.ts`.
- [ ] `npm run test`, `npm run lint`, and `tsc` (via `npm run tauri build` typecheck or `tsc --noEmit`) all exit 0.

### Files the next agent should read first

1. `roadmap/parallel-screen-ports-coordination.md` — the lane contract; the forbidden-surfaces list is binding.
2. `design-reference/inspector.jsx` — the target structure/markup the rewrite mirrors (GoalRing, EntityCard, Inspector).
3. `src/inspector/SceneInspector.tsx` — the stub being fully rewritten; note its current props + `useResolvedLinks` hook.
4. `src/App.tsx` — the `SceneInspector` call site (~164–169), the `EditorPane` block (~107–119), and where `selectedSceneId` + the binder tree live.
5. `src/db/storyBibleStore.ts` + `src/db/sqliteStoryBibleStore.ts` — store interface, the SQLite impl, and the `Entity` / `SceneLink` types + existing `loadSceneLinks` join (the pattern `loadSceneEntities` follows).
6. `src/db/binderStore.ts` — the `Scene` type (carries `synopsis` and `word_count`).
7. `src/components/Icon.tsx` — Icon API and available names (all 7 design-reference icons confirmed present).
8. `src/test/sceneInspector.test.tsx` — the existing tests (and `InMemoryStoryBibleStore` usage pattern) to update.
9. `src/styles/app.css` — **read-only reference** for the class shapes (`.panel-inspector`, `.insp-scroll`, `.insp-group`, `.synopsis`, `.goal-ring`, `.entity-card`, `.avatar`, …). Never write to it.
10. This wave file's `## Locked decisions` section.

### Note to the implementer

The spirit of this wave is to make the Inspector *real* — genuine linked-entity data, a genuine progress ring driven by actual word counts — not a mockup with invented numbers. Mirror `design-reference/inspector.jsx`'s structure closely, but bind every value to a real source: cards come from `loadSceneEntities`, synopsis from the threaded `scene` prop, the ring from session-words-vs-target. **Resist** these temptations: do not touch `app.css`/`tokens.css` (if a class seems missing, stop and flag it — all required classes are confirmed present); do not invent a streak number (render the goal section gracefully without it); do not add a `role` schema column (use `notes`); do not "improve" or restyle the Binder/Editor/Story-Bible screens (other lanes own them); do not modify `src/db/` schema or migrations (additive read-query only). First step: verify the `## Locked decisions` section below has its decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> These four decisions were locked by Cole directly during planning (user-authored answers to scope/product questions) and are within-pattern technical picks — they are skip-tier and do not require the decision-review cell (no agent-originated architectural tension to attack).

### Decision 1: Goal-ring data source

**Context:** The design-reference goal ring needs session-words, a target, and a streak, but none are stored; the lane cannot add a schema table.
**Pick:** Progress arc = `currentWordCount − baseline`, where `baseline` is captured in-memory per scene-open (`useRef` keyed on `sceneId`); target read from `localStorage` (sensible default if absent); streak rendered gracefully with **no** number (deferred to the Goals wave).
**Consequences:** The ring is live and honest within a session; persistent streak waits for the Goals wave's schema. Target is read-from/persisted-to `localStorage` but has no setter UI this wave.
**Enforcement:** advisory-only (component implementation) + acceptance criteria (`.goal-ring` strokeDashoffset reflects the computed %).

### Decision 2: Entity-role subtitle source

**Context:** Cards show a role subtitle; no `role` field exists in the schema.
**Pick:** Use the first line of the entity's freeform `notes` as the role text.
**Rationale:** Real existing data, no schema change; matches how the design-reference already derives location roles from notes.
**Enforcement:** acceptance criterion (`.entity-role` shows first line of `notes`).

### Decision 3: Entity-card data via a new additive join read-query

**Context:** Cards must be genuinely wired to linked entities (Cole: "if it needed another source, create it"); the old hook resolved links against *all* entities client-side.
**Pick:** Add `loadSceneEntities(sceneId)` — a single SELECT join (`scene_links` → `entities`) returning the linked characters/locations grouped, with full fields. Additive read-query (lane-permitted).
**Rationale:** One scoped DB round-trip returning exactly the linked entities is the correct data path and satisfies the "wired up correctly" instruction; client-side filtering of `listEntities` was load-everything-then-filter.
**Enforcement:** Phase-1 orchestrator-authored acceptance test.

### Decision 4: Synopsis via threaded `Scene` prop (no new DB query)

**Context:** The inspector needs the scene's synopsis; the `Scene` object (with `synopsis`) is already loaded in App.tsx's binder tree.
**Pick:** Thread the active `Scene` as a new `scene` prop from App.tsx rather than adding a synopsis read-query.
**Rationale:** The data is already in memory; prop-threading reuses the existing `refreshKey`/prop pattern and avoids a redundant DB call. App.tsx is this lane's to edit.
**Enforcement:** acceptance criterion (App.tsx passes `scene={activeScene}`).

## Status

| Phase | Dispatched | Completed | Commit | Observation point hit |
|---|---|---|---|---|
| 1 — loadSceneEntities read-query | yes | yes | 4f4f5fa (test+stub) · cf37261 (impl) | Internal — acceptance 4/4 (incl. ordering); FLAGs (ORDER BY, non-atomic-read comment) fixed inline |
| 2 — inspector component + App threading | yes | yes | 1c2ce57 (test) · this commit (impl) | Pending wave-end live smoke (`npm run tauri dev`): inspector renders synopsis + cards + goal ring. Component+store verified 8/8; panel 3×FLAG→fixed inline, 0 BLOCK |
| 3 — EditorPane inline-style cleanup | DEFERRED | — | — | Deferred (Cole's call): clean conversion needs a new `app.css` class for the empty-state placeholder, but `app.css` is frozen in this lane (coordination rule #1); also unverifiable layout without `tauri dev`. Filed as follow-up. |

## Follow-up candidates

- Persistent writing-streak in the goal ring: requires a new `writing_sessions` (day-keyed) table = schema migration, forbidden in this screen-port lane and naturally owned by the future Goals feature wave. | present-harm: K2 — the Inspector goal section renders without the design-reference's "N-day streak 🔥" line (see `design-reference/inspector.jsx` line 55 vs the shipped `src/inspector/SceneInspector.tsx` goal-card); a named, designed UI element is absent until the Goals wave adds the schema.
- Wire the inspector's interactive affordances (edit-synopsis button, per-group "+" add buttons, "Link a character"/"Link a location" buttons): they render per the design-reference but carry no `onClick` this wave — they front the entity-link picker + synopsis-edit features, which are unbuilt (new UI primitives, multi-wave). | present-harm: K2 — named interactive `<button>`s in the shipped `src/inspector/SceneInspector.tsx` (EntityCard/EntityGroup/SynopsisGroup) do nothing on click; the user can press them with no effect until the link-picker and synopsis-edit features ship.
- EditorPane inline-style cleanup (deferred Phase 3): replace the two inline `style={{…}}` blocks in `EditorPane` (`src/App.tsx` ~107–119) with CSS classes. Blocked in this lane because the centered empty-state `<div>` has no existing `app.css` class and `app.css` is consume-only/frozen for the parallel screen-port batch (coordination rule #1); also needs a `tauri dev` layout smoke this environment can't run. Do once `app.css` is editable (post-merge or shared-CSS owner). | present-harm: K1 — `src/App.tsx` lines ~109 + ~113 still carry hardcoded inline styles (`flex/overflow` wrapper + a `display:flex;…;color:#aaa` empty-state), the last inline-style debt in App.tsx the design-token migration is meant to eliminate.

## Result

<!-- Filled at ship by wrap team. -->
