---
status: IN-PROGRESS
created: 2026-06-03
---

# Wave 3: scene-notes

## Plan

### Status

PLANNED · target v0.3.0 · drafted 2026-06-03 · 6 phases · test shape: trophy (pure-logic core is pyramid; detection-wiring seam is honeycomb)

### Goal

After this wave the app has a **Story Bible**: a dedicated view where the writer does full CRUD on characters and locations (each = name + free-text notes, plus an `aliases` column reserved for a later plan), and a **right-side inspector panel** that, for the currently-open scene, lists the characters and locations whose names appear in that scene's prose. The links are **auto-detected** — the writer never links manually. Concretely, the schema gains a `plaintext_projection` column on `scene_docs` plus three new tables (`characters`, `locations`, `scene_links`); a pure `detectEntities()` matcher lives in `src/lib/detection.ts` with a full correctness test matrix; detection runs on scene save and on any entity add/rename/delete; and `scene_links` is a detection-owned, rebuildable cache the inspector reads. Today none of this exists — the running schema is only `scene_docs(scene_id, state_base64)`, `projects`, `folders`, `scenes`, and the UI is a two-panel binder + editor with no inspector.

### Scope

**In scope:**

- Schema: add `plaintext_projection TEXT` to `scene_docs`; create `characters(id, project_id, name, notes, aliases)`, `locations(id, project_id, name, notes, aliases)`, `scene_links(scene_id, entity_type, entity_id)` in `src/db/schema.ts`.
- New store seam `src/db/storyBibleStore.ts` (interface + `InMemoryStoryBibleStore` fake) + `src/db/sqliteStoryBibleStore.ts` (SQLite impl) — mirrors the existing `binderStore` / `sceneDocStore` seam pattern. CRUD for characters/locations + `replaceSceneLinks(sceneId, links)` + `loadSceneLinks(sceneId)` + `findScenesForEntity(entityId)`.
- Plaintext extraction from the Y.Doc content fragment, written to `scene_docs.plaintext_projection` in the save path (`src/yjs/bindPersistence.ts` + a helper in `src/yjs/serialize.ts`).
- Pure `detectEntities(text, entities)` matcher in `src/lib/detection.ts` (single compiled regex alternation, longest-name-first, regex-escaped, possessive-stripped, apostrophe/hyphen-safe).
- Detection wiring: run on save and on entity mutation (background rescan of all scenes' stored projections); DELETE-then-INSERT `scene_links` per scene; per-scene write serialization.
- Story Bible view component (`src/storybible/StoryBibleView.tsx`) — CRUD UI; entry-point toggle in `App.tsx`.
- Inspector panel (`src/inspector/SceneInspector.tsx`) — third flex child in `App.tsx`, reads `selectedSceneId`, shows detected entities, reactive to saves + entity changes.

**Out of scope:**

- **Alias-editing UI** — the `aliases` column is created now; the chip-input UI to populate it is deferred to a later plan (a column with no UI is intentional; do not wire it).
- **Manual link override** — auto-detect only this wave. If a future plan wants manual links, that needs a `source`/`is_auto` discriminator on `scene_links` (noted in Locked decisions for reversibility).
- **Fuzzy matching / nicknames beyond exact-name + alias** — deferred; exact word-boundary match only.
- **Full-text search over `plaintext_projection`** — the column is written this wave but FTS is not built (the spec earmarks the column "for FTS/counts"; counts/FTS are a later concern).
- **Mobile / sync** — Phase 2 of the product; untouched.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Schema + Story Bible store seam | `sonnet-implementer` | **pyramid · internal-only.** Add 3 tables + `plaintext_projection` column to `src/db/schema.ts`. Author `storyBibleStore.ts` (interface + `InMemoryStoryBibleStore`) and `sqliteStoryBibleStore.ts` mirroring `binderStore`. Contract test the CRUD + `replaceSceneLinks`/`loadSceneLinks` against the in-memory fake (pattern: `binderCrud.contract.test.ts`). IDs via `crypto.randomUUID()`. | Internal — no observation point. (Verify via contract test green + `schema.ts` DDL present.) |
| 2 | Plaintext projection on save | `sonnet-implementer` | **honeycomb · cross-boundary (persistent storage).** Add `extractPlainText(doc)` to `src/yjs/serialize.ts` reading the Y.Doc `content` XmlFragment → newline-joined block text (NOT `editor.getText` — no editor in the save path). Extend `bindPersistence` to write `plaintext_projection` alongside `state_base64`. **Guard: skip writing an empty projection when one already exists** (don't let a transient empty read wipe it). Seam test: drive a Y.Doc with known text → assert stored projection. | Internal — no observation point. (Seam test asserts projection round-trips through the store.) |
| 3 | `detectEntities` pure matcher | `haiku-test-author` then `sonnet-implementer` | **pyramid · internal-only.** Orchestrator authors the failing oracle test matrix FIRST (pre-impl oracle), then implement. Single compiled regex alternation, alternatives **sorted longest-first**, each `escapeRegex`'d; strip trailing `'s`/`s'`; handle apostrophe/hyphen names. Test matrix MUST cover: prefix overlap (`Anne` vs `Anne Shirley`), possessive (`Sarah's`), apostrophe name (`O'Brien`), hyphen name (`Anne-Marie`), regex metachar name (`St. Mary's`), multi-word, case-insensitivity, alias match, empty-entity-list. | Internal — no observation point. (Test matrix green is the contract.) |
| 4 | Detection wiring (save + rescan) | `sonnet-implementer` | **honeycomb · cross-boundary (persistent storage).** Run `detectEntities` after each scene save (over the new projection + project entities) → `replaceSceneLinks` (DELETE-then-INSERT). On entity add/rename/delete → background rescan of all scenes' stored projections. **Per-scene write serialization** (a simple in-flight promise map keyed by sceneId) so save-detection and rename-rescan don't interleave on the same scene. Orchestrator authors the acceptance test (boundary phase). | Internal — no observation point. (Acceptance test: create entity + scene text → `scene_links` row appears; rename → rows update.) |
| 5 | Story Bible view (CRUD UI) | `sonnet-implementer` | **trophy · cross-boundary (new UI surface).** New `StoryBibleView.tsx` — list + create/rename/edit-notes/delete characters & locations, mirroring `BinderContent`'s hierarchy + inline-style convention. Toggle in `App.tsx` (e.g. `view: 'editor' \| 'bible'`) reachable from a header/binder control. Introduce a minimal RTL render harness (none exists yet) for the CRUD interactions; keep components thin. | **User opens the Story Bible view, creates "Sarah" (character) + "Thornfield" (location), edits notes, deletes one — all persist across relaunch.** |
| 6 | Scene inspector panel + reactivity | `sonnet-implementer` | **trophy · cross-boundary (new UI surface).** New `SceneInspector.tsx` mounted as the third flex child in `App.tsx`; reads `selectedSceneId` (App line ~243), shows the scene's detected characters/locations via `loadSceneLinks`. Reactive: re-reads on save completion and on entity-list change (lifted React state in App, NOT Zustand). Optional fold-in if it fits cleanly: editor placeholder-on-launch polish; otherwise leave it. | **Writer types "Sarah walked into Thornfield" in a scene → the inspector panel lists Sarah and Thornfield; renaming Sarah → Sara in the bible updates the panel.** |

### Acceptance criteria

- [ ] `src/db/schema.ts` creates `characters`, `locations`, `scene_links`, and `scene_docs` has a `plaintext_projection TEXT` column; a fresh DB opens without error.
- [ ] `StoryBibleStore` contract tests pass against `InMemoryStoryBibleStore` (CRUD + `replaceSceneLinks` replaces, doesn't merge).
- [ ] Saving a scene writes its plaintext into `scene_docs.plaintext_projection`; an empty transient read does NOT overwrite a non-empty projection.
- [ ] `detectEntities` passes the full Phase-3 matrix, including `Anne`/`Anne Shirley` (longest wins), `O'Brien`, `Anne-Marie`, `Sarah's`, `St. Mary's`.
- [ ] Creating an entity whose name appears in a saved scene's prose produces a `scene_links` row for that scene; deleting/renaming the entity updates links via rescan.
- [ ] Concurrent save-detection and rename-rescan on the same scene do not corrupt `scene_links` (serialization holds — covered by a test).
- [ ] The Story Bible view does full CRUD on characters and locations, persisting across relaunch.
- [ ] The inspector lists exactly the entities detected in the currently-selected scene, updating as the writer types (on save) and as entities change.
- [ ] Gates green wave-wide: `tsc`, `eslint` (strict flat config), `vitest` full suite.

### Files the next agent should read first

1. `src/db/schema.ts` — current DDL; where the 3 tables + column get added.
2. `src/db/binderStore.ts` — the seam pattern to mirror (interface + `InMemoryBinderStore` in one file).
3. `src/db/sqliteBinderStore.ts` — SQLite impl pattern + `crypto.randomUUID()` usage.
4. `src/db/sceneDocStore.ts` + `src/db/sqliteSceneDocStore.ts` — the simplest seam example; `scene_docs` save shape.
5. `src/yjs/bindPersistence.ts` + `src/yjs/serialize.ts` — the save path (Y.Doc-driven, no editor); where plaintext extraction + projection write go.
6. `src/App.tsx` — two-panel layout, `selectedSceneId` lifted state (~line 243); where the inspector (3rd panel) and bible-view toggle mount.
7. `src/binder/Binder.tsx` — hierarchy + inline-style + selection-callback precedent for the Story Bible view.
8. `src/editor/Editor.tsx` — TipTap `useEditor` + Yjs Collaboration wiring (field `"content"`); confirms the editor instance is NOT in the save path.
9. `src/test/binderCrud.contract.test.ts` — contract-test precedent for the store seams.
10. `docs/superpowers/specs/2026-06-02-creative-writing-app-design.md` §§5,7 — intended data model (note: spec is intent; code is canon).

### Note to the implementer

The spirit of this wave: a calm, automatic "who's in this scene" panel — the writer never tells the app who appears where; the app reads the prose. Resist two temptations. First, **don't build the alias-editing UI** — the column exists, the UI is a later plan. Second, **don't reach for a global state library** — this codebase lifts state in `App.tsx` and drills props; mirror that. Detection is a *pure function over saved plaintext*, not an editor extension — keep it decoupled from the editor lifecycle. The one genuinely new seam is extracting plaintext from the Y.Doc in the save path (Phase 2); the editor instance is deliberately not available there, so traverse the `content` XmlFragment. First step before any code: verify the `## Locked decisions` section below has its decision filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Settled via `sonnet-architect` + `sonnet-adversarial-reviewer` (`Posture: attack-decision`); orchestrator adjudicated (BLOCK on an assumed Zustand dependency → resolved by using the existing store-seam pattern; 3 FLAGs folded in).

## Decision 1: Auto-detect entity→scene linking
**Context:** How characters/locations get associated with scenes for the inspector. `durable: candidate`
**Pick:** Auto-detection from scene prose via a pure `detectEntities(text, entities)` over each scene's saved plaintext projection. `scene_links` is a detection-owned **write-through cache** (DELETE-then-INSERT per scene), never user-authored. Triggers: scene save + entity add/rename/delete (background rescan of all scenes' stored projections). Matcher: single compiled regex alternation, alternatives sorted **longest-name-first**, regex-escaped, trailing possessive stripped, apostrophe/hyphen names handled. Reactivity via the existing store-seam + lifted React state (**not Zustand** — not a project dependency; matching the established `binderStore` + `App.tsx` pattern). Per-scene write serialization to avoid save-detection vs rename-rescan races. `aliases` column added now; alias-editing UI deferred.
**Rationale:** User chose auto-detect over manual linking. Exact word-boundary matching is precise and false-positive-resistant; longest-first ordering fixes prefix overlap (`Anne` vs `Anne Shirley`); the cache gives instant inspector reads without re-running detection on scene switch.
**Consequences:** Schema must add `plaintext_projection`, `characters`, `locations`, `scene_links` (all spec-stated but unscaffolded — created this wave). Empty-text-wipes-links is guarded. **Correction from grounding:** plaintext is extracted from the Y.Doc `content` XmlFragment in the save path, NOT `editor.getText()` — the save path (`bindPersistence`) has no editor instance in scope. This is an implementation-path refinement of the same decision (detection still runs over a saved projection), not a new decision.
**Reversibility note:** If manual link override is wanted later, add a `source`/`is_auto` discriminator to `scene_links` and switch detection to "DELETE auto-rows, preserve manual-rows" — same cheap-now-or-later tradeoff as `aliases`.
**Enforcement:** Detection correctness enforced by vitest unit tests on `detectEntities` (Phase 3 matrix). Schema presence enforced by Phase-1 contract tests. Race serialization enforced by a Phase-4 test. Reactivity/Zustand-avoidance and alias-UI-deferral are `advisory-only`.

## Decision 2: Scene prose lives in a Y.XmlFragment named "content" (forced by TipTap)
**Context:** Phase-2 plaintext extraction needed to know the real Yjs storage type of editor content. `durable: candidate`
**Pick:** TipTap Collaboration `field: "content"` stores prose in `doc.getXmlFragment("content")` (a Y.XmlFragment), verified against TipTap v3 + Yjs docs. `extractPlainText` traverses that fragment (recurse XmlElement/XmlText, `\n` between top-level blocks). NOT `editor.getText()` (no editor in the save path) and NOT `doc.getText("content")` (Yjs enforces one type per key — accessing "content" as Y.Text throws when it was bound as XmlFragment).
**Rationale:** Forced by library behavior — single correct answer, no alternatives (decision-cell skip-tier). Pre-existing Yjs tests used `getText("content")` (an isolated-layer fiction the real editor never populates); Phase 2 migrates them to `getXmlFragment("content")` — required so the new save-path extraction doesn't collide on the type key.
**Enforcement:** Phase-2 acceptance test (`src/test/scenePlaintextProjection.test.ts`) + migrated Yjs tests. `durable: candidate` → promote to TipTap/Yjs vendor-gotchas at wrap.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | 2026-06-03 | 2026-06-03 | d299a5c | Internal — contract suite 16/16 green; DDL present |
| 2 | 2026-06-03 | 2026-06-03 | (this commit) | Internal — acceptance test 4/4; full suite 51/51; XmlFragment migration done |
| 3 | 2026-06-03 | 2026-06-03 | (this commit) | Internal — 19-case oracle green; full suite 70/70 |
| 4 | 2026-06-03 | 2026-06-03 | (this commit) | Internal — sync acceptance 6/6 (incl. serialization maxActive=1); suite 76/76 |
| 5 | 2026-06-03 | 2026-06-03 | (this commit) | View CRUD via RTL 3/3; live view not run this session (manual smoke at wrap); suite 79/79 |
| 6 | 2026-06-03 | 2026-06-03 | (this commit) | RTL 3/3 (SceneInspector display contract); full suite 82/82; tsc + eslint clean; live reactivity not run this session (no tauri dev) — wiring path: onSaved→linkScene→linksVersion→inspector re-read; onEntitiesChanged→rescanProject→re-read |

## Follow-up candidates

- **App detection-wiring has no automated coverage** (behavioralCoverageGap, Phase 6): the reactivity glue in `src/App.detection.ts` (onSaved→linkScene→linksVersion; onEntitiesChanged→rescanProject) is verified only by manual smoke. An App-level integration/RTL test would need a SQLite-mocked App harness (cross-boundary setup) — cannot be cleared by a single sonnet-implementer dispatch without that harness. Core logic (matcher, sync, inspector, view CRUD) IS unit-tested.
- **`_currentTree` module-global stale-read race** (Phase 6 reviewer FLAG_UNCERTAIN, speculative): `src/App.detection.ts` reads scene ids from a module-level `_currentTree` synced via `useEffect`; if `rescanProject` fires in the same render as a project-tree change, `listSceneIds` could read a one-render-stale tree. Single-user, self-healing on next save/rescan; chosen to satisfy `react-hooks/refs`. Consider a non-global fresh-read approach.

## Result

_(filled at ship by wrap team)_
