---
id: 0009
title: Focus effects move inside ProseMirror (decoration plugin, not DOM)
status: ACTIVE
decided-in: wave-28
promoted-during: wave-28
---

# Decision 0009: Focus effects move inside ProseMirror (decoration plugin, not DOM)

**Context:** Pure-DOM focus effects (`focusEffects.ts` / `useFocusEditorEffects` hook) fail categorically: ProseMirror's MutationObserver reverts external `data-focused` mutations within 800ms (even with caret outside the editor), and `scrollIntoView` on a PM node triggers a redraw that creates a new `<p>` object, breaking the identity gate and creating a 480k+ call/sec self-sustaining loop. This is why P7 passed jsdom tests but looped live (twice). **Editor effects must be PM extensions/decorations, not DOM mutation; jsdom cannot test editor behavior; CDP is the only valid oracle.**

**Pick:** Replace with a TipTap v3 extension `src/editor/extensions/FocusModeExtension.ts` (precedent: `AutoLink.ts`). Use `Decoration.node({class:'pm-focused'})` for dim (PM renders → cannot revert). Use plugin `view().update()` scrolling the `.canvas-scroll` **container** via `coordsAtPos` (never PM-node scroll → no redraw → no loop). Flags via `configure()` + `setMeta(focusModeKey)` useEffect. Delete `focusEffects.ts` entirely. Update acceptance test for structure/HUD-opacity checks only; behavior verified by CDP smoke.

**Rationale:** PM-native decorations cannot be reverted by MutationObserver. Container scroll avoids redraw → loop. jsdom has no layout/MutationObserver/valid scrollIntoView, so it cannot test editor effects. CDP smoke is the only valid oracle.

**Consequences:** editor-core gains one read-only decoration extension (Decision 0002-compliant); `focusEffects.ts` deleted; acceptance test is structural-only; ProseMirror-dependent behavior verified by CDP smoke only. Fully reversible.

**Enforcement:** CDP smoke verification (loop dead, `.pm-focused` persists on caret paragraph, scroll centers correctly) is the behavioral gate; P7 acceptance covers structure/HUD-opacity; adversarial review confirmed no editing-behavior change (wave-28 P7 & P8 stages).
