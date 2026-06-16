import type { Editor } from "@tiptap/react";

import type { MenuDescriptor, MenuItem } from "../components/menu/ContextMenu";
import { parseProseSelection } from "../features/ai/ai.helpers";
import { AI_ASK_FROM_EDITOR, getTweak } from "../features/settings/settings.store";
import { extractAiSafeSelection } from "./aiSafeSelection";

// ---------------------------------------------------------------------------
// buildAlLinkMenu — right-click menu for .al-link spans.
// Moved here from Editor.tsx to keep that file within the 300-line limit.
// ---------------------------------------------------------------------------

export interface AlLinkMenuArgs {
  el: HTMLElement;
  x: number;
  y: number;
  onOpenEntry: (id: string, kind: string) => void;
  onNotice: (msg: string) => void;
  onFindMentions: (entityName: string) => void;
}

export function buildAlLinkMenu({
  el, x, y, onOpenEntry, onNotice, onFindMentions,
}: AlLinkMenuArgs): MenuDescriptor {
  const entityId = el.getAttribute("data-entity-id") ?? "";
  const entityType = el.getAttribute("data-entity-type") ?? "";
  const entityName = el.getAttribute("data-entity-name") ?? "";
  const kind = entityType.charAt(0).toUpperCase() + entityType.slice(1);
  return {
    x, y,
    items: [
      { label: "Open full entry", icon: "feather", onClick: () => onOpenEntry(entityId, kind) },
      { type: "sep" },
      { label: "Find mentions", onClick: () => onFindMentions(entityName) },
      { label: "Unlink here", onClick: () => onNotice("Unlink here — coming soon") },
      { label: `Never link "${entityName}"`, onClick: () => onNotice(`Never link — coming soon`) },
      { label: "Manage aliases…", onClick: () => onNotice("Aliases — coming soon") },
    ],
  };
}

// ---------------------------------------------------------------------------
// Clipboard helpers
// ---------------------------------------------------------------------------

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard write unavailable (focus lost or API missing) — leave the
    // document untouched and swallow the rejection.
    return false;
  }
}

async function readFromClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    // Clipboard read unavailable (permission denied or API missing).
    return "";
  }
}

// ---------------------------------------------------------------------------
// Action builders — kept as named fns to stay within 40-line limit.
// ---------------------------------------------------------------------------

function onCut(editor: Editor, selText: string): () => void {
  return () => {
    void writeToClipboard(selText).then((ok) => {
      // Only delete once the text is safely on the clipboard.
      if (ok) editor.chain().focus().deleteSelection().run();
    });
  };
}

function onCopy(selText: string): () => void {
  return () => { void writeToClipboard(selText); };
}

function onPaste(editor: Editor): () => void {
  return () => {
    void readFromClipboard().then((text) => {
      if (text) editor.chain().focus().insertContent(text).run();
    });
  };
}

// Default highlight color for the context-menu toggle (amber wash from label palette).
const DEFAULT_HIGHLIGHT_COLOR = "rgba(176,125,46,0.28)";

// ---------------------------------------------------------------------------
// buildAiMenuItems — optional AI items gated on aiEnabled + aiSelMenu tweaks.
// ---------------------------------------------------------------------------

function buildAiMenuItems(selText: string): MenuItem[] {
  if (!getTweak("aiEnabled", true) || !getTweak("aiSelMenu", false)) return [];
  const parsed = parseProseSelection(selText);
  if (!parsed) return [];
  const detail = { verb: "brainstorm" as const, sel: { text: parsed.text, words: parsed.words } };
  const dispatch = () => { window.dispatchEvent(new CustomEvent(AI_ASK_FROM_EDITOR, { detail })); };
  return [
    { type: "sep" as const },
    { type: "label" as const, text: `Selection · ${parsed.words} words` },
    { label: "Brainstorm on selection", icon: "sparkle" as const, onClick: dispatch },
  ];
}

// ---------------------------------------------------------------------------
// buildEditorContextMenu — assembles the plain-text right-click MenuDescriptor.
// Exported for unit testing; callers pass editor + pointer coords.
// ---------------------------------------------------------------------------

export function buildEditorContextMenu(
  editor: Editor,
  x: number,
  y: number,
): MenuDescriptor {
  const { empty, from, to } = editor.state.selection;
  // Use mark-aware extraction so aiExclude-marked ranges emit the placeholder
  // rather than raw prose when the selection is passed to AI context (W52 P2).
  const selText = empty ? "" : extractAiSafeSelection(editor.state.doc, from, to);

  return {
    x,
    y,
    items: [
      { label: "Cut", disabled: empty, onClick: onCut(editor, selText) },
      { label: "Copy", disabled: empty, onClick: onCopy(selText) },
      { label: "Paste", onClick: onPaste(editor) },
      { label: "Select All", onClick: () => { editor.chain().focus().selectAll().run(); } },
      { type: "sep" },
      { label: "Bold", onClick: () => { editor.chain().focus().toggleBold().run(); } },
      { label: "Italic", onClick: () => { editor.chain().focus().toggleItalic().run(); } },
      { label: "Strikethrough", onClick: () => { editor.chain().focus().toggleStrike().run(); } },
      { label: "Highlight", disabled: empty, swatch: DEFAULT_HIGHLIGHT_COLOR,
        onClick: () => { editor.chain().focus().toggleHighlight({ color: DEFAULT_HIGHLIGHT_COLOR }).run(); } },
      ...buildAiMenuItems(selText),
    ],
  };
}
