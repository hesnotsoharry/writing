import type { Editor } from "@tiptap/react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

import { getSpeller } from "../lib/dictionary";
import { proofreadKey } from "./extensions/ProofreadExtension";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpellCheckPopoverProps {
  x: number;
  y: number;
  suggestions: string[];
  onSelect: (s: string) => void;
  onClose: () => void;
}

interface PopoverState {
  x: number;
  y: number;
  from: number;
  to: number;
  suggestions: string[];
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
 * Renders a fixed-position list of spelling suggestions at (x, y).
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
            {s}
          </button>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controller hook helpers
// ---------------------------------------------------------------------------

/**
 * Fetches spelling suggestions for a word, gracefully handling dictionary unavailability.
 */
async function fetchSuggestions(word: string): Promise<string[]> {
  try {
    const speller = await getSpeller();
    return speller.suggest(word);
  } catch {
    return [];
  }
}

/**
 * Creates a contextmenu handler that opens the popover on misspelled words.
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
    const word = view.state.doc.textBetween(deco.from, deco.to);
    const suggestions = await fetchSuggestions(word);
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
 * lands on a misspelled decoration, it prevents the native menu and opens
 * the SpellCheckPopover with suggestions from nspell.
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

  // Captured from/to go stale the moment the doc changes — close the popover on
  // any doc-mutating update so onSelect can never replace a shifted range.
  useEffect(() => {
    if (!editor) return;
    const close = (): void => setState((s) => (s ? null : s));
    editor.on("update", close);
    return () => {
      editor.off("update", close);
    };
  }, [editor]);

  function onSelect(s: string): void {
    if (!s || !state || !editor || editor.isDestroyed) return;
    const { from, to } = state;
    const { tr, schema } = editor.view.state;
    editor.view.dispatch(tr.replaceWith(from, to, schema.text(s)));
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
