/**
 * Mobile edits to `entity_relations` rows for the relationship map.
 *
 * Relations already sync from mobile — `MobileStoryBibleStore.addRelation` /
 * `deleteRelation` wrap every write in `localWrite` — so this module is pure
 * logic over the rows the screen already has loaded, mirroring `boardEdits.ts`'s
 * split between wire/DB concerns and the toggle rule itself.
 *
 * Desktop's map renders relations as undirected edges (`MapCanvas.buildEdges`
 * de-dupes on the sorted pair, no arrowheads), so mobile treats a link the
 * same way boards treat a connection: one toggle, direction ignored.
 */
import type { AddRelationArgs, Entity, Relation } from "../../shared/storyBibleStore";

export type RelationTargetEntity = Pick<Entity, "id" | "name">;

export interface RelationTarget {
  id: string;
  name: string;
  linked: boolean;
  label?: string;
}

export interface RelationStore {
  addRelation(projectId: string, args: AddRelationArgs): Promise<Relation>;
  deleteRelation(id: string): Promise<void>;
}

/** The store, project, and already-loaded relations a toggle needs — bundled
 *  so the call reads as one unit rather than four positional strings. */
export interface RelationEditContext {
  store: RelationStore;
  projectId: string;
  relations: Relation[];
}

/** Every row joining `a` and `b`, in either direction. */
export function relationsBetween(relations: Relation[], a: string, b: string): Relation[] {
  return relations.filter((relation) =>
    (relation.fromEntity === a && relation.toEntity === b) ||
    (relation.fromEntity === b && relation.toEntity === a));
}

export function isRelated(relations: Relation[], a: string, b: string): boolean {
  return relationsBetween(relations, a, b).length > 0;
}

/**
 * Every other entity, flagged with whether it is already linked to
 * `selectedId` and — when linked — the existing relation's label for display.
 * Sorted alphabetically by name (board's equivalent list did not sort).
 */
export function relationTargets(
  entities: RelationTargetEntity[], relations: Relation[], selectedId: string,
): RelationTarget[] {
  return entities
    .filter((entity) => entity.id !== selectedId)
    .map((entity) => {
      const joining = relationsBetween(relations, selectedId, entity.id);
      return { id: entity.id, name: entity.name, linked: joining.length > 0, label: joining[0]?.label };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Link or unlink two entities, returning the state it left them in.
 *
 * Linking an entity to itself is refused — the map never draws a self-edge.
 * Unlinking removes EVERY joining row rather than the first: `deleteRelation`
 * already cascades a row's own reciprocal, but a two-device edit can still
 * leave more than one forward row for the same pair, and leaving one behind
 * would make the toggle look broken (mirrors `toggleBoardConnection`).
 */
export async function toggleRelation(
  ctx: RelationEditContext, selectedId: string, targetId: string,
): Promise<boolean> {
  if (selectedId === targetId) return false;
  const joining = relationsBetween(ctx.relations, selectedId, targetId);
  if (joining.length > 0) {
    await Promise.all(joining.map((relation) => ctx.store.deleteRelation(relation.id)));
    return false;
  }
  await ctx.store.addRelation(ctx.projectId, { fromEntity: selectedId, toEntity: targetId, label: "Related to" });
  return true;
}
