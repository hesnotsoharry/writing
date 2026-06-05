---
vendor: "tiptap + yjs"
sdkVersion: "TipTap v3 + Yjs"
firstWritten: 2026-06-03
lastVerified: 2026-06-05
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

