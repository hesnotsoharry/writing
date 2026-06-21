---
status: ACTIVE
decided-in: wave-3-scene-notes
promoted-during: wave-3-scene-notes
---

## Context

How characters/locations get associated with scenes for the inspector.

## Pick

Auto-detection from scene prose via a pure `detectEntities(text, entities)` over each scene's saved plaintext projection. `scene_links` is a detection-owned **write-through cache** (DELETE-then-INSERT per scene), never user-authored. Triggers: scene save + entity add/rename/delete (background rescan of all scenes' stored projections). Matcher: single compiled regex alternation, alternatives sorted **longest-name-first**, regex-escaped, trailing possessive stripped, apostrophe/hyphen names handled. Reactivity via the existing store-seam + lifted React state (**not Zustand** — not a project dependency; matching the established `binderStore` + `App.tsx` pattern). Per-scene write serialization to avoid save-detection vs rename-rescan races. `aliases` column added now; alias-editing UI deferred.

## Rationale

User chose auto-detect over manual linking. Exact word-boundary matching is precise and false-positive-resistant; longest-first ordering fixes prefix overlap (`Anne` vs `Anne Shirley`); the cache gives instant inspector reads without re-running detection on scene switch.

## Consequences

Schema must add `plaintext_projection`, `characters`, `locations`, `scene_links` (all spec-stated but unscaffolded — created this wave). Empty-text-wipes-links is guarded. **Correction from grounding:** plaintext is extracted from the Y.Doc `content` XmlFragment in the save path, NOT `editor.getText()` — the save path (`bindPersistence`) has no editor instance in scope. This is an implementation-path refinement of the same decision (detection still runs over a saved projection), not a new decision. **Reversibility note:** If manual link override is wanted later, add a `source`/`is_auto` discriminator to `scene_links` and switch detection to "DELETE auto-rows, preserve manual-rows" — same cheap-now-or-later tradeoff as `aliases`.

## Enforcement

Detection correctness enforced by vitest unit tests on `detectEntities` (Phase 3 matrix). Schema presence enforced by Phase-1 contract tests. Race serialization enforced by a Phase-4 test. Reactivity/Zustand-avoidance and alias-UI-deferral are `advisory-only`.
