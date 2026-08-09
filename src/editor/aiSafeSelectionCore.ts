/**
 * aiSafeSelection.ts — mark-aware selection text extraction (W52 Phase 2).
 *
 * Provides:
 *  - `extractAiSafeSelection(pmDoc, from, to)` — pure helper that walks
 *    ProseMirror text nodes in [from, to] and replaces ranges carrying the
 *    `aiExclude` mark with AI_HIDDEN_PLACEHOLDER. Testable without mounting
 *    an editor (accepts a PM Node directly).
 *  - `activeEditorRef` — a module-level mutable ref that Editor.tsx writes to
 *    (on mount/update) so useProseSelection can read the live editor view's
 *    selection positions mark-aware, without prop-drilling through 5 layers.
 *    Pattern mirrors `captureProseRef` in App.content.editor.tsx.
 */

import type { Node as PmNode } from "@tiptap/pm/model";

import { AI_HIDDEN_PLACEHOLDER } from "../yjs/serialize";

// ── Pure helper ────────────────────────────────────────────────────────────────

/**
 * Walk ProseMirror text nodes between `from` and `to`, replacing each text
 * node that carries the `aiExclude` mark with AI_HIDDEN_PLACEHOLDER.
 * Non-text nodes (inline images, etc.) are skipped silently.
 *
 * Mid-node slicing: nodesBetween delivers full text nodes even when the
 * selection starts/ends inside one. We slice the plain-text portion to the
 * actual selected range using `pos` (the node's document start position).
 * For marked nodes the placeholder is emitted once per node (not per slice)
 * — the placeholder represents the hidden run, regardless of how much of
 * the run was selected.
 *
 * @param doc  A ProseMirror Node (the editor doc or a test document).
 * @param from Start position (inclusive).
 * @param to   End position (exclusive).
 * @returns    The redacted plain-text string.
 */
export function extractAiSafeSelection(doc: PmNode, from: number, to: number): string {
  let result = "";
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true; // descend into block/inline nodes
    const text = node.text ?? "";
    const isExcluded = node.marks.some((m) => m.type.name === "aiExclude");
    if (isExcluded) {
      result += AI_HIDDEN_PLACEHOLDER;
    } else {
      // Slice to the portion actually within [from, to].
      const start = Math.max(0, from - pos);
      const end = Math.min(text.length, to - pos);
      result += text.slice(start, end);
    }
    return false; // text nodes have no children
  });
  return result;
}

