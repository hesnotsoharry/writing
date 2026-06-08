/**
 * FocusModeExtension — ProseMirror-native focus-mode effects.
 *
 * Architecture:
 * - A ProseMirror Plugin holds a DecorationSet + flags as plugin state.
 * - Paragraph dimming: decorates the caret's paragraph with class `pm-focused`.
 *   The CSS rule `[data-focus][data-dim] .prose p.pm-focused { opacity: 1 }` restores it.
 * - Typewriter scroll: fires on paragraph CHANGE only (not on every keystroke)
 *   to avoid a smooth-scroll → selection → redraw feedback loop.
 * - Reactive config: host dispatches `setMeta(focusModeKey, flags)` when settings change.
 *
 * Replaces the broken pure-DOM hook (wave-28 P7): ProseMirror's MutationObserver
 * reverts external content-DOM mutations within ~800ms, making DOM-outside-PM unworkable.
 */

import { Extension } from "@tiptap/core";
import { type EditorState, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FocusFlags {
  focusMode: boolean;
  dimOn: boolean;
  typewriterOn: boolean;
}

interface PluginState {
  decos: DecorationSet;
  flags: FocusFlags;
}

export const focusModeKey = new PluginKey<PluginState>("focusMode");

// ---------------------------------------------------------------------------
// Plugin state builder
// ---------------------------------------------------------------------------

function buildPluginState(state: EditorState, flags: FocusFlags): PluginState {
  if (!flags.focusMode || !flags.dimOn) return { decos: DecorationSet.empty, flags };
  const sel = state.selection;
  // FIX (review angle 2): only TextSelection has a meaningful caret paragraph.
  // NodeSelection / GapCursor mis-target before(depth). Guard depth>=1 too.
  if (!(sel instanceof TextSelection)) return { decos: DecorationSet.empty, flags };
  const $a = sel.$anchor;
  if ($a.depth < 1) return { decos: DecorationSet.empty, flags };
  const from = $a.before($a.depth);
  const to = from + $a.parent.nodeSize;
  return {
    decos: DecorationSet.create(state.doc, [Decoration.node(from, to, { class: "pm-focused" })]),
    flags,
  };
}

// ---------------------------------------------------------------------------
// Typewriter scroll — extracted to keep update() below complexity 10.
// ---------------------------------------------------------------------------

function doTypewriterScroll(container: HTMLElement, view: EditorView, anchor: number): void {
  const coords = view.coordsAtPos(anchor);
  const caretMidY = (coords.top + coords.bottom) / 2;
  const rect = container.getBoundingClientRect();
  const containerMidY = rect.top + rect.height / 2;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  container.scrollTo({
    top: container.scrollTop + caretMidY - containerMidY,
    behavior: reduced ? "instant" : "smooth",
  });
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

function createFocusModePlugin(initial: FocusFlags): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: focusModeKey,
    state: {
      init(_, state) { return buildPluginState(state, initial); },
      apply(tr, old, _o, newState) {
        const meta = tr.getMeta(focusModeKey) as FocusFlags | undefined;
        if (meta === undefined && !tr.selectionSet && !tr.docChanged) return old;
        return buildPluginState(newState, meta ?? old.flags);
      },
    },
    props: {
      decorations(state) { return focusModeKey.getState(state)?.decos ?? DecorationSet.empty; },
    },
    view() {
      return {
        update(view: EditorView, prev: EditorState): void {
          const ps = focusModeKey.getState(view.state);
          if (!ps?.flags.focusMode || !ps.flags.typewriterOn) return;
          const sel = view.state.selection;
          if (!(sel instanceof TextSelection)) return;
          const $a = sel.$anchor;
          if ($a.depth < 1) return;
          const $p = prev.selection.$anchor;
          // Only scroll on paragraph CHANGE — kills same-paragraph keystroke churn.
          if ($p.depth >= 1 && $a.before($a.depth) === $p.before($p.depth)) return;
          const container = view.dom.closest(".canvas-scroll") as HTMLElement | null;
          if (!container) return;
          doTypewriterScroll(container, view, sel.anchor);
        },
      };
    },
  });
}

// ---------------------------------------------------------------------------
// TipTap Extension
// ---------------------------------------------------------------------------

// FIX (review angle 4 — no cold-start flash): host must pass current flag values
// into configure() so the initial plugin state reflects reality on first render.
const FocusModeExtension = Extension.create<FocusFlags>({
  name: "focusMode",
  addOptions() { return { focusMode: false, dimOn: true, typewriterOn: true }; },
  addProseMirrorPlugins() { return [createFocusModePlugin(this.options as FocusFlags)]; },
});

export default FocusModeExtension;
