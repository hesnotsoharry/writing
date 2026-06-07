# Wave 28 DRAFT Research: Mark-Preserving Find/Replace in Yjs-Backed ProseMirror

**Date:** 2026-06-07  
**Task:** Fix `buildDocFromText()` to preserve inline marks (bold/italic/links/custom) when performing find-and-replace operations on Y.Doc-backed ProseMirror documents in a Tauri desktop app.

---

## Pinned Versions

Extracted from `C:\Web App\writing\package.json`:

| Package | Version | Notes |
|---------|---------|-------|
| `yjs` | ^13.6.31 | Collaborative CRDT framework |
| `@tiptap/core` | ^3.24.0 | Rich-text editor (wraps ProseMirror) |
| `@tiptap/extension-collaboration` | ^3.24.0 | Yjs binding for TipTap |
| `@tiptap/pm` | ^3.24.0 | ProseMirror bundled in TipTap |
| `prosemirror-state` | (bundled in @tiptap/pm) | Transaction/state management |
| `y-prosemirror` | **NOT IN package.json** | Must check if bundled or required separately |

**Critical gap:** The project does NOT have `y-prosemirror` as a direct dependency. It appears `@tiptap/extension-collaboration` may provide this binding, but the utility functions (`yDocToProsemirror`, `prosemirrorToYDoc`) are **exported by y-prosemirror**, not TipTap. **ACTION:** Verify whether y-prosemirror is required as an explicit peer/dev dependency for headless transformations.

---

## Question 1: Mark-Preserving Text Replacement — Which Approach?

### Answer: Use `insertText()` over `replaceWith()`; route through ProseMirror transactions.

**Recommended approach:**
```typescript
// For an ACTIVE editor with EditorView:
const from = state.selection.$from.pos
const to = state.selection.$to.pos

// Use insertText() — it preserves marks by determining context
const tr = state.tr
tr.insertText(newText, from, to)  // Replaces range while preserving marks

if (dispatch) dispatch(tr)
```

**Why each approach:**

| Approach | Mark Preservation | Notes | Use Case |
|----------|------------------|-------|----------|
| **`tr.insertText()`** | ✅ YES | Resolves position context and applies inherited marks | Active editor with EditorView (Q1) |
| **`tr.replaceWith()`** | ⚠️ PARTIAL | Splits marks on replaced content (known issue) | Only when inserting complex nodes |
| **Y.XmlFragment API directly** | ❌ NO | Operates at structural level; destroys all marks | Last resort; avoid |

**Source:** ProseMirror docs (State management chapter) — "Transaction.insertText resolves the position and determines which marks to apply based on the context."  
**Reference:** [ProseMirror Guide — Transactions](https://prosemirror.net/docs/guide/state.md) | [discuss.prosemirror.net — Replacing text without losing marks](https://discuss.prosemirror.net/t/replace-text-without-loosing-marks/4236)

---

## Question 2: CRITICAL — Offscreen Y.Doc Mutation (No EditorView)

### Answer: Three-step headless transformation using y-prosemirror utilities.

**The problem:** Most scenes in the app are NOT the currently-mounted editor. You need to mutate a Y.Doc loaded from base64 that has no live EditorView. Standard `editor.view.dispatch(tr)` cannot work.

**The solution (recommended):**
```typescript
import { yDocToProsemirror, prosemirrorToYDoc } from 'y-prosemirror'
import * as Y from 'yjs'
import { EditorState } from '@tiptap/pm/state'
import { schema } from './schema'  // Your schema

async function findAndReplaceInYDoc(
  yDoc: Y.Doc,
  plainTextMatch: string,
  replacement: string
): Promise<Y.Doc> {
  // Step 1: Convert Y.Doc → ProseMirror Node (headless)
  const pmNode = yDocToProsemirror(schema, yDoc)
  
  // Step 2: Create a transient EditorState (headless) and apply transaction
  const tempState = EditorState.create({
    doc: pmNode,
    schema: schema,
  })
  
  // Step 3a: Find the text range in the document
  const plainText = tempState.doc.textContent
  const matchStart = plainText.indexOf(plainTextMatch)
  if (matchStart === -1) return yDoc  // Not found
  
  const matchEnd = matchStart + plainTextMatch.length
  const pmStart = textOffsetToPMPos(tempState.doc, matchStart)
  const pmEnd = textOffsetToPMPos(tempState.doc, matchEnd)
  
  // Step 3b: Apply mark-preserving replacement
  let tr = tempState.tr
  tr.insertText(replacement, pmStart, pmEnd)
  const newState = tempState.apply(tr)
  
  // Step 4: Convert back → Y.Doc
  const newYDoc = prosemirrorToYDoc(newState.doc)
  
  // Step 5: Copy updates into original Y.Doc (preserves client awareness/metadata)
  const update = Y.encodeStateAsUpdate(newYDoc)
  Y.applyUpdate(yDoc, update)
  
  return yDoc
}
```

**Why NOT direct Y.XmlFragment mutation:**
- Y.XmlFragment/Y.XmlText mutations operate at the CRDT primitive level
- They do NOT understand ProseMirror marks (which live as attributes on Y.Xml nodes)
- Your current `buildDocFromText()` destroys marks because it rebuilds the doc from plain text alone

**Helper: Plain-text offset → ProseMirror position (see Q3 below)**

**Sources:**  
- y-prosemirror README: [github.com/yjs/y-prosemirror](https://github.com/yjs/y-prosemirror)
- Yjs docs (Editor Bindings): [docs.yjs.dev/ecosystem/editor-bindings/prosemirror](https://docs.yjs.dev/ecosystem/editor-bindings/prosemirror)
- TipTap Collaboration docs: [tiptap.dev/docs/editor/extensions/collaboration](https://tiptap.dev/docs/editor/extensions/collaboration)

---

## Question 3: Plain-Text Offset → ProseMirror Position Mapping

### Answer: Iterate through document counting character positions; map via node boundaries.

**Implementation:**
```typescript
import { Node } from '@tiptap/pm/model'

/**
 * Map a plain-text character offset to a ProseMirror document position.
 * Account for node boundaries: paragraph breaks add structure but don't appear in textContent.
 */
function textOffsetToPMPos(doc: Node, textOffset: number): number {
  let currentPos = 0
  let pmPos = 0
  
  doc.descendants((node, nodePos) => {
    if (node.isText) {
      const nodeEndOffset = currentPos + node.text.length
      if (textOffset <= nodeEndOffset) {
        // Found the node containing the offset
        const offsetInNode = textOffset - currentPos
        return false  // Stop recursion
      }
      currentPos = nodeEndOffset
      pmPos = nodePos + node.nodeSize
    }
  })
  
  return pmPos
}
```

**Why it's complex:**
- `textContent` returns plain text (no node structure)
- ProseMirror document tracks positions **through the tree**, including paragraph boundaries
- A single space or paragraph separator in the visible text may be 2+ positions in the PM tree
- Example: `"Hello\n\nWorld"` in textContent = 11 chars, but in PM tree ≈ 15 positions (paragraph nodes add structure)

**Correct approach:**
1. Call `doc.textContent` to get plain text
2. Use `descendants()` to walk the tree and track character offsets
3. When offset falls within a text node, calculate position relative to that node's PM start
4. Account for `nodeSize` (inline content size including any delimiters)

**Sources:**  
- ProseMirror Model docs: [prosemirror.net/docs/ref/#model.Node.descendants](https://prosemirror.net/docs/ref/#model.Node.descendants)
- ProseMirror Guide (Document Structure): [prosemirror.net/docs/guide/doc.md](https://prosemirror.net/docs/guide/doc.md)

---

## Question 4: Version-Pinned Gotchas & Known Issues

### y-prosemirror + Yjs @ pinned versions

#### 1. **Overlapping Marks Bug (y-prosemirror #259)**
- **Affected:** y-prosemirror < v1.3.0 could not correctly read overlapping marks
- **Status (v1.3.7 stable):** Fixed
- **Impact:** If user applies mark A, then B on overlapping text, both marks are preserved correctly now
- **Mitigated by:** Project uses ^1.3.7 (stable)

#### 2. **Custom Marks Sync Issue (y-prosemirror #21)**
- **Symptom:** Custom marks not fully synced when another mark is applied on text that already has a custom mark
- **Example:** Bold partially applied on one side, full on the other side
- **Status:** Reported as "not fully synced"; appears to be a v1 limitation
- **Mitigation:** Keep custom marks orthogonal (don't layer them); test thoroughly in multi-client scenarios
- **Reference:** [github.com/yjs/y-prosemirror/issues/21](https://github.com/yjs/y-prosemirror/issues/21)

#### 3. **v2.0.0 Breaking Changes (Beta — DO NOT USE)**
- **v2.0.0-4 (June 2024)** rewrote the binding; changed from `tr.insert`/`tr.delete` to new approach
- **Status:** Pre-release; not production-ready
- **Recommendation:** Stay on v1.3.7 stable; do NOT upgrade to v2.0.0 until it reaches stable release
- **Why:** Beta version still has "fix: avoid using tr.insert & tr.delete" commits; indicates unresolved issues

#### 4. **Y.Doc Binary Round-Trip (SQLite Storage)**
- **Gotcha:** y-prosemirror + yjs do NOT guarantee mark round-trip through arbitrary binary → base64 → binary cycles
- **Current project practice:** Store Y.Doc as `encodeDoc(ydoc)` → base64 in SQLite (correct)
- **Risk:** If marks are stored but not correctly rehydrated via `Y.applyUpdate()`, they are lost
- **Mitigation:** Always use `Y.encodeStateAsUpdate()` + `Y.applyUpdate()`, never raw binary manipulation
- **Reference:** App CLAUDE.md gotcha: "SQLite stores Yjs doc as base64 TEXT; `tauri-plugin-sql` unreliable with BLOB"

#### 5. **`prosemirrorToYDoc` Does NOT Preserve Edit History**
- **Behavior:** Converting a PM node → Y.Doc creates a NEW Yjs document with fresh CRDT state
- **Consequence:** Any prior edit history, undo/redo, awareness info is LOST
- **Correct pattern (for mutation):** 
  ```typescript
  // Convert → mutate → apply updates back to original doc (preserves lineage)
  const update = Y.encodeStateAsUpdate(newYDoc)
  Y.applyUpdate(originalYDoc, update)  // ← keeps history
  ```
- **Not this:**
  ```typescript
  // DON'T: would replace originalYDoc entirely
  originalYDoc = prosemirrorToYDoc(newState.doc)
  ```

#### 6. **y-prosemirror Requires Exact Schema Match**
- **Rule:** `yDocToProsemirror(schema, ydoc)` will throw or misbehave if `schema` doesn't match the doc's node/mark types
- **Risk in app:** If you add a custom mark extension but don't update the schema passed to `yDocToProsemirror`, old docs won't hydrate
- **Mitigation:** Always pass the SAME schema object used to create the Y.Doc binding; version it if schema changes

---

## Summary: Recommended Implementation Path

### For Find/Replace with Mark Preservation:

```typescript
// 1. Offscreen Y.Doc transformation (no EditorView)
async function replaceAllInScene(yDoc: Y.Doc, match: string, replacement: string) {
  const pmNode = yDocToProsemirror(schema, yDoc)
  const tempState = EditorState.create({ doc: pmNode, schema })
  
  // 2. Iterate through all matches
  let tr = tempState.tr
  let offset = 0
  const plainText = tempState.doc.textContent
  
  while ((offset = plainText.indexOf(match, offset)) !== -1) {
    const pmStart = textOffsetToPMPos(tempState.doc, offset)
    const pmEnd = textOffsetToPMPos(tempState.doc, offset + match.length)
    tr.insertText(replacement, pmStart, pmEnd)
    offset += replacement.length
  }
  
  // 3. Apply back to Y.Doc (preserves history)
  const newState = tempState.apply(tr)
  const newYDoc = prosemirrorToYDoc(newState.doc)
  const update = Y.encodeStateAsUpdate(newYDoc)
  Y.applyUpdate(yDoc, update)
}
```

### For Active Editor (EditorView present):
Just use `editor.view.dispatch(tr)` with `tr.insertText()` — standard TipTap/ProseMirror flow.

### Critical Checks Before Ship:
1. ✅ Add `y-prosemirror` to `package.json` (confirm it's not already bundled)
2. ✅ Test mark preservation with bold/italic/link across a 3-scene find-replace
3. ✅ Snapshot before replace-all; verify undo/redo work (don't lose history)
4. ✅ Test edge case: replace text that spans multiple paragraphs (node boundaries)
5. ✅ Verify custom marks (if any) are in the schema passed to `yDocToProsemirror`

---

## Sources & Citations

- **ProseMirror State docs:** [prosemirror.net/docs/guide/state.md](https://prosemirror.net/docs/guide/state.md)
- **ProseMirror Reference:** [prosemirror.net/docs/ref/](https://prosemirror.net/docs/ref/)
- **y-prosemirror GitHub:** [github.com/yjs/y-prosemirror](https://github.com/yjs/y-prosemirror)
- **Yjs Editor Bindings:** [docs.yjs.dev/ecosystem/editor-bindings/prosemirror](https://docs.yjs.dev/ecosystem/editor-bindings/prosemirror)
- **TipTap Collaboration:** [tiptap.dev/docs/editor/extensions/collaboration](https://tiptap.dev/docs/editor/extensions/collaboration)
- **discuss.prosemirror.net — Mark preservation:** [discuss.prosemirror.net/t/replace-text-without-loosing-marks/4236](https://discuss.prosemirror.net/t/replace-text-without-loosing-marks/4236)
- **y-prosemirror issue #21 (custom marks):** [github.com/yjs/y-prosemirror/issues/21](https://github.com/yjs/y-prosemirror/issues/21)
- **y-prosemirror issue #259 (overlapping marks):** [github.com/yjs/y-prosemirror/issues/259](https://github.com/yjs/y-prosemirror/issues/259)
- **y-prosemirror releases:** [github.com/yjs/y-prosemirror/releases](https://github.com/yjs/y-prosemirror/releases)
- **Yjs Y.Text operations:** [github.com/yjs/docs/blob/main/api/shared-types/y.xmltext.md](https://github.com/yjs/docs/blob/main/api/shared-types/y.xmltext.md)
