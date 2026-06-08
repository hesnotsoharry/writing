/**
 * DropCapGate — wraps the first character of the first top-level paragraph in
 * a real `<span class="drop-cap-letter">` via a ProseMirror inline Decoration.
 *
 * Why a Decoration instead of `::first-letter` + class toggle:
 *   The old approach (`props.attributes` setting `dropcap-ready`, gating the
 *   `::first-letter` rule) stranded the caret when the paragraph had only one
 *   character. `::first-letter` is a pseudo-element — not a real DOM node —
 *   so ProseMirror cannot resolve caret offset-1 against it. A `Decoration.inline`
 *   produces an actual `<span>` that PM's caret can navigate around cleanly.
 *
 * Why not useEffect / external DOM: ProseMirror's MutationObserver reverts
 * external content-DOM mutations; PM-internal decorations are the only safe
 * path (wave-28 P7 lesson).
 */

import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const dropCapKey = new PluginKey("dropCapGate");

/**
 * Returns true when the first top-level node is a paragraph with at least one
 * character — the gate condition for placing the drop-cap decoration.
 * Activates on the FIRST keystroke (length >= 1), unlike the prior predicate
 * which required length > 1.
 */
export function firstParaHasContent(doc: Node): boolean {
  const first = doc.firstChild;
  return (
    first !== null &&
    first.type.name === "paragraph" &&
    first.textContent.length >= 1
  );
}

/**
 * Builds a DecorationSet that wraps the first character of the first paragraph
 * (positions 1..2 in the document — inside para after its opening node token)
 * in a span with class "drop-cap-letter". Returns empty if the gate fails.
 */
function buildDecorations(state: EditorState): DecorationSet {
  if (!firstParaHasContent(state.doc)) {
    return DecorationSet.empty;
  }
  // Position 0 = before para opening token; 1 = inside para before first char;
  // 2 = after first char. Positions are always valid given the gate above.
  return DecorationSet.create(state.doc, [
    Decoration.inline(1, 2, { class: "drop-cap-letter" }),
  ]);
}

function createDropCapPlugin(): Plugin {
  return new Plugin({
    key: dropCapKey,
    props: {
      decorations(state: EditorState): DecorationSet {
        return buildDecorations(state);
      },
    },
  });
}

const DropCapGate = Extension.create({
  name: "dropCapGate",
  addProseMirrorPlugins() {
    return [createDropCapPlugin()];
  },
});

export default DropCapGate;
