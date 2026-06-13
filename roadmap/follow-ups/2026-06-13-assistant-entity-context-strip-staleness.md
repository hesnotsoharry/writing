---
status: OPEN
created: 2026-06-13
qualifying-criterion: multi-file
cannot-be-cleared-by: single sonnet-implementer dispatch — requires designing and wiring a new story-bible/entity mutation event through the store's CRUD layer + a reactive subscription in the AI panel
present-harm: K3 — wave-35 wave-end review (2026-06-13, agent a7e7bb3d) traced a narrow D4 display-vs-send staleness window: when a user adds an entity to a scene while the Assistant panel is open on that same scene, the entity IS sent to the AI (assembleContext re-fetches live at send time), but the context-strip chip/receipt does NOT yet show the new entity because useSceneEntityGroups only re-fires on [sceneId, store] dependency changes, not on entity mutations. Verifiable at slot.ts:27 deps + ai.context.ts:174-176 fetch (commit 900aa50 fixed the structural D4 parity BLOCK; this is the residual edge).
---

# Follow-up: Assistant entity context-strip staleness window

## Context

Wave 35 Phase E (context assembly v2) enforced a D4 rule: "everything sent is represented as a chip" (the context-strip chip/receipt must match the actual assembled context sent to the AI). A structural BLOCK was found (wave-end review, 2026-06-13) where shielded entities appeared in both the receipt AND the context — fixed by commit 900aa50 to filter consistently.

However, a narrow residual edge-case remains: **display-vs-send staleness on entity add while the panel is open**.

## Issue

**Reproduction:**
1. Open the Assistant panel on scene "A".
2. The context-strip shows "Saw test1, test2" (current entities in the scene).
3. While the panel is open and visible, switch to the Story Bible and add a NEW entity to scene "A".
4. Return to the editor with the Assistant panel still open.
5. The context-strip still shows "Saw test1, test2" (new entity NOT yet visible).
6. Send an Ask to the Assistant.
7. The AI receives the ask WITH the new entity included (assembleContext fetches fresh at send time).
8. The you-message receipt shows "Saw test1, test2, new entity" (NOW it appears).
9. The context-strip remains stale until the user manually switches scenes or the component re-mounts.

**Root cause:**

In `src/features/ai/AssistantPanel.slot.ts` line 27:
```typescript
useSceneEntityGroups(sceneId, store)  // deps: [sceneId, store]
```

The hook only re-fires when `sceneId` or `store` identity change. Story-Bible mutations (adding an entity to an existing scene) do not change either dependency, so `useSceneEntityGroups` does not re-fetch the entity list. Meanwhile, `assembleContext` (src/features/ai/ai.context.ts:174-176) fetches fresh at every send, so the AI receives the new entity.

This creates a visual inconsistency: the context-strip lags behind the actual send. While the AI response is correct, the user's mental model of "what am I sending?" becomes misaligned with reality.

## Why this is a follow-up and not Phase 0 inline

Fixing this requires:

1. **New mutation event design:** Story-Bible mutations (entity add/rename/delete) currently have no observable event. The `storyBibleStore` has no `onEntityMutation` or equivalent broadcast.
2. **Store public-surface change:** The store needs to expose a mutation signal (event emitter, or a callback registry) so external code can subscribe.
3. **Panel subscription wiring:** The `AiSlot` or a new hook must subscribe to the entity-mutation event and trigger a re-fetch of `useSceneEntityGroups`.
4. **Cross-subsystem coordination:** The change spans `src/db/storyBibleStore.ts` (or its consumers), `src/features/ai/AssistantPanel.slot.ts` (subscriber), and the inspector panel (which may also need the same subscription for consistency).

This is **multi-file, multi-boundary architectural work** — not a single sonnet-implementer dispatch.

## Suggested approach

1. **Design the mutation event:** Decide whether to add an `onEntityMutation` callback registry to the store, an event emitter, or a Zustand middleware. Match the project's reactive pattern (store-based or event-based).
2. **Extend the store public surface:** Expose the mutation observer in `src/db/storyBibleStore.ts` (or wrap it in the caller's update path).
3. **Wire the panel subscription:** In `AssistantPanel.slot.ts` or a dedicated hook, subscribe to entity mutations for the active scene and call `refetch()` on the entities.
4. **Test the full path:** Verify entity add/rename/delete mutations trigger a panel context-strip update without a scene switch.
5. **Inspector parity:** Ensure the inspector also reflects new entities immediately (likely the same subscription wiring).

---

*Created during wave-35 wrap audit. Qualified as multi-file (store + panel + slot = 3+ files), cross-boundary (store public surface), cannot be cleared by a single sonnet-implementer dispatch (requires new event design + wiring across subsystems).*
