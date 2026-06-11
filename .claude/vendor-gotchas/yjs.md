---
vendor: "Yjs"
sdkVersion: "13.x"
firstWritten: 2026-06-05
lastVerified: 2026-06-11
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

## 2026-06-11 — Yjs Y.Map overwrites cause tombstone accumulation; per-pointer-move writes bloat state_base64 monotonically
Source: wave-32-brainstorm-boards, commit 0c1784a

**Gotcha:** When a Y.Map value is updated frequently (e.g., on every `pointermove` event while dragging a card across a canvas), each `set()` call creates a tombstone entry in the Yjs operation log. The encoded state (`encodeState()` / `state_base64` serialization) includes all tombstones, growing monotonically with each update. A 100px drag with per-pixel position writes can triple the persisted doc size, bloating SQLite and slowing encode/decode operations. This is a CRDT characteristic — not a bug, but a load-bearing performance gotcha.

**Workaround:** Defer position writes to high-level events (e.g., drag END, not drag MOVE). Use local, non-persisted state (e.g., React component state or a Zustand store outside the Y.Doc) to track in-flight drag coordinates. Only commit the final position to the Y.Map on `dragend` or `pointerup`. For the boards feature, this reduced a single drag from ~50 Y.Map updates to exactly 1. Verify in smoke tests: one position update per card per drag by inspecting the Y.Doc update count or the final `state_base64` size.

**Why:** Yjs's CRDT model requires recording every operation so concurrent edits can be merged correctly. Frequent overwrites of the same key create many intermediate states that don't affect the final value but do persist in the history. At-event-conclusion writes avoid this bloat.

## 2026-06-11 — bindPersistence unbind was dropping pending debounced saves; any write within 500ms of unmount was silently lost
Source: wave-32-brainstorm-boards, commit 0c1784a

**Gotcha:** The `bindPersistence` helper (in `src/yjs/bindPersistence.ts`) binds a Y.Doc to SQLite storage with a 500ms debounced save-on-change. When the component unmounts or the feature switches away, the unbind handler fires but did **not** flush the pending debounced write. Any content typed within 500ms before switching scenes / views / boards would be silently dropped on save (the component unmount happened before the debounce timer fired). This affected scene-editor Ctrl+S autosave AND board view switches, creating data-loss scenarios when users switched between boards quickly.

**Workaround:** The unbind handler now explicitly flushes any pending debounced save before detaching the persistence listener. If `bindPersistence` is called elsewhere (e.g., new features with Yjs storage), ensure the cleanup function is: `return () => { flushPendingSave(); doc.off('update', handler); }` — the flush MUST run before the 'update' listener is removed, so the final dirty state is written to the DB.

**Why:** Debounced saves are an optimization to batch frequent writes (typing, positioning) into fewer DB round-trips. But if unmount happens before the debounce window closes, the optimization becomes data loss. The fix ensures the final state is always persisted, even on rapid scene switches. Test this by: (1) making a change to a board/scene, (2) immediately switching away, (3) reloading the app and verifying the change persists.

