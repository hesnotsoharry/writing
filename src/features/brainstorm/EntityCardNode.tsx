/**
 * EntityCardNode — React Flow node for a card that references a Story Bible entity.
 *
 * Phase 4 (Wave 32, Decision 4): live name + type color from the entity list.
 * Direction B makeover: spine species (.ent-spine / .ent-glyph / .ent-name /
 * .ent-type) with --etype / --etype-tint injected as inline custom properties.
 * Deleted entity → calm "Missing entity" placeholder; no crash.
 */
import type { Node, NodeProps } from "@xyflow/react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useCallback } from "react";
import type * as Y from "yjs";

import type { CustomEntityType, Entity } from "../../db/storyBibleStore";
import { resolveEntityTypeDef } from "../../storybible/entityTypeDefs";
import { removeCard, removeConnectionsForCard } from "./boardDoc";
import { BorderHandles } from "./CardNode";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntityCardNodeData extends Record<string, unknown> {
  doc: Y.Doc;
  cardId: string;
  entityRef: string;
  entities: Entity[];
  customTypes: Pick<CustomEntityType, "name" | "icon" | "color">[];
}

export type EntityCardNodeType = Node<EntityCardNodeData, "entityCard">;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "var(--label-clay)" → "var(--label-clay-tint)" */
function etypeTint(colorVar: string): string {
  if (colorVar.startsWith("var(") && colorVar.endsWith(")")) {
    return `var(${colorVar.slice(4, -1)}-tint)`;
  }
  return "transparent";
}

// ── EntityCardPresent — renders a matched entity card ─────────────────────────

interface EntityPresentProps {
  entity: Entity;
  customTypes: Pick<CustomEntityType, "name" | "icon" | "color">[];
  onDelete: (e: ReactMouseEvent) => void;
}

function EntityCardPresent({ entity, customTypes, onDelete }: EntityPresentProps) {
  const def = resolveEntityTypeDef(entity.type, customTypes);
  const initial = entity.name.charAt(0) || "?";
  const style = { "--etype": def.color, "--etype-tint": etypeTint(def.color) } as CSSProperties;
  return (
    <div className="card-node card-node--entity" style={style}>
      <BorderHandles />
      <button type="button" className="card-node-delete nodrag"
        onClick={onDelete} title="Delete card" aria-label="Delete card">×</button>
      <span className="ent-spine" />
      <span className="ent-glyph">{initial}</span>
      <span className="ent-name">{entity.name}</span>
      <span className="ent-type">{def.label}</span>
    </div>
  );
}

// ── EntityCardNode ────────────────────────────────────────────────────────────

export function EntityCardNode({ data }: NodeProps<EntityCardNodeType>) {
  const { doc, cardId, entityRef, entities, customTypes } = data;
  const entity = (entities as Entity[]).find((e) => e.id === entityRef) ?? null;

  const handleDelete = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      removeConnectionsForCard(doc, cardId);
      removeCard(doc, cardId);
    },
    [doc, cardId],
  );

  if (!entity) {
    return (
      <div className="card-node card-node--entity entity-card-node--missing">
        <BorderHandles />
        <button type="button" className="card-node-delete nodrag"
          onClick={handleDelete} title="Delete card" aria-label="Delete card">×</button>
        <span className="entity-card-missing">Missing entity</span>
      </div>
    );
  }

  return (
    <EntityCardPresent
      entity={entity}
      customTypes={customTypes as Pick<CustomEntityType, "name" | "icon" | "color">[]}
      onDelete={handleDelete}
    />
  );
}
