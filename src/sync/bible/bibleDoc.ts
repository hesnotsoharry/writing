import * as Y from "yjs";

export type EntityStorage = "character" | "location" | "entity";
export type BibleTombstoneKind =
  | "entity" | "entityType" | "field" | "sceneLink" | "entityLink" | "relation";

export interface BibleEntity {
  id: string; projectId: string; storage: EntityStorage; entityType: string;
  name: string; notes: string | null; aliases: string | null; excludeFromAi: boolean;
}
export interface BibleEntityType {
  id: string; projectId: string; name: string; icon: string; color: string;
  fieldsJson: string; sectionsJson: string;
}
export interface BibleField {
  id: string; entityId: string; kind: "fact" | "section";
  fieldKey: string; fieldValue: string; sort: number;
}
export interface BibleSceneLink {
  id: string; sceneId: string; entityType: string; entityId: string;
}
export interface BibleEntityLink {
  id: string; fromId: string; toId: string; relation: string;
}
export interface BibleRelation {
  id: string; projectId: string; fromEntity: string; toEntity: string;
  relationLabel: string; reciprocalId: string | null; createdAt: number;
}
export interface BibleTombstone { kind: BibleTombstoneKind; at: number }
export interface SqlBibleRows {
  entities: BibleEntity[]; entityTypes: BibleEntityType[]; fields: BibleField[];
  sceneLinks: BibleSceneLink[]; entityLinks: BibleEntityLink[]; relations: BibleRelation[];
}
export type BibleState = SqlBibleRows & { tombstones: Record<string, BibleTombstone> };

const rowMapNames = {
  entity: "entities", entityType: "entityTypes", field: "fields",
  sceneLink: "sceneLinks", entityLink: "entityLinks", relation: "relations",
} as const;

function rowsMap(doc: Y.Doc, name: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>(name);
}

function syncText(row: Y.Map<unknown>, key: string, value: string | null): void {
  const existing = row.get(key);
  const text = existing instanceof Y.Text ? existing : new Y.Text();
  const next = value ?? "";
  const current = existing instanceof Y.Text ? existing.toString() : "";
  if (!(existing instanceof Y.Text)) row.set(key, text);
  if (current !== next) {
    if (text.length > 0) text.delete(0, text.length);
    if (next.length > 0) text.insert(0, next);
  }
  row.set(`${key}Null`, value === null);
}

function writeScalars(row: Y.Map<unknown>, values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) row.set(key, value);
}

function writeRow(doc: Y.Doc, mapName: string, id: string, write: (row: Y.Map<unknown>) => void): void {
  const rows = rowsMap(doc, mapName);
  const existing = rows.get(id);
  const row = existing ?? new Y.Map<unknown>();
  if (!existing) rows.set(id, row);
  write(row);
  doc.getMap<BibleTombstone>("tombstones").delete(id);
}

export function setEntity(doc: Y.Doc, entity: BibleEntity): void {
  doc.transact(() => writeRow(doc, "entities", entity.id, (row) => {
    writeScalars(row, {
      projectId: entity.projectId, storage: entity.storage, entityType: entity.entityType,
      name: entity.name, aliases: entity.aliases, excludeFromAi: entity.excludeFromAi,
    });
    // portrait_path is device-local (D7): a desktop filesystem path is meaningless on mobile.
    syncText(row, "notes", entity.notes);
  }));
}

export function setEntityType(doc: Y.Doc, type: BibleEntityType): void {
  doc.transact(() => writeRow(doc, "entityTypes", type.id, (row) => writeScalars(row, {
    projectId: type.projectId, name: type.name, icon: type.icon, color: type.color,
    fieldsJson: type.fieldsJson, sectionsJson: type.sectionsJson,
  })));
}

export function setField(doc: Y.Doc, field: BibleField): void {
  doc.transact(() => writeRow(doc, "fields", field.id, (row) => {
    writeScalars(row, {
      entityId: field.entityId, kind: field.kind, fieldKey: field.fieldKey, sort: field.sort,
    });
    if (field.kind === "section") syncText(row, "fieldValue", field.fieldValue);
    else row.set("fieldValue", field.fieldValue);
  }));
}

export function setSceneLink(doc: Y.Doc, link: BibleSceneLink): void {
  doc.transact(() => writeRow(doc, "sceneLinks", link.id, (row) => writeScalars(row, {
    sceneId: link.sceneId, entityType: link.entityType, entityId: link.entityId,
  })));
}

export function setEntityLink(doc: Y.Doc, link: BibleEntityLink): void {
  doc.transact(() => writeRow(doc, "entityLinks", link.id, (row) => writeScalars(row, {
    fromId: link.fromId, toId: link.toId, relation: link.relation,
  })));
}

function writeRelation(doc: Y.Doc, relation: BibleRelation): void {
  writeRow(doc, "relations", relation.id, (row) => writeScalars(row, {
    projectId: relation.projectId, fromEntity: relation.fromEntity,
    toEntity: relation.toEntity, relationLabel: relation.relationLabel,
    reciprocalId: relation.reciprocalId, createdAt: relation.createdAt,
  }));
}

/** A reciprocal pair is one CRDT transaction, so observers and wire updates never see half a pair. */
export function setRelationPair(doc: Y.Doc, first: BibleRelation, second?: BibleRelation): void {
  doc.transact(() => { writeRelation(doc, first); if (second) writeRelation(doc, second); });
}

export function removeWithTombstone(
  doc: Y.Doc, kind: BibleTombstoneKind, id: string, at = Date.now(),
): void {
  doc.transact(() => {
    rowsMap(doc, rowMapNames[kind]).delete(id);
    doc.getMap<BibleTombstone>("tombstones").set(id, { kind, at });
  });
}

/** Reciprocal deletion is atomic for the same reason as reciprocal creation. */
export function removeRelationPair(
  doc: Y.Doc, firstId: string, secondId?: string, at = Date.now(),
): void {
  doc.transact(() => {
    removeWithTombstone(doc, "relation", firstId, at);
    if (secondId) removeWithTombstone(doc, "relation", secondId, at);
  });
}

function textValue(row: Y.Map<unknown>, key: string): string {
  const value = row.get(key);
  return value instanceof Y.Text ? value.toString() : typeof value === "string" ? value : "";
}

function nullableText(row: Y.Map<unknown>, key: string): string | null {
  return row.get(`${key}Null`) === true ? null : textValue(row, key);
}

export function getEntityNotesText(doc: Y.Doc, entityId: string): Y.Text | null {
  const value = rowsMap(doc, "entities").get(entityId)?.get("notes");
  return value instanceof Y.Text ? value : null;
}

export function getFieldValueText(doc: Y.Doc, fieldId: string): Y.Text | null {
  const value = rowsMap(doc, "fields").get(fieldId)?.get("fieldValue");
  return value instanceof Y.Text ? value : null;
}

function readRows<T>(doc: Y.Doc, name: string, read: (id: string, row: Y.Map<unknown>) => T): T[] {
  return Array.from(rowsMap(doc, name), ([id, row]) => read(id, row))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

const stringAt = (row: Y.Map<unknown>, key: string): string => String(row.get(key) ?? "");
const numberAt = (row: Y.Map<unknown>, key: string): number => Number(row.get(key) ?? 0);

export function readBibleDoc(doc: Y.Doc): BibleState {
  return {
    entities: readRows(doc, "entities", (id, row) => ({
      id, projectId: stringAt(row, "projectId"), storage: stringAt(row, "storage") as EntityStorage,
      entityType: stringAt(row, "entityType"), name: stringAt(row, "name"), notes: nullableText(row, "notes"),
      aliases: row.get("aliases") === null ? null : stringAt(row, "aliases"),
      excludeFromAi: row.get("excludeFromAi") === true,
    })),
    entityTypes: readRows(doc, "entityTypes", (id, row) => ({
      id, projectId: stringAt(row, "projectId"), name: stringAt(row, "name"),
      icon: stringAt(row, "icon"), color: stringAt(row, "color"),
      fieldsJson: stringAt(row, "fieldsJson"), sectionsJson: stringAt(row, "sectionsJson"),
    })),
    fields: readRows(doc, "fields", (id, row) => ({
      id, entityId: stringAt(row, "entityId"), kind: stringAt(row, "kind") as "fact" | "section",
      fieldKey: stringAt(row, "fieldKey"), fieldValue: textValue(row, "fieldValue"), sort: numberAt(row, "sort"),
    })),
    sceneLinks: readRows(doc, "sceneLinks", (id, row) => ({
      id, sceneId: stringAt(row, "sceneId"), entityType: stringAt(row, "entityType"),
      entityId: stringAt(row, "entityId"),
    })),
    entityLinks: readRows(doc, "entityLinks", (id, row) => ({
      id, fromId: stringAt(row, "fromId"), toId: stringAt(row, "toId"),
      relation: stringAt(row, "relation"),
    })),
    relations: readRows(doc, "relations", (id, row) => ({
      id, projectId: stringAt(row, "projectId"), fromEntity: stringAt(row, "fromEntity"),
      toEntity: stringAt(row, "toEntity"), relationLabel: stringAt(row, "relationLabel"),
      reciprocalId: row.get("reciprocalId") === null ? null : stringAt(row, "reciprocalId"),
      createdAt: numberAt(row, "createdAt"),
    })),
    tombstones: doc.getMap<BibleTombstone>("tombstones").toJSON(),
  };
}

/** Bootstrap a complete per-project Bible doc from SQLite. No epoch: this domain has no restore. */
export function buildBibleFromSql(rows: SqlBibleRows): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    rows.entityTypes.forEach((row) => setEntityType(doc, row));
    rows.entities.forEach((row) => setEntity(doc, row));
    rows.fields.forEach((row) => setField(doc, row));
    rows.sceneLinks.forEach((row) => setSceneLink(doc, row));
    rows.entityLinks.forEach((row) => setEntityLink(doc, row));
    rows.relations.forEach((row) => writeRelation(doc, row));
    doc.getMap<BibleTombstone>("tombstones");
  });
  // A future whole-domain restore needs a Bible-local epoch, never meta docEpochs.
  return doc;
}

interface RowDelta<T> {
  kind: BibleTombstoneKind; before: T[]; after: T[]; set: (row: T) => void;
}

function applyRowDelta<T extends { id: string }>(doc: Y.Doc, delta: RowDelta<T>): void {
  const { kind, before, after, set } = delta;
  const previous = new Map(before.map((row) => [row.id, row]));
  const nextIds = new Set(after.map(({ id }) => id));
  after.filter((row) => JSON.stringify(previous.get(row.id)) !== JSON.stringify(row)).forEach(set);
  before.filter(({ id }) => !nextIds.has(id))
    .forEach(({ id }) => removeWithTombstone(doc, kind, id));
}

/** Apply only rows changed by one successful local SQL mutation. */
export function applyBibleSqlDelta(doc: Y.Doc, before: SqlBibleRows, after: SqlBibleRows): void {
  doc.transact(() => {
    applyRowDelta(doc, { kind: "entityType", before: before.entityTypes, after: after.entityTypes,
      set: (row) => setEntityType(doc, row) });
    applyRowDelta(doc, { kind: "entity", before: before.entities, after: after.entities,
      set: (row) => setEntity(doc, row) });
    applyRowDelta(doc, { kind: "field", before: before.fields, after: after.fields,
      set: (row) => setField(doc, row) });
    applyRowDelta(doc, { kind: "sceneLink", before: before.sceneLinks, after: after.sceneLinks,
      set: (row) => setSceneLink(doc, row) });
    applyRowDelta(doc, { kind: "entityLink", before: before.entityLinks, after: after.entityLinks,
      set: (row) => setEntityLink(doc, row) });
    applyRowDelta(doc, { kind: "relation", before: before.relations, after: after.relations,
      set: (row) => writeRelation(doc, row) });
  });
}

export function sceneLinkId(sceneId: string, entityId: string): string {
  return `${sceneId}:${entityId}`;
}
