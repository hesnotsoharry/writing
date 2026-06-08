---
id: 0008
title: Editor frozen — additive only (lane-boundary contract)
status: ACTIVE
decided-in: wave-28
promoted-during: wave-28
---

# Decision 0008: Editor frozen — additive only (lane-boundary contract)

**Context:** The editor layer was declared "frozen" by prior direction; clarification was needed on whether this meant literally zero new lines in `src/editor/` (byte-freeze) or a behavioral constraint (no change to editing behavior). Constraint impacts P7 (focus effects) and P8 (autolink) which add hooks to the editor.

**Pick:** Treat "frozen — additive only" as *no change to editor-core editing behavior*, NOT literally zero new lines in `src/editor/`. Additive hooks/decorations that do not alter editing behavior are COMPLIANT and may stay in `Editor.tsx`. Make the required `linksVersion` prop optional+guarded and type the store prop as the `StoryBibleStore` interface (not the concrete class) to restore the lane-boundary contract.

**Rationale:** Identical runtime to the byte-freeze alternative; extracting to `src/features/*` wrappers so `src/editor/` is byte-frozen is pure churn for no functional gain — moving working code to satisfy a structural rule with an identical end result.

**Consequences:** Additive hooks/decorations stay in Editor.tsx; lane-boundary props must be optional+guarded to maintain compatibility with isolated callers/tests.

**Enforcement:** P7/P8 acceptance + adversarial review check on prop optionality + no editor-core behavior change (confirmed in wave-28 P7/P8 stages).
