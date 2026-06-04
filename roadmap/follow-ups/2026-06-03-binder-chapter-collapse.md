---
status: OPEN
created: 2026-06-03
source: screen-port-batch
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K1 — chapters in the binder cannot collapse/expand; long manuscripts with many chapters force users to scroll within a chapter list with no fold affordance. Verifiable at design-reference/binder.jsx:59–96 (the full `.chapter-row.closed` state + `.twist` chevron + conditional scene render) vs the wave-7 Binder.tsx which renders chapters unconditionally with no collapse state or toggle handler.
---

# Follow-up: binder-chapter-collapse

Chapters in the binder render fully expanded with no way to collapse. The design-reference includes a full collapse/expand affordance (twist chevron, `.chapter-row.closed` state, conditional scene rendering), but the live binder has no `open` state, no chevron, no toggle handler.

Wiring this requires:
1. A new `open` state in the Binder component (or lifted to App state).
2. A toggle handler on the chevron (`span.twist`).
3. A conditional render of the chapter's scene list (render when open, hide when closed).
4. CSS state styling (`.chapter-row.closed` + `.twist` rotation rules exist in app.css but are unused).

This is a multi-file, multi-step feature (Binder.tsx + BinderCrud.tsx state + rendering logic) that cannot be cleared by a single sonnet-implementer dispatch.

## Design reference

`design-reference/binder.jsx` lines 59–96: the chapter header with twist chevron, `.chapter-row.closed` state, and conditional scene-list render.

The CSS rules exist at `src/styles/app.css` lines 228 (`.scene-dot` unused), and the rotation rule for `.chapter-row.closed .twist` is present but has no state backing it.

## Suggested resolution path

Feature wave owning "Binder refinements" (collapse state + twist logic + conditional render). Low risk; the styling is already present. Can parallelize with other feature waves once the screen-port batch is merged.
