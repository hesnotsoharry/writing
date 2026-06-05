---
vendor: "Yjs"
sdkVersion: "13.x"
firstWritten: 2026-06-05
lastVerified: 2026-06-05
relatedPaths:
  - src/storybible/fullEntry/EgoGraph.tsx
  - src/db/storyBibleStore.ts
notes: "Yjs observable subscriptions and reactive graph updates; patterns for listening to external data mutations."
---

# Yjs gotchas

## 2026-06-05 — Yjs: subscribe to store mutations, not just doc state, for derived UI (EgoGraph pattern)

Source: wave-27, commit fe27e3b

**Gotcha:** When a React component displays a derived view of data that depends on multiple Yjs docs or external store state (e.g., an ego-graph showing an entity and its relationship neighbors), listening only to the focal entity's Y.Doc mutations is insufficient. If relationships are stored in a separate table (not in the entity doc), changes to the relationships table will not trigger a re-render because the entity's doc itself did not change. The component will display stale relationship data until the user manually navigates away and back.

**Workaround:** Use an `onMutation` callback from the store (not the doc) to trigger a re-render. In the `storyBibleStore` interface, expose a method like `onRelationshipsChanged(callback)` that the component can subscribe to. When relationships change in the database, the store fires the callback, and the component re-fetches the relation set. Pattern (from EgoGraph in FullEntry):

```typescript
useEffect(() => {
  const unsub = store.onRelationshipsMutation?.(() => {
    // Re-fetch relations and re-render
    store.getRelations(entityId).then((rels) => setRelations(rels));
  });
  return () => unsub?.();
}, [entityId, store]);
```

This ties the component's render cycle to the store's business-logic mutations, not just Y.Doc changes. If using Yjs for the relationships themselves (not SQLite), use `Y.Array.observe` on the relations array and update state in the observer.

**Why:** Yjs subscriptions are document-scoped; a Y.Doc only fires events for mutations to that doc's contents. When data is split across a Yjs doc (the entity's text/facts) and an external store (the relationships table), the component must subscribe to both. Relying on the Yjs observer alone creates a silent inconsistency where the component is technically "subscribed to updates" but never sees the ones that matter for the derived view.

