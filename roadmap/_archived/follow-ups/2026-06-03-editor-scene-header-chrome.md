---
status: RESOLVED
resolved-during: followups-ui-batch
created: 2026-06-03
updated: 2026-06-13
source: screen-port-batch
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K1 — the ported editor pane is visually incomplete vs design-reference/canvas.jsx (no chapter eyebrow, scene title, or word-count byline above the prose); user "can't tell what scene they're in" per wave-8 follow-up candidates. Verifiable at design-reference/canvas.jsx:58–79 (Canvas header block) vs the wave-8 Editor.tsx output which renders prose only.
---

# Follow-up: editor-scene-header-chrome

The design's scene header (`.scene-eyebrow` / `.scene-h1` / `.scene-byline`: chapter title, scene title, word/char/location byline) above the prose canvas is not built. Wave-8's Editor.tsx was ported to the design-system canvas structure, but it receives only `doc: Y.Doc` as a prop and lacks access to scene metadata (title, chapter, word count, status).

Needs scene metadata threaded through the `<EditorPane>`/`<Editor>` call site in App.tsx. This is multi-file (App.tsx + Editor.tsx + likely the store/state layer) and cannot be cleared by a single sonnet-implementer dispatch (requires App.tsx coordination, forbidden to wave-8, and necessitates state-threading across the App boundary).

## What blocks this now

- Wave-8 (Editor lane) is a style-only lane and cannot touch App.tsx.
- Wave-9 (Inspector lane) is the only lane permitted to edit App.tsx, but it owns the Inspector's own feature expansion; layering scene-header threading into wave-9 would couple the concerns.
- The scene metadata must come from App.state's active scene selection, not from the Editor's local state.

## Design reference

`design-reference/canvas.jsx` lines 58–79: the target `.scene-eyebrow` (chapter name), `.scene-h1` (scene title), and `.scene-byline` (word/char count, location, status pill) layout.

## Suggested resolution path

Fold into wave-9 post-merge app-threading coordination pass, or defer to a Tier-2 feature wave that owns App.tsx threading as a coherent pass (Corkboard, Settings, Quick Capture all add view state to App.tsx; batch the threading discipline in one wave).

## Resolution (2026-06-13)

Closed by orchestrator mechanical audit on 2026-06-13.
Evidence: Implemented: `src/editor/EditorHeader.tsx` (eyebrow/h1/byline) fed real scene metadata (prior wave).
