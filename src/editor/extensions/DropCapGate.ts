/**
 * DropCapGate — gates the CSS drop-cap so it only activates once the first
 * paragraph contains more than one character.
 *
 * Mechanism: a PM plugin's `props.attributes(state)` adds `dropcap-ready` to
 * the editable element's class list when the predicate fires. ProseMirror merges
 * contributions from all plugins, so the element carries both `prose` (from
 * editorProps) and `dropcap-ready` simultaneously when active. PM re-evaluates
 * on every state transaction — reactive with no useEffect required.
 *
 * The CSS rule in app.css is gated via `.prose.dropcap-ready p:first-of-type::first-letter`.
 *
 * Why not useEffect / external DOM: ProseMirror's MutationObserver reverts
 * external content-DOM mutations; PM-internal attribute merging is the only
 * safe path (wave-28 P7 lesson).
 */

import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";

export const dropCapKey = new PluginKey("dropCapGate");

/**
 * Returns true when the first top-level paragraph contains more than one
 * character — the gate condition for activating the CSS drop-cap.
 * Extracted as a named export so it can be unit-tested at the pure-function level.
 */
export function firstParaHasMultipleChars(doc: Node): boolean {
  const first = doc.firstChild;
  return first !== null && first.textContent.length > 1;
}

function createDropCapPlugin(): Plugin {
  return new Plugin({
    key: dropCapKey,
    props: {
      attributes(state: EditorState): Record<string, string> {
        return firstParaHasMultipleChars(state.doc)
          ? { class: "dropcap-ready" }
          : {};
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
