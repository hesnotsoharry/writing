/**
 * EntityCardNode — React Flow node for a card that references a Story Bible entity.
 *
 * Phase 4 (Wave 32, Decision 4):
 *   - Renders the entity's live name + type label from the entities list at render time.
 *   - The left border color reflects the entity's type color (character/location/…).
 *   - No TipTap — entity cards have no free text in v1.
 *   - Clicking the card does NOT open an editor.
 *   - Deleted entity → calm "Missing entity" placeholder, muted, no crash.
 *   - Participates in connections and drag exactly like regular cards (ordinary RF node).
 */
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback } from "react";
import type * as Y from "yjs";

import type { Entity } from "../../db/storyBibleStore";
import { resolveEntityTypeDef } from "../../storybible/entityTypeDefs";
import { removeCard, removeConnectionsForCard } from "./boardDoc";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntityCardNodeData extends Record<string, unknown> {
  doc: Y.Doc;
  cardId: string;
  entityRef: string;
  entities: Entity[];
}

export type EntityCardNodeType = Node<EntityCardNodeData, "entityCard">;

// ── EntityCardShell — shared handles + delete button ─────────────────────────

interface ShellProps {
  onDelete: (e: ReactMouseEvent) => void;
  children: ReactNode;
}

function EntityCardShell({ onDelete, children }: ShellProps) {
  return (
    <>
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <button
        type="button" className="card-node-delete nodrag"
        onClick={onDelete} title="Delete card" aria-label="Delete card"
      >×</button>
      {children}
    </>
  );
}

// ── EntityCardNode ────────────────────────────────────────────────────────────

export function EntityCardNode({ data }: NodeProps<EntityCardNodeType>) {
  const { doc, cardId, entityRef, entities } = data;
  const entity = (entities as Entity[]).find((e) => e.id === entityRef) ?? null;

  const handleDelete = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      removeConnectionsForCard(doc, cardId);
      removeCard(doc, cardId);
    },
    [doc, cardId]
  );

  if (!entity) {
    return (
      <div className="card-node entity-card-node entity-card-node--missing">
        <EntityCardShell onDelete={handleDelete}>
          <span className="entity-card-missing">Missing entity</span>
        </EntityCardShell>
      </div>
    );
  }

  const def = resolveEntityTypeDef(entity.type, []);
  return (
    <div className="card-node entity-card-node" style={{ borderLeftColor: def.color } as CSSProperties}>
      <EntityCardShell onDelete={handleDelete}>
        <span className="entity-card-name">{entity.name}</span>
        <span className="entity-card-type">{def.label}</span>
      </EntityCardShell>
    </div>
  );
}
