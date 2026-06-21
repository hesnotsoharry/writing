---
status: ACTIVE
decided-in: wave-32-brainstorm-boards
promoted-during: wave-32-brainstorm-boards
---

## Context
First canvas surface in the app; cards embed TipTap; commercial paid app; agent smokeability matters.

## Pick
`@xyflow/react` ^12 (MIT). Rejected: tldraw (watermark or paid commercial license — hard kill for a paid app); full custom canvas (3–4 weeks of viewport/coordinate/edge infrastructure); plain scroll-container without pan/zoom (surfaced by adversarial review, evaluated and rejected — pan/zoom is the established interaction model in every product the discovery cites as the user's mental-model sources (Scapple, Milanote, Obsidian Canvas), paragraph-sized cards exceed a viewport quickly, and retrofitting pan/zoom later rewrites the coordinate space).

## Rationale
Custom nodes are plain React components (TipTap embeds behind a `nodrag` boundary); default edges are exactly the spec's plain lines; real-DOM output keeps CDP smoke viable; React 19 supported as of v12.

## Consequences
One new dependency + its dist CSS (Phase 1 verifies no app-shell clash); cards render read-only by default with lazy TipTap mount on click — a Phase 1 constraint, not an optimization to defer.

## Enforcement
Phase 1 walking skeleton + per-phase CDP smoke; lint/tsc gates on the dependency's types.
