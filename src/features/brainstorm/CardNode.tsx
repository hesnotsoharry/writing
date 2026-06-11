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
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import { removeCard, removeConnectionsForCard } from "./boardDoc";

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
}

export type CardNodeType = Node<CardNodeData, "card">;

// ── BorderHandles — four invisible full-side strips (F6) ─────────────────────
// Shared by CardNode (all states) and imported by EntityCardNode.
// Each strip spans the full side and extends 6 px beyond the card edge so any
// drag starting near the border initiates a connection, not a card move.
// Inline styles override React Flow's default centred-dot positioning.

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

// ── Built-in entity types for promote picker ──────────────────────────────────

const BUILT_IN_ENTITY_TYPES = [
  { type: "character", label: "Character" },
  { type: "location", label: "Location" },
  { type: "item", label: "Item" },
  { type: "faction", label: "Faction" },
  { type: "lore", label: "Lore" },
  { type: "theme", label: "Theme" },
] as const;

type PromoteStep = "menu" | "entity-type";

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

  const handleDelete = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      removeConnectionsForCard(doc, cardId);
      removeCard(doc, cardId);
    },
    [doc, cardId]
  );

  return { isEditing, setIsEditing, displayText, handleDone, handleDelete };
}

// ── PromoteMenu — two-step inline promote picker ─────────────────────────────

interface PromoteMenuProps {
  step: PromoteStep;
  onPromoteScene: () => void;
  onShowEntityTypes: () => void;
  onPickEntityType: (type: string) => void;
  onClose: () => void;
}

function PromoteMenu({ step, onPromoteScene, onShowEntityTypes, onPickEntityType, onClose }: PromoteMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLElement) || !ref.current?.contains(t)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div ref={ref} className="nodrag card-promote-menu">
      {step === "menu" ? (
        <>
          <button type="button" className="card-promote-option" onClick={onPromoteScene}>→ New scene</button>
          <button type="button" className="card-promote-option" onClick={onShowEntityTypes}>→ New entity…</button>
        </>
      ) : (
        BUILT_IN_ENTITY_TYPES.map((t) => (
          <button key={t.type} type="button" className="card-promote-option"
            onClick={() => onPickEntityType(t.type)}>{t.label}</button>
        ))
      )}
    </div>
  );
}

// ── GraduatedCardView ─────────────────────────────────────────────────────────

interface GraduatedProps {
  displayText: string;
  destinationKind?: "scene" | "entity";
  destinationId?: string;
  destinationLabel?: string;
  onNavigate?: (kind: "scene" | "entity", id: string) => void;
  /** F7: restore card to editable (keeps the created scene/entity). */
  onClearGraduation?: () => void;
}

function GraduatedCardView({ displayText, destinationKind, destinationId, destinationLabel, onNavigate, onClearGraduation }: GraduatedProps) {
  const destLabel = destinationLabel ?? (destinationKind === "scene" ? "Scene" : "Entity");
  return (
    <div className="card-node card-node--graduated">
      <BorderHandles />
      {onClearGraduation && (
        <button type="button" className="card-grad-restore nodrag"
          onClick={(e) => { e.stopPropagation(); onClearGraduation(); }}
          title="Restore card — keeps the created scene/entity">↺</button>
      )}
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

interface ReadonlyProps {
  cardId: string;
  displayText: string;
  handleDelete: (e: ReactMouseEvent) => void;
  onEdit: () => void;
  onSendToScene?: (cardId: string) => void;
  onPromoteToScene?: (cardId: string) => void;
  onPromoteToEntity?: (cardId: string, entityType: string) => void;
}

function CardReadonlyView({ cardId, displayText, handleDelete, onEdit, onSendToScene, onPromoteToScene, onPromoteToEntity }: ReadonlyProps) {
  const [promoteStep, setPromoteStep] = useState<PromoteStep | null>(null);
  const canPromote = !!(onPromoteToScene || onPromoteToEntity);
  return (
    <div className="card-node card-node--readonly" onClick={onEdit} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(); }}>
      <BorderHandles />
      <button type="button" className="card-node-delete nodrag" onClick={handleDelete}
        title="Delete card" aria-label="Delete card">×</button>
      {onSendToScene && (
        <button type="button" className="card-node-send nodrag"
          title="Send to scene" aria-label="Send to scene"
          onClick={(e) => { e.stopPropagation(); onSendToScene(cardId); }}>→</button>
      )}
      {canPromote && (
        <button type="button" className="card-node-promote nodrag"
          title="Promote card" aria-label="Promote card"
          onClick={(e) => { e.stopPropagation(); setPromoteStep("menu"); }}>↑</button>
      )}
      {promoteStep && (
        <PromoteMenu
          step={promoteStep}
          onPromoteScene={() => { setPromoteStep(null); onPromoteToScene?.(cardId); }}
          onShowEntityTypes={() => setPromoteStep("entity-type")}
          onPickEntityType={(type) => { setPromoteStep(null); onPromoteToEntity?.(cardId, type); }}
          onClose={() => setPromoteStep(null)}
        />
      )}
      <span className="card-node-text">
        {displayText || <em className="card-node-empty">Click to write…</em>}
      </span>
    </div>
  );
}

// ── CardNode ──────────────────────────────────────────────────────────────────

export function CardNode({ data }: NodeProps<CardNodeType>) {
  const { doc, cardId, onSendToScene, onPromoteToScene, onPromoteToEntity,
    onNavigateToDestination, graduated, destinationKind, destinationId, destinationLabel,
    onClearGraduation } = data;
  const { isEditing, setIsEditing, displayText, handleDone, handleDelete } = useCardState(doc, cardId);

  if (graduated) {
    return (
      <GraduatedCardView
        displayText={displayText}
        destinationKind={destinationKind} destinationId={destinationId}
        destinationLabel={destinationLabel} onNavigate={onNavigateToDestination}
        onClearGraduation={onClearGraduation ? () => onClearGraduation(cardId) : undefined}
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

  return (
    <CardReadonlyView
      cardId={cardId} displayText={displayText} handleDelete={handleDelete}
      onEdit={() => setIsEditing(true)}
      onSendToScene={onSendToScene} onPromoteToScene={onPromoteToScene}
      onPromoteToEntity={onPromoteToEntity}
    />
  );
}
