---
vendor: "Yjs"
sdkVersion: "13.x"
firstWritten: 2026-06-05
lastVerified: 2026-06-08
relatedPaths:
  - src/storybible/fullEntry/EgoGraph.tsx
  - src/db/storyBibleStore.ts
  - src/App.snapshots.ts
  - src/db/manuscriptSearchStore.ts
notes: "Yjs observable subscriptions and reactive graph updates; patterns for listening to external data mutations. Plus: refreshing the open editor after a doc-level replace/restore (scene-reload, not applyUpdate)."
---

# Yjs gotchas

## 2026-06-08 — Yjs is append-only: to live-refresh the open editor after a doc-level replace/restore, reload the scene — do NOT `Y.applyUpdate` the new state

Source: wave-28, commit 745c0e8 (Find & Replace open-scene live-refresh)

**Gotcha:** After a feature rewrites a scene's whole doc out-of-band (e.g. Find & Replace builds a new doc and writes it to the DB), the currently-open editor shows stale text until the scene is reopened — the DB is correct but the live `Y.Doc` the editor's Collaboration binding holds was never updated. The tempting fix — `applyEncoded(ctx.doc, newStateBase64)` / `Y.applyUpdate(liveDoc, newState)` — is a **trap**:
- Yjs is a CRDT: updates are **append-only and merge; they never roll back**. Applying the forward (replaced) state works once, but the snapshot-based **undo** path (`snapUndoReplace` → `applyEncoded(ctx.doc, preReplaceState)`) then becomes a **no-op** — the pre-replace ops are already a subset of the advanced doc, so the editor stays on the replaced text. You trade a forward-staleness bug for an undo-staleness bug.
- Patching the live doc forward also **diverges it from the DB** and **races the `bindPersistence` 500ms debounce** (the debounced save can clobber a subsequent restore).

**Workaround:** Re-hydrate from canonical DB state via the existing scene-load/switch handler (`handleSelectScene`) on BOTH the forward path and the undo path, AFTER the DB write/restore resolves. This creates a fresh `Y.Doc` from the DB (no CRDT rollback problem, no live-doc/DB divergence, closes the debounce race). Guard: only reload when the mutated scene IS the currently-open one; non-open scenes are DB-only. The app's replace-undo is snapshot-based (`snapUndoReplace`), not the Yjs UndoManager, so scene-reload is consistent with its model. Verified live via CDP smoke (jsdom can't confirm a ProseMirror re-render — see [[editor-behavior-needs-cdp-smoke-not-jsdom]] / `tiptap.md`).

**Why:** "Apply an update to bring the doc to state X" only works in Yjs when X is *ahead* of the current state. For replace/restore (which can move the doc backward or laterally relative to live ops), the operation isn't expressible as a forward update — you must rebuild the doc from the target state, which is what a scene-reload does.

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

