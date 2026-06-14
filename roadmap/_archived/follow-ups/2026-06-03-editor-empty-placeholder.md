---
status: RESOLVED
resolved-during: followups-ui-batch
created: 2026-06-03
updated: 2026-06-13
source: screen-port-batch
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K1 — no placeholder text renders in an empty editor; users are unsure where to type. Smoke 2026-06-03 observed "can't tell where to enter things" when selecting a scene with an empty doc. Verifiable at TipTap Placeholder extension usage pattern (library idiom) vs src/editor/Editor.tsx which has no placeholder configuration.
---

# Follow-up: editor-empty-placeholder

When the user opens an empty scene, the editor canvas shows no placeholder text or visual cue indicating where to type. This is a UX friction point surfaced in the 2026-06-03 post-batch smoke.

The design-reference (design-reference/canvas.jsx) implies a placeholder affordance (though the exact text is not specified in the mockup). TipTap's Placeholder extension is the standard library idiom for this (ctx7-verifiable, TipTap v3 idiom).

Wiring this requires:
1. Installing/importing the TipTap Placeholder extension.
2. Configuring it with appropriate placeholder text (e.g. "Start typing…" or per the design intent).
3. Testing the placeholder render on empty doc load.

While technically a single-file change (Editor.tsx), it involves a new dependency/extension addition and may need design input on the exact placeholder text. Classified as multi-step/multi-decision for that reason.

## Design reference

The design mockup is not explicit on placeholder wording. Recommend confirming the intended text with the design reference or the lead before shipping.

## Suggested resolution path

Quick fix in the next Editor refinement wave, or fold into the editor-scene-header-chrome wave (which also threads App state into Editor and would be a natural time to revisit Editor config).

## Resolution (2026-06-13)

Closed by orchestrator mechanical audit on 2026-06-13.
Evidence: Implemented: TipTap `Placeholder` extension + `.is-editor-empty::before` 'Start writing…' cue in `app.css` (prior wave).
