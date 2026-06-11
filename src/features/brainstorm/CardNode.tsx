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
 * Phase 6 additions:
 *   - Graduated render state: dim + "→ destination" navigation link, no editor.
 *   - Promote affordance: "↑" button opens a two-step menu (scene / entity type).
 */
import { Collaboration } from "@tiptap/extension-collaboration";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";

// (boardDoc imports removed — delete is now context-menu-only at BoardCanvas level)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CardNodeData extends Record<string, unknown> {
  doc: Y.Doc;
  cardId: string;
  /** Phase 5: when provided, a "Send to scene" button appears on hover. */
  onSendToScene?: (cardId: string) => void;
  /** Phase 6: promote card to a new scene. */
  onPromoteToScene?: (cardId: string) => void;
  /** Phase 6: promote card to a new entity of the chosen type. */
  onPromoteToEntity?: (cardId: string, entityType: string) => void;
  /** Phase 6: navigate to the graduated destination. */
  onNavigateToDestination?: (kind: "scene" | "entity", id: string) => void;
  /** Phase 6: true when card has been graduated. */
  graduated?: boolean;
  /** Phase 6: destination kind — 'scene' | 'entity'. */
  destinationKind?: "scene" | "entity";
  /** Phase 6: destination id (sceneId or entityId). */
  destinationId?: string;
  /** Phase 6: human-readable destination label resolved at BoardCanvas level. */
  destinationLabel?: string;
  /** F7: restore a graduated card to editable state (keeps created scene/entity). */
  onClearGraduation?: (cardId: string) => void;
  /**
   * T1: programmatic edit trigger — set to a new UUID to imperatively enter edit
   * mode (used by the context menu "Edit" action in BoardCanvas).
   */
  editRequestId?: string;
}

export type CardNodeType = Node<CardNodeData, "card">;

// ── BorderHandles — four invisible full-side strips (F6) ─────────────────────
// Shared by CardNode (all states) and imported by EntityCardNode.
// Each strip spans the full side and extends 6 px beyond the card edge so any
// drag starting near the border initiates a connection, not a card move.
// Inline styles override React Flow's default centred-dot positioning.

import type { CSSProperties } from "react";

const STRIP_STYLE_TOP: CSSProperties =
  { width: "100%", height: 12, top: -6, left: 0, transform: "none", borderRadius: 0, background: "transparent", border: "none", opacity: 1 };
const STRIP_STYLE_RIGHT: CSSProperties =
  { height: "100%", width: 12, right: -6, top: 0, transform: "none", borderRadius: 0, background: "transparent", border: "none", opacity: 1 };
const STRIP_STYLE_BOTTOM: CSSProperties =
  { width: "100%", height: 12, bottom: -6, left: 0, transform: "none", borderRadius: 0, background: "transparent", border: "none", opacity: 1 };
const STRIP_STYLE_LEFT: CSSProperties =
  { height: "100%", width: 12, left: -6, top: 0, transform: "none", borderRadius: 0, background: "transparent", border: "none", opacity: 1 };

export function BorderHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top}    id="top"    style={STRIP_STYLE_TOP} />
      <Handle type="source" position={Position.Right}  id="right"  style={STRIP_STYLE_RIGHT} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={STRIP_STYLE_BOTTOM} />
      <Handle type="source" position={Position.Left}   id="left"   style={STRIP_STYLE_LEFT} />
    </>
  );
}

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

// ── useCardState — state + observers + handlers ───────────────────────────────

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

  return { isEditing, setIsEditing, displayText, handleDone };
}

// ── GraduatedCardView ─────────────────────────────────────────────────────────

interface GraduatedProps {
  displayText: string;
  destinationKind?: "scene" | "entity";
  destinationId?: string;
  destinationLabel?: string;
  onNavigate?: (kind: "scene" | "entity", id: string) => void;
}

function GraduatedCardView({ displayText, destinationKind, destinationId, destinationLabel, onNavigate }: GraduatedProps) {
  const destLabel = destinationLabel ?? (destinationKind === "scene" ? "Scene" : "Entity");
  return (
    <div className="card-node card-node--graduated">
      <BorderHandles />
      <span className="card-node-text">
        {displayText || <em className="card-node-empty">—</em>}
      </span>
      {destinationKind && destinationId && (
        <button type="button" className="card-grad-link nodrag"
          onClick={(e) => { e.stopPropagation(); onNavigate?.(destinationKind, destinationId); }}
          title={`Open ${destLabel}`}>
          <span className="arr">→</span> {destLabel}
        </button>
      )}
    </div>
  );
}

// ── CardReadonlyView ──────────────────────────────────────────────────────────

interface ReadonlyProps { displayText: string; onEdit: () => void; }

function CardReadonlyView({ displayText, onEdit }: ReadonlyProps) {
  return (
    <div className="card-node card-node--readonly" onClick={onEdit} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(); }}>
      <BorderHandles />
      <span className="card-node-text">
        {displayText || <em className="card-node-empty">Click to write…</em>}
      </span>
    </div>
  );
}

// ── CardNode ──────────────────────────────────────────────────────────────────

export function CardNode({ data }: NodeProps<CardNodeType>) {
  const { doc, cardId, onNavigateToDestination, graduated, destinationKind,
    destinationId, destinationLabel, editRequestId } = data;
  const { isEditing, setIsEditing, displayText, handleDone } = useCardState(doc, cardId);

  useEffect(() => {
    if (editRequestId) setIsEditing(true);
  }, [editRequestId, setIsEditing]);

  if (graduated) {
    return (
      <GraduatedCardView
        displayText={displayText}
        destinationKind={destinationKind} destinationId={destinationId}
        destinationLabel={destinationLabel} onNavigate={onNavigateToDestination}
      />
    );
  }

  if (isEditing) {
    return (
      <div className="nodrag card-node card-node--editing">
        <BorderHandles />
        <CardEditor doc={doc} cardId={cardId} onDone={handleDone} />
      </div>
    );
  }

  return <CardReadonlyView displayText={displayText} onEdit={() => setIsEditing(true)} />;
}
