---
status: OPEN
created: 2026-06-03
source: wave-5
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K3 — src/binder/Binder.tsx inline `border-right` + `background-color` produce a double border and a white left pane against the themed shell (observed in wave-5 smoke 2026-06-03); same pattern latent in Editor/Inspector/StoryBible.
---

# Follow-up: Screen inline-style shedding

## Context

Wave 5 reparented the four core screens (Binder, Editor, SceneInspector, StoryBibleView) into the new three-pane `AppShell`, which defines panel slots with design-token-aware styling (`.panel-binder`, `.center`, `.panel-inspector`). However, the reparented screens still carry their own pre-design inline styles from the previous flat layout.

## Issue

- **Double borders:** Binder's `<nav border-right>` overlaps with `.panel-binder`'s border, creating a doubled line at the binder/editor seam (observed in wave-5 smoke, 2026-06-03)
- **Color override:** Binder's `background-color:#fafafa` (white) overrides the shell's `--paper` token, rendering a white left pane instead of the designed warm-paper tone
- **Same pattern latent:** Editor, SceneInspector, and StoryBibleView carry similar inline margins, padding, or color overrides that will be visible once the shell tokens become consistent across the UI

## Why this is a follow-up

Each screen sheds its inline styles and adopts the shell's token-driven CSS in its own dedicated wave (HANDOFF step 2 names Binder first). This is a coordinated per-screen refactor, not a single-wave fix:
- Requires verifying each screen's visual integration with the shell (cross-boundary rendering check)
- Spans 4 screens across distinct features (story, binder, editor, goals)
- Cannot be bundled into a single sonnet-implementer dispatch without losing the incremental smoke-validation for each screen

## Suggested approach (per-screen order)

1. **Binder port wave (HANDOFF step 2):** Remove `border-right` inline style; remove `background-color:#fafafa`; let `.panel-binder` CSS apply
2. **Editor port wave (subsequent):** Remove inline padding/margins; adopt `.center` + token-driven styling
3. **SceneInspector port wave:** Same pattern — remove overrides, adopt token cascading
4. **StoryBibleView port wave:** Final screen; verify the full three-pane token consistency once all screens adopt shell styling

Each wave includes smoke verification: the screen renders with correct spacing, borders, and background color via tokens.

---

*Filed from wave-5 follow-up candidates; Binder port is HANDOFF step 2. Coordinates with shell landing and token-adoption rollout.*
