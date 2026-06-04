import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

import { getSpeller } from "../lib/dictionary";
import type { GrammarSuggestion } from "../lib/ipc";
import type { ProofreadDecoSpec } from "./extensions/ProofreadExtension";
import { proofreadKey } from "./extensions/ProofreadExtension";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpellCheckPopoverProps {
  x: number;
  y: number;
  suggestions: GrammarSuggestion[];
  onSelect: (s: GrammarSuggestion) => void;
  onClose: () => void;
}

interface PopoverState {
  x: number;
  y: number;
  from: number;
  to: number;
  suggestions: GrammarSuggestion[];
}

// ---------------------------------------------------------------------------
// Presentational component
// ---------------------------------------------------------------------------

/**
 * Attaches listeners for Escape and click-outside to close the popover.
 */
function usePopoverDismiss(
  ref: React.RefObject<HTMLDivElement | null>,
  onClose: () => void
): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose, ref]);
}

/**
 * Closes the popover when the document changes — captured from/to go stale the
 * moment the doc mutates. Guard on `docChanged` so the proofread plugin's own
 * setMeta re-check transactions (no doc mutation) don't dismiss it each cycle (Fix 3).
 */
function useCloseOnDocChange(
  editor: Editor | null,
  setState: (s: PopoverState | null) => void,
): void {
  useEffect(() => {
    if (!editor) return;
    const handler = (arg: { transaction: { docChanged: boolean } }): void => {
      if (arg.transaction.docChanged) setState(null);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, setState]);
}

/**
 * Returns the display label for a GrammarSuggestion. "remove" shows "Delete";
 * all other kinds show the suggestion text (Decision F).
 */
function suggestionLabel(s: GrammarSuggestion): string {
  return s.kind === "remove" ? "Delete" : s.text;
}

/**
 * Renders a fixed-position list of spell/grammar suggestions at (x, y).
 * Fully props-driven — no editor knowledge.
 */
export function SpellCheckPopover({
  x,
  y,
  suggestions,
  onSelect,
  onClose,
}: SpellCheckPopoverProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  usePopoverDismiss(ref, onClose);
  const empty = suggestions.length === 0;

  return (
    <div
      ref={ref}
      className="spell-popover"
      style={{ left: x, top: y }}
      role="listbox"
      aria-label="Spelling suggestions"
    >
      {empty ? (
        <button className="spell-popover-item" disabled>
          No suggestions
        </button>
      ) : (
        suggestions.map((s, i) => (
          <button
            key={i}
            className="spell-popover-item"
            role="option"
            aria-selected={false}
            onClick={() => onSelect(s)}
          >
            {suggestionLabel(s)}
          </button>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// applySuggestion — exported for unit testing.
// ---------------------------------------------------------------------------

/**
 * Applies a GrammarSuggestion to a ProseMirror transaction, dispatching the
 * correct operation per kind (Decision F):
 *   "replace"      → replaceWith(from, to, schema.text(s.text))
 *   "remove"       → delete(from, to)
 *   "insert_after" → insertText(s.text, to)
 *
 * The empty-text guard for "replace"/"insert_after" prevents schema.text("")
 * from throwing (ProseMirror rejects empty text nodes). Tests pass a fake view
 * cast to EditorView.
 */
export function applySuggestion(
  view: EditorView,
  from: number,
  to: number,
  s: GrammarSuggestion,
): void {
  const { tr, schema } = view.state;

  if (s.kind === "replace") {
    if (!s.text) return; // schema.text("") throws
    view.dispatch(tr.replaceWith(from, to, schema.text(s.text)));
  } else if (s.kind === "remove") {
    view.dispatch(tr.delete(from, to));
  } else if (s.kind === "insert_after") {
    if (!s.text) return; // no-op for empty insert
    view.dispatch(tr.insertText(s.text, to));
  }
}

// ---------------------------------------------------------------------------
// Controller hook helpers
// ---------------------------------------------------------------------------

/**
 * Reads the decoration spec at the clicked position and resolves suggestions:
 * - spelling decorations: compute live from nspell (keep async path).
 * - grammar/style decorations: read directly from the spec (pre-computed by IPC).
 */
async function resolvePopoverSuggestions(
  specType: ProofreadDecoSpec["proofreadType"],
  specSuggestions: ProofreadDecoSpec["proofreadSuggestions"],
  word: string,
): Promise<GrammarSuggestion[]> {
  if (specType === "spelling") {
    try {
      const speller = await getSpeller();
      return speller.suggest(word).map((t) => ({ kind: "replace" as const, text: t }));
    } catch {
      return [];
    }
  }
  // grammar / style: suggestions already typed from IPC result.
  return specSuggestions;
}

/**
 * Creates a contextmenu handler that opens the popover on proofread decorations.
 */
function createContextMenuHandler(
  editor: Editor,
  setState: (state: PopoverState | null) => void
): (e: MouseEvent) => Promise<void> {
  return async (e: MouseEvent): Promise<void> => {
    if (!editor || editor.isDestroyed) return;

    const view = editor.view;
    const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!coords) return;

    const decoSet = proofreadKey.getState(view.state);
    if (!decoSet) return;

    // find(pos, pos+1): a zero-width range would miss the decoration when the
    // click lands exactly on the word's last character (overlap is half-open).
    const decos = decoSet.find(coords.pos, coords.pos + 1);
    if (decos.length === 0) return;

    e.preventDefault();

    const deco = decos[0];
    const spec = deco.spec as ProofreadDecoSpec;
    // Fix 5: guard against a decoration without a proofread spec (prevents
    // undefined.length throw if a non-proofread decoration is clicked).
    if (!spec || !spec.proofreadType) return;
    const word = view.state.doc.textBetween(deco.from, deco.to);

    const suggestions = await resolvePopoverSuggestions(
      spec.proofreadType,
      spec.proofreadSuggestions,
      word,
    );
    if (editor.isDestroyed) return; // editor torn down during the async fetch

    setState({
      x: e.clientX,
      y: e.clientY,
      from: deco.from,
      to: deco.to,
      suggestions,
    });
  };
}

// ---------------------------------------------------------------------------
// Controller hook
// ---------------------------------------------------------------------------

/**
 * Attaches a contextmenu listener to the editor DOM. When the right-click
 * lands on a proofread decoration (spelling or grammar), prevents the native
 * menu and opens the SpellCheckPopover with the appropriate suggestions.
 *
 * Returns spread-ready props for <SpellCheckPopover /> and a `visible` flag.
 */
export function useSpellCheckPopover(editor: Editor | null): {
  visible: boolean;
  popoverProps: SpellCheckPopoverProps;
} {
  const [state, setState] = useState<PopoverState | null>(null);

  useEffect(() => {
    if (!editor) return;

    const handler = createContextMenuHandler(editor, setState);
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener("contextmenu", handler);

    return () => {
      dom.removeEventListener("contextmenu", handler);
    };
  }, [editor]);

  useCloseOnDocChange(editor, setState);

  function onSelect(s: GrammarSuggestion): void {
    if (!state || !editor || editor.isDestroyed) return;
    const { from, to } = state;
    applySuggestion(editor.view, from, to, s);
    setState(null);
  }

  return {
    visible: state !== null,
    popoverProps: {
      x: state?.x ?? 0,
      y: state?.y ?? 0,
      suggestions: state?.suggestions ?? [],
      onSelect,
      onClose: () => setState(null),
    },
  };
}
