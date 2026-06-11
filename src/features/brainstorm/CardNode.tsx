/**
 * CardNode — custom React Flow node for a brainstorm card.
 *
 * Read-only by default; TipTap mounts lazily on click (Decision 1 constraint).
 * The editor wrapper carries className="nodrag" so clicking/typing never
 * triggers a React Flow node drag.
 *
 * TipTap wiring (per CLAUDE.md + Decision 2):
 *   - doc is hydrated BEFORE this component mounts (BoardView handles load)
 *   - content prop is NOT passed (Yjs provides content via Collaboration)
 *   - StarterKit.configure({ undoRedo: false }) — Yjs brings its own UndoManager
 *   - Collaboration field: 'card-<cardId>' — top-level XmlFragment
 *
 * On blur: editor unmounts, read-only div re-reads from the Y.XmlFragment
 * (not stale React state).
 */
import { Collaboration } from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { Node, NodeProps } from "@xyflow/react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";

import { removeCard } from "./boardDoc";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CardNodeData extends Record<string, unknown> {
  doc: Y.Doc;
  cardId: string;
}

export type CardNodeType = Node<CardNodeData, "card">;

// ── Fragment text extraction ──────────────────────────────────────────────────

function xmlNodeText(node: Y.XmlElement | Y.XmlText): string {
  if (node instanceof Y.XmlText) {
    return (node.toDelta() as { insert?: unknown }[]).reduce(
      (s, op) => s + (typeof op.insert === "string" ? op.insert : ""),
      ""
    );
  }
  let result = "";
  for (let i = 0; i < node.length; i++) {
    const child = node.get(i);
    if (child instanceof Y.XmlText || child instanceof Y.XmlElement) {
      result += xmlNodeText(child as Y.XmlElement | Y.XmlText);
    }
  }
  return result;
}

function fragmentText(doc: Y.Doc, cardId: string): string {
  const frag = doc.getXmlFragment(`card-${cardId}`);
  const parts: string[] = [];
  for (let i = 0; i < frag.length; i++) {
    const child = frag.get(i);
    if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
      parts.push(xmlNodeText(child as Y.XmlElement | Y.XmlText));
    }
  }
  return parts.join("\n");
}

// ── Inner editor (lazy — only mounted when isEditing) ────────────────────────

interface CardEditorProps { doc: Y.Doc; cardId: string; onDone: () => void; }

function CardEditor({ doc, cardId, onDone }: CardEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: doc, field: `card-${cardId}` }),
    ],
    autofocus: true,
    // Do NOT pass content — Yjs hydrates from the doc
  });

  useEffect(() => {
    if (!editor) return;
    const handleBlur = () => onDone();
    editor.on("blur", handleBlur);
    return () => { editor.off("blur", handleBlur); };
  }, [editor, onDone]);

  return <EditorContent editor={editor} className="card-node-editor" />;
}

// ── useCardState — state + observers + handlers for CardNode ─────────────────

function useCardState(doc: Y.Doc, cardId: string) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayText, setDisplayText] = useState(() => fragmentText(doc, cardId));

  useEffect(() => {
    const frag = doc.getXmlFragment(`card-${cardId}`);
    const sync = () => setDisplayText(fragmentText(doc, cardId));
    frag.observe(sync);
    return () => frag.unobserve(sync);
  }, [doc, cardId]);

  const handleDone = useCallback(() => {
    setDisplayText(fragmentText(doc, cardId));
    setIsEditing(false);
  }, [doc, cardId]);

  const handleDelete = useCallback(
    (e: ReactMouseEvent) => { e.stopPropagation(); removeCard(doc, cardId); },
    [doc, cardId]
  );

  return { isEditing, setIsEditing, displayText, handleDone, handleDelete };
}

// ── CardNode ──────────────────────────────────────────────────────────────────

export function CardNode({ data }: NodeProps<CardNodeType>) {
  const { doc, cardId } = data;
  const { isEditing, setIsEditing, displayText, handleDone, handleDelete } =
    useCardState(doc, cardId);

  if (isEditing) {
    return (
      <div className="nodrag card-node card-node--editing">
        <CardEditor doc={doc} cardId={cardId} onDone={handleDone} />
      </div>
    );
  }

  return (
    <div className="card-node card-node--readonly" onClick={() => setIsEditing(true)}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsEditing(true); }}>
      <button type="button" className="card-node-delete nodrag" onClick={handleDelete}
        title="Delete card" aria-label="Delete card">
        ×
      </button>
      <span className="card-node-text">
        {displayText || <em className="card-node-empty">Click to write…</em>}
      </span>
    </div>
  );
}
