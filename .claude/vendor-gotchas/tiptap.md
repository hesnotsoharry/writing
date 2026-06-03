---
vendor: "tiptap + yjs"
sdkVersion: "TipTap v3 + Yjs"
firstWritten: 2026-06-03
lastVerified: 2026-06-03
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

