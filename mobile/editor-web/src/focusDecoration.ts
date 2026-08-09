import type { Node as ProseMirrorNode } from "../../../node_modules/@tiptap/pm/model";
import { Plugin, PluginKey } from "../../../node_modules/@tiptap/pm/state";
import { Decoration, DecorationSet } from "../../../node_modules/@tiptap/pm/view";

export interface FocusDecorationState {
  enabled: boolean; dimParagraphs: boolean; typewriter: boolean; activeParagraph: number | null;
}

export const focusDecorationKey = new PluginKey<DecorationSet>("writersnook-mobile-focus");

function decorations(doc: ProseMirrorNode, focus: FocusDecorationState): DecorationSet {
  if (!focus.enabled || !focus.dimParagraphs || focus.activeParagraph === null) return DecorationSet.empty;
  const position = Math.min(Math.max(0, focus.activeParagraph), doc.content.size);
  const resolved = doc.resolve(position); let depth = resolved.depth;
  while (depth > 0 && !resolved.node(depth).isBlock) depth -= 1;
  if (depth === 0) return DecorationSet.empty;
  const from = resolved.before(depth); const node = resolved.node(depth);
  return DecorationSet.create(doc, [Decoration.node(from, from + node.nodeSize, { class: "focus-active-paragraph" })]);
}

export function focusDecorationPlugin() {
  return new Plugin<DecorationSet>({
    key: focusDecorationKey,
    state: { init: () => DecorationSet.empty, apply(transaction, previous) {
      const focus = transaction.getMeta(focusDecorationKey) as FocusDecorationState | undefined;
      return focus ? decorations(transaction.doc, focus) : previous.map(transaction.mapping, transaction.doc);
    } },
    props: { decorations(state) { return focusDecorationKey.getState(state) ?? null; } },
  });
}
