import type * as Y from "yjs";

import {
  type BibleEntity, type BibleEntityLink, type BibleEntityType, type BibleField,
  type BibleRelation, type BibleSceneLink, type BibleTombstoneKind, readBibleDoc,
} from "./bibleDoc";

export interface BibleProjectionSnapshot {
  entities: BibleEntity[]; entityTypes: BibleEntityType[]; fields: BibleField[];
  sceneLinks: BibleSceneLink[]; entityLinks: BibleEntityLink[]; relations: BibleRelation[];
}
export interface BibleDeleteOp { kind: BibleTombstoneKind; ids: string[] }
export interface BibleApplyPlan {
  entityTypeUpserts: BibleEntityType[]; entityUpserts: BibleEntity[];
  fieldUpserts: BibleField[]; sceneLinkUpserts: BibleSceneLink[];
  entityLinkUpserts: BibleEntityLink[]; relationUpserts: BibleRelation[][];
  deletes: BibleDeleteOp[];
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedRows<T extends { id: string }>(desired: T[], current: T[]): T[] {
  const byId = new Map(current.map((row) => [row.id, row]));
  return desired.filter((row) => !same(row, byId.get(row.id)));
}

function relationGroups(desired: BibleRelation[], current: BibleRelation[]): BibleRelation[][] {
  const changed = new Set(changedRows(desired, current).map((row) => row.id));
  const byId = new Map(desired.map((row) => [row.id, row]));
  const visited = new Set<string>();
  const groups: BibleRelation[][] = [];
  for (const relation of desired) {
    if (visited.has(relation.id)) continue;
    const reciprocal = relation.reciprocalId ? byId.get(relation.reciprocalId) : undefined;
    const pairChanged = changed.has(relation.id) || (reciprocal && changed.has(reciprocal.id));
    if (!pairChanged) continue;
    const group = reciprocal ? [relation, reciprocal] : [relation];
    group.forEach((row) => visited.add(row.id));
    groups.push(group);
  }
  return groups;
}

function existingIds(snapshot: BibleProjectionSnapshot): Record<BibleTombstoneKind, Set<string>> {
  return {
    entity: new Set(snapshot.entities.map((row) => row.id)),
    entityType: new Set(snapshot.entityTypes.map((row) => row.id)),
    field: new Set(snapshot.fields.map((row) => row.id)),
    sceneLink: new Set(snapshot.sceneLinks.map((row) => row.id)),
    entityLink: new Set(snapshot.entityLinks.map((row) => row.id)),
    relation: new Set(snapshot.relations.map((row) => row.id)),
  };
}

function planDeletes(
  tombstones: ReturnType<typeof readBibleDoc>["tombstones"], snapshot: BibleProjectionSnapshot,
): BibleDeleteOp[] {
  const existing = existingIds(snapshot);
  const singles = Object.entries(tombstones)
    .filter(([id, tombstone]) => existing[tombstone.kind].has(id))
    .map(([id, tombstone]) => ({ kind: tombstone.kind, ids: [id] }));
  return groupRelationDeletes(singles, snapshot.relations);
}

function groupRelationDeletes(
  operations: BibleDeleteOp[], relations: BibleRelation[],
): BibleDeleteOp[] {
  const relationIds = new Set(operations.filter((op) => op.kind === "relation").flatMap((op) => op.ids));
  const byId = new Map(relations.map((row) => [row.id, row]));
  const visited = new Set<string>();
  const grouped: BibleDeleteOp[] = [];
  for (const operation of operations) {
    const id = operation.ids[0];
    if (operation.kind !== "relation") { grouped.push(operation); continue; }
    if (visited.has(id)) continue;
    const reciprocalId = byId.get(id)?.reciprocalId;
    const ids = reciprocalId && relationIds.has(reciprocalId) ? [id, reciprocalId] : [id];
    ids.forEach((value) => visited.add(value));
    grouped.push({ kind: "relation", ids });
  }
  return grouped;
}

/** Pure, ordered, absence-safe diff from a Bible doc to its SQLite projection. */
export function planBibleDocApplication(
  doc: Y.Doc, snapshot: BibleProjectionSnapshot,
): BibleApplyPlan {
  const state = readBibleDoc(doc);
  return {
    entityTypeUpserts: changedRows(state.entityTypes, snapshot.entityTypes),
    entityUpserts: changedRows(state.entities, snapshot.entities),
    fieldUpserts: changedRows(state.fields, snapshot.fields),
    sceneLinkUpserts: changedRows(state.sceneLinks, snapshot.sceneLinks),
    entityLinkUpserts: changedRows(state.entityLinks, snapshot.entityLinks),
    relationUpserts: relationGroups(state.relations, snapshot.relations),
    deletes: planDeletes(state.tombstones, snapshot),
  };
}
