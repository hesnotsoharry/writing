/**
 * BoardContextMenu — right-click context menu for board cards.
 *
 * Furniture-tier: background --paper, 1px --line border, --shadow-md,
 * --r-md corners, --font-ui --text-sm items. No accent colors anywhere.
 *
 * Entity-type promotion is a two-step flow managed with local `step` state:
 * "root" shows the main menu; "entity-type" shows the entity type picker.
 * Dismissal (outside click / Escape) is owned by BoardCanvas via
 * useDismissOnOutside applied to `menuRef`.
 */
import type { RefObject } from "react";
import { useState } from "react";

import type { ContextMenuState, DocToNodesCallbacks, NodeContextMenuState } from "./boardCanvasHooks";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContextNodeKind = "card" | "graduated" | "entityCard";

export interface BoardContextMenuProps {
  x: number;
  y: number;
  nodeKind: ContextNodeKind;
  menuRef: RefObject<HTMLDivElement | null>;
  /** card-only actions */
  onEdit?: () => void;
  onSendToScene?: () => void;
  onPromoteToScene?: () => void;
  onPromoteToEntity?: (entityType: string) => void;
  onAskAi?: () => void;
  /** graduated-only actions */
  onOpenDestination?: () => void;
  onRestoreCard?: () => void;
  /** entity-card-only actions */
  onOpenInBible?: () => void;
  /** shared */
  onDelete: () => void;
}

// ── Built-in entity types (mirrored from former CardNode BUILT_IN_ENTITY_TYPES) ─

const ENTITY_TYPES = [
  { type: "character", label: "Character" },
  { type: "location", label: "Location" },
  { type: "item", label: "Item" },
  { type: "faction", label: "Faction" },
  { type: "lore", label: "Lore" },
  { type: "theme", label: "Theme" },
] as const;

// ── Primitive sub-components ──────────────────────────────────────────────────

function CtxItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="board-ctx-item" onClick={onClick}>
      {label}
    </button>
  );
}

function CtxSep() {
  return <div className="board-ctx-sep" />;
}

// ── Step sub-views ────────────────────────────────────────────────────────────

interface EntityTypeStepProps {
  onPick: (type: string) => void;
  onBack: () => void;
}

function EntityTypeStep({ onPick, onBack }: EntityTypeStepProps) {
  return (
    <>
      <CtxItem label="← Back" onClick={onBack} />
      <CtxSep />
      {ENTITY_TYPES.map((t) => (
        <CtxItem key={t.type} label={t.label} onClick={() => onPick(t.type)} />
      ))}
    </>
  );
}

interface CardMenuRootProps {
  onEdit?: () => void;
  onSendToScene?: () => void;
  onPromoteToScene?: () => void;
  onPickEntityStep?: () => void;
  onAskAi?: () => void;
  onDelete: () => void;
}

function CardMenuRoot({ onEdit, onSendToScene, onPromoteToScene, onPickEntityStep, onAskAi, onDelete }: CardMenuRootProps) {
  return (
    <>
      {onEdit && <CtxItem label="Edit" onClick={onEdit} />}
      {onSendToScene && <CtxItem label="Send to scene…" onClick={onSendToScene} />}
      {onPromoteToScene && <CtxItem label="Promote to scene" onClick={onPromoteToScene} />}
      {onPickEntityStep && <CtxItem label="Promote to entity…" onClick={onPickEntityStep} />}
      {onAskAi && <CtxItem label="Ask AI about this card" onClick={onAskAi} />}
      <CtxSep />
      <CtxItem label="Delete" onClick={onDelete} />
    </>
  );
}

// ── ContextContent — routes to the right menu view based on nodeKind + step ───

interface ContentProps {
  nodeKind: ContextNodeKind;
  step: "root" | "entity-type";
  setStep: (s: "root" | "entity-type") => void;
  onEdit?: () => void;
  onSendToScene?: () => void;
  onPromoteToScene?: () => void;
  onPromoteToEntity?: (type: string) => void;
  onAskAi?: () => void;
  onOpenDestination?: () => void;
  onRestoreCard?: () => void;
  onOpenInBible?: () => void;
  onDelete: () => void;
}

function ContextContent({ nodeKind, step, setStep, onEdit, onSendToScene, onPromoteToScene,
  onPromoteToEntity, onAskAi, onOpenDestination, onRestoreCard, onOpenInBible, onDelete }: ContentProps) {
  if (nodeKind === "graduated") {
    return (
      <>
        {onOpenDestination && <CtxItem label="Open destination" onClick={onOpenDestination} />}
        {onRestoreCard && <CtxItem label="Restore card" onClick={onRestoreCard} />}
        <CtxSep /><CtxItem label="Delete" onClick={onDelete} />
      </>
    );
  }
  if (nodeKind === "entityCard") {
    return (
      <>
        {onOpenInBible && <CtxItem label="Open in Story Bible" onClick={onOpenInBible} />}
        <CtxSep /><CtxItem label="Remove from board" onClick={onDelete} />
      </>
    );
  }
  if (step === "entity-type" && onPromoteToEntity) {
    return (
      <EntityTypeStep onPick={(type) => { setStep("root"); onPromoteToEntity(type); }}
        onBack={() => setStep("root")} />
    );
  }
  return (
    <CardMenuRoot onEdit={onEdit} onSendToScene={onSendToScene} onPromoteToScene={onPromoteToScene}
      onPickEntityStep={onPromoteToEntity ? () => setStep("entity-type") : undefined}
      onAskAi={onAskAi} onDelete={onDelete} />
  );
}

// ── BoardContextMenu ──────────────────────────────────────────────────────────

export function BoardContextMenu({
  x, y, nodeKind, menuRef,
  onEdit, onSendToScene, onPromoteToScene, onPromoteToEntity, onAskAi,
  onOpenDestination, onRestoreCard, onOpenInBible, onDelete,
}: BoardContextMenuProps) {
  const [step, setStep] = useState<"root" | "entity-type">("root");
  return (
    <div ref={menuRef} className="board-ctx-menu" style={{ left: x, top: y }}>
      <ContextContent nodeKind={nodeKind} step={step} setStep={setStep}
        onEdit={onEdit} onSendToScene={onSendToScene} onPromoteToScene={onPromoteToScene}
        onPromoteToEntity={onPromoteToEntity} onAskAi={onAskAi} onOpenDestination={onOpenDestination}
        onRestoreCard={onRestoreCard} onOpenInBible={onOpenInBible} onDelete={onDelete} />
    </div>
  );
}

// ── BoundContextMenu — pre-wires actions to BoardCanvas callbacks ──────────────
// Lives here to avoid JSX in boardCanvasHooks.ts (plain TS file).

interface BoundMenuProps {
  cm: ContextMenuState; menuRef: RefObject<HTMLDivElement | null>;
  close: () => void; cbs: { current: DocToNodesCallbacks };
  onDelete: (id: string) => void; onEdit: (id: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export function BoundContextMenu({ cm, menuRef, close, cbs, onDelete, onEdit, onDeleteEdge }: BoundMenuProps) {
  if (cm.kind === "edge") {
    return (
      <div ref={menuRef} className="board-ctx-menu" style={{ left: cm.x, top: cm.y }}>
        <button type="button" className="board-ctx-item" onClick={() => { onDeleteEdge(cm.edgeId); close(); }}>
          Remove
        </button>
      </div>
    );
  }
  const node = cm as NodeContextMenuState;
  return (
    <BoardContextMenu
      x={node.x} y={node.y} nodeKind={node.nodeKind} menuRef={menuRef}
      onEdit={() => { onEdit(node.nodeId); close(); }}
      onSendToScene={() => { cbs.current.onSendToScene?.(node.nodeId); close(); }}
      onPromoteToScene={() => { cbs.current.onPromoteToScene?.(node.nodeId); close(); }}
      onPromoteToEntity={(t) => { cbs.current.onPromoteToEntity?.(node.nodeId, t); close(); }}
      onAskAi={cbs.current.onAskAi ? () => { cbs.current.onAskAi!(node.nodeId); close(); } : undefined}
      onOpenDestination={node.destKind && node.destId ? () => { cbs.current.onNavigateToDestination?.(node.destKind!, node.destId!); close(); } : undefined}
      onRestoreCard={() => { cbs.current.onClearGraduation?.(node.nodeId); close(); }}
      onOpenInBible={node.entityRef ? () => { cbs.current.onNavigateToDestination?.("entity", node.entityRef!); close(); } : undefined}
      onDelete={() => onDelete(node.nodeId)}
    />
  );
}
