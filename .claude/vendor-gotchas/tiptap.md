---
vendor: "tiptap + yjs"
sdkVersion: "TipTap v3 + Yjs"
firstWritten: 2026-06-03
lastVerified: 2026-06-11
relatedPaths:
  - src/yjs/serialize.ts
  - src/yjs/bindPersistence.ts
  - src/editor/Editor.tsx
notes: "TipTap v3 + Yjs binding gotchas, especially around content storage type and plaintext extraction"
---

# TipTap + Yjs gotchas

## 2026-06-03 — TipTap Collaboration field: "content" is Y.XmlFragment, not Y.Text; getText() on it throws

Source: wave-3-scene-notes, commit 36eb547b2908165ddaca27ae1be185bf967f61f5

**Gotcha:** TipTap v3's Collaboration extension binds editor content to `doc.getXmlFragment("content")`. Pre-existing tests wrongly called `doc.getText("content")`, which appeared to work in isolation but is incorrect. When a plaintext extraction path later tried to read from the same key with the correct type, the mismatch became visible: Yjs enforces one type per Y.Doc key — calling `getText("content")` when "content" is bound as XmlFragment throws.

**Workaround:** Always use `doc.getXmlFragment("content")` when reading TipTap editor content. Do not use `doc.getText("content")` or `editor.getText()` (the latter is not available in save paths that lack an editor instance). Traverse the XmlFragment recursively: iterate XmlElements and XmlTexts; join top-level blocks with `\n`.

**Why:** TipTap's `field: "content"` configuration explicitly creates an XmlFragment in the Y.Doc, not a Y.Text structure. The storage type is fixed at bind time. Pre-existing test code used an isolated `new Y.Doc()` that never touched the real TipTap editor, so the mismatch was dormant until plaintext extraction in the save path (which lacks an editor instance to call `.getText()` on) tried to use `getText("content")`. This is a library contract violation that only surfaces when you need to read content outside the editor context.

## 2026-06-05 — TipTap/ProseMirror Plugin: async operations in plugins need aliveRef guard + useState→useEffect pattern

Source: wave-27, commit 42a04ab

**Gotcha:** Writing a ProseMirror Plugin that performs async operations (e.g., loading entity details from a store) from a pluginView or helper, then calling React setState on the result, causes race conditions: the state update fires after the component unmounts or the plugin is destroyed, throwing a memory-leak warning. Example: AutoLink decoration plugin fetches entity details asynchronously; if the user closes the popup before the fetch completes, the `setState` fires against a destroyed component.

**Workaround:** Use a `useRef` to track whether the component/hook is still alive, and guard the `setState` call behind an `alive` check. Pair this with a cleanup return in the `useEffect` that sets `alive = false`. Pattern (from `useEntityDetails` in AutoLinkPeek):

```typescript
const aliveRef = useRef(true);
const [state, setState] = useState<T>(initialValue);

useEffect(() => {
  aliveRef.current = true;
  asyncOperation()
    .then((result) => {
      if (!aliveRef.current) return;
      setState(result);
    })
    .catch((e) => { console.error(e); if (aliveRef.current) setState(fallback); });
  return () => { aliveRef.current = false; };
}, [deps]);
```

**Why:** React/ProseMirror lifecycle is not guaranteed to outlive async operations. The `aliveRef` pattern is the standard React approach to prevent state updates on unmounted components. In a plugin context, the component's unmount, the plugin's destroy callback, and the async resolve can race; the alive flag ensures only updates to living instances are committed. Do NOT use conditional setState (e.g., `if (isMounted)`) because that variable is stale; useRef is required because it persists across renders.

## 2026-06-08 — ProseMirror reverts external DOM mutations on rendered nodes; scrollIntoView on PM nodes causes 480k+/sec loops

Source: wave-28, commit 77e2f08

**Gotcha:** ProseMirror's MutationObserver automatically reverts external `data-*` attribute mutations on `.prose p` and other PM-rendered elements within ~800ms, **even when the caret is outside the editor**. Calling `scrollIntoView` on a PM node (e.g., `para.scrollIntoView()`) triggers a redraw, creates a new `<p>` object with a different identity, and breaks identity-based reference tracking (e.g., `para === prevRef` never matches again), causing a self-sustaining infinite loop of selection-change → scroll → redraw → new object → selection-change. Live reproduction: 480k+ `scrollIntoView` calls/sec, CPU maxed, loop never breaks without intervention.

**Workaround:** Implement visual state (focus dim, highlights, scroll behavior) as **TipTap v3 ProseMirror extensions**, not external DOM mutation. Use `Decoration.node({class: 'pm-focused'})` for styling — PM renders the class, cannot revert it. For scroll effects, scroll the scroll-CONTAINER (e.g., `.canvas-scroll`) via `view.dispatch(tr)` + `coordsAtPos()`, **never** `scrollIntoView()` on a PM node. Use `PluginKey` per effect + `setMeta()` in `useEffect` to update extension flags reactively. Precedent: `src/editor/extensions/AutoLink.ts` (decoration) and `src/editor/extensions/FocusModeExtension.ts` (decoration + container scroll).

**Why:** ProseMirror owns the rendered DOM as its source-of-truth and treats external mutations as corruption to be cleaned up. PM node identity is ephemeral — nodes are detached/reattached on every redraw, so holding a reference across a redraw is unreliable. Decoration is ProseMirror's intended API for transient visual state; it's stable across redraws. Extensions provide the correct abstraction boundary: configuration + reactive updates via `setMeta()` + update hooks that run on every change, ensuring state stays synchronized with the document.

## 2026-06-08 — jsdom cannot validly test ProseMirror editor behavior; green vitest does NOT mean working

Source: wave-28, commit 77e2f08

**Gotcha:** jsdom (the DOM polyfill used by Vitest/Jest) lacks layout, MutationObserver, and real scroll behavior—`scrollIntoView()` is a no-op, `getBoundingClientRect()` returns zeros, and mutations are not observed. Tests for editor-behavior assertions (decorations persisting, scroll firing, focus effects working) pass green in jsdom but fail at runtime. Live example: P7 focus mode passed jsdom tests structurally (decoration elements created in the DOM tree) but looped infinitely live (MutationObserver + scroll loop never triggered in jsdom, so the broken loop was invisible).

**Workaround:** Use **CDP smoke testing** (real Tauri app running via `npm run tauri dev` + `tauri-devtools` MCP for screenshot + `evaluate_script`) as the behavioral oracle for any editor effect or ProseMirror-specific behavior. Reserve jsdom tests for structure-only assertions (element exists, attributes correct, imports resolved). Behavioral coverage requires live-runtime smoke. Acceptance tests for editor features should be annotated as "structure verified; behavior verified by CDP smoke on [date]" to flag the gap.

**Why:** ProseMirror's advanced features (DOM-mutation handling, scroll tracking, decoration lifecycle, layout-dependent positioning) require a real browser environment. jsdom is too minimal to execute these correctly. Relying on jsdom green ✓ as a gate for editor behavior is the exact failure mode that surfaced this wave (P7 shipped broken twice, passing jsdom both times). The cost of false negatives (behavior broken, tests green) outweighs the cost of running a live browser smoke.

## 2026-06-08 — Multiple TipTap v3 extensions must use distinct PluginKeys with isolated decoration sets

Source: wave-28, commit 50b9622

**Gotcha:** TipTap v3 / ProseMirror plugins share a global plugin registry. When two extensions (e.g., focus dim + auto-link, both using `Decoration.node()`) update the same `PluginKey` or share a decoration state pool, their decorations interfere: one extension's update clears or corrupts the other's decorations, causing visual glitches (highlights vanish, dim disappears, underlines blink).

**Workaround:** Each extension gets its own `PluginKey` and manages its own decoration set independently. In extensions that export a `useEffect`-style hook to update flags reactively, use `setMeta(pluginKey)` in separate transactions for each extension:
```typescript
// Focus dim effect
editor.view.dispatch(tr.setMeta(focusModeKey, { focused: true, paraIndex: n }));
// Separate transaction for autolink (auto-dispatched inside Editor.tsx deps array)
// Never in the same transaction
```
Never nest one extension's state update inside another's plugin apply method.

**Why:** ProseMirror's plugin architecture assumes each plugin owns its decoration set independently. Shared state or overlapping decoration updates violate this contract. Extensions using the same PluginKey or trying to coordinate decorations at the state pool level will have their updates race, causing one to overwrite the other. Isolation via distinct keys guarantees each extension's visual state is stable across document changes and other extensions' updates.

## 2026-06-11 — TipTap Collaboration cannot reach Y.XmlFragment nested inside Y.Map; store metadata separately
Source: wave-32-brainstorm-boards, commit 0c1784a

**Gotcha:** When designing a Yjs doc schema for TipTap-backed content, storing card text as a nested Y.XmlFragment inside a Y.Map value (e.g., `doc.getMap('cards').get(cardId).text = new Y.XmlFragment()`) makes the fragment unreachable by TipTap's Collaboration extension. TipTap's `field:` parameter only reaches **top-level** doc fragments (e.g., `doc.getXmlFragment('card-<id>')`, not `.get('cards').get(cardId).text`). Attempting to bind a nested fragment silently fails or produces a blank editor.

**Workaround:** Store card **metadata** (position, id, references, timestamps) as plain JSON values in the Y.Map (e.g., `doc.getMap('cards').set(cardId, { x, y, w, entityRef, graduated })`). Store card **content** (rich text) as **top-level** Y.XmlFragments with a key derived from the card id (e.g., `doc.getXmlFragment('card-<id>')` for a card with id `<id>`). This separates the metadata layer (accessed via Y.Map iteration) from the content layer (accessed via TipTap's Collaboration `field:` parameter). Example schema:
- `doc.getMap('cards')` = `{ cardId1: { x: 100, y: 200, ... }, cardId2: { ... } }`
- `doc.getXmlFragment('card-cardId1')` = card text content (bound to TipTap editor with `field: 'card-cardId1'`)

**Why:** TipTap's Collaboration extension binds to a Y.XmlFragment at initialization time, using the `field:` parameter to look it up in the doc root. The lookup is a simple `doc.getXmlFragment(fieldName)` call, not a recursive key path; nested fragments are outside the protocol. Separating metadata from content respects this boundary and keeps the schema simple and sync-ready (Phase 2 forward).

