---
status: ACTIVE
decided-in: wave-3-scene-notes
promoted-during: wave-3-scene-notes
---

## Context

Phase-2 plaintext extraction needed to know the real Yjs storage type of editor content.

## Pick

TipTap Collaboration `field: "content"` stores prose in `doc.getXmlFragment("content")` (a Y.XmlFragment), verified against TipTap v3 + Yjs docs. `extractPlainText` traverses that fragment (recurse XmlElement/XmlText, `\n` between top-level blocks). NOT `editor.getText()` (no editor in the save path) and NOT `doc.getText("content")` (Yjs enforces one type per key — accessing "content" as Y.Text throws when it was bound as XmlFragment).

## Rationale

Forced by library behavior — single correct answer, no alternatives (decision-cell skip-tier). Pre-existing Yjs tests used `getText("content")` (an isolated-layer fiction the real editor never populates); Phase 2 migrates them to `getXmlFragment("content")` — required so the new save-path extraction doesn't collide on the type key.

## Consequences

Pre-existing Yjs tests migrated from `getText("content")` to `getXmlFragment("content")` to align with the real editor binding and enable plaintext extraction in the save path without type collisions.

## Enforcement

Phase-2 acceptance test (`src/test/scenePlaintextProjection.test.ts`) + migrated Yjs tests. Vendor-gotchas documented at wave-wrap.
