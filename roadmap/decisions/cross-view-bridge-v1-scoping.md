---
status: ACTIVE
decided-in: wave-53
promoted-during: wave-53
---

## Context
The board `Y.Doc` lives in `BoardView` local state and never flows up to the AI panel's mount level, so the reply→card (write) path cannot prop-thread the board doc. Need a cross-view communication mechanism for brainstorm card ↔ AI conversation interaction.

## Pick
Mirror the existing `AI_ASK_FROM_EDITOR` window-event decoupling. **In (P4):** card→context path dispatches `AI_ASK_FROM_EDITOR` with `{verb:"ask", sel:{text,words}}` from card text — zero AI-panel-internal changes. **Out (P5):** new `"brainstorm:add-card"` window event dispatched by `AiSlot`, handled inside `BoardCanvasBody` (which holds board doc + React Flow context), calling `createBoardCard` + `plainTextToCardFragment` wrapped in `doc.transact`. **v1 scoping:** single-card context-menu target; one card per AI reply; "Add to board" button renders only when `p.view === "brainstorm"`; inspector Scene tab hidden in brainstorm; panel defaults to Assistant tab.

## Rationale
The window-event bus is the codebase's established cross-view decoupling idiom; prop-threading the board doc is infeasible. v1 scoping ships the two-way bridge without speculative multi-select/split machinery.

## Consequences
Two new window-event channels; new `boardDoc.ts` write primitive; `AiSlot` "Add to board" button brainstorm-view-gated. Multi-card-select and reply-splitting are deferred follow-ups.

## Enforcement
advisory-only (unit test on `plainTextToCardFragment` round-trip; event wiring smoke-confirmed by Cole).
