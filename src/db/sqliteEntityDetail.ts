/**
 * Pure free-function helpers for the SqliteStoryBibleStore Wave-24 Full Entry surface.
 * Each function takes a DbHandle as its first argument — the class methods become
 * thin one-line delegators.
 */

import type { DbHandle } from "./schema";
import type {
  EntityField,
  EntityLink,
  EntityType,
  EntityWithPortrait,
  FieldKey,
  FieldKind,
} from "./storyBibleStore";

type EntityRow = {
  id: string;
  project_id: string;
  name: string;
  notes: string | null;
  aliases: string | null;
  portrait_path: string | null;
};

export async function sqliteGetEntity(
  db: DbHandle,
  type: EntityType,
  id: string
): Promise<EntityWithPortrait | null> {
  const table = type === "character" ? "characters" : "locations";
  const rows = await db.select<EntityRow[]>(
    `SELECT id, project_id, name, notes, aliases, portrait_path FROM ${table} WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, projectId: r.project_id, type, name: r.name, notes: r.notes, aliases: r.aliases, portraitPath: r.portrait_path };
}

export async function sqliteGetEntityFields(
  db: DbHandle,
  entityId: string
): Promise<EntityField[]> {
  const rows = await db.select<
    { id: string; entity_id: string; kind: string; field_key: string; field_value: string; sort: number }[]
  >(
    "SELECT id, entity_id, kind, field_key, field_value, sort FROM entity_fields WHERE entity_id = $1 ORDER BY kind, sort",
    [entityId]
  );
  return rows.map((r) => ({
    id: r.id,
    entityId: r.entity_id,
    kind: r.kind as FieldKind,
    key: r.field_key,
    value: r.field_value,
    sort: r.sort,
  }));
}

export async function sqliteSetEntityField(
  db: DbHandle,
  fk: FieldKey,
  value: string
): Promise<void> {
  const sortRows = await db.select<{ max_sort: number | null }[]>(
    "SELECT MAX(sort) AS max_sort FROM entity_fields WHERE entity_id = $1",
    [fk.entityId]
  );
  const nextSort = (sortRows[0].max_sort ?? -1) + 1;
  const newId = crypto.randomUUID();
  // OR IGNORE: UNIQUE(entity_id, kind, field_key) — INSERT skipped if duplicate.
  // The subsequent UPDATE always sets the value on the surviving row.
  await db.execute(
    "INSERT OR IGNORE INTO entity_fields (id, entity_id, kind, field_key, field_value, sort) VALUES ($1, $2, $3, $4, $5, $6)",
    [newId, fk.entityId, fk.kind, fk.key, value, nextSort]
  );
  await db.execute(
    "UPDATE entity_fields SET field_value = $1 WHERE entity_id = $2 AND kind = $3 AND field_key = $4",
    [value, fk.entityId, fk.kind, fk.key]
  );
}

export async function sqliteAddEntityField(
  db: DbHandle,
  entityId: string,
  kind: FieldKind,
  key: string
): Promise<EntityField> {
  const sortRows = await db.select<{ max_sort: number | null }[]>(
    "SELECT MAX(sort) AS max_sort FROM entity_fields WHERE entity_id = $1",
    [entityId]
  );
  const nextSort = (sortRows[0].max_sort ?? -1) + 1;
  const id = crypto.randomUUID();
  // OR IGNORE: UNIQUE(entity_id, kind, field_key) — INSERT skipped on duplicate logical key.
  // SELECT re-fetches the surviving row so the caller always gets a valid EntityField
  // with its pre-existing value preserved (NOT reset to '').
  await db.execute(
    "INSERT OR IGNORE INTO entity_fields (id, entity_id, kind, field_key, field_value, sort) VALUES ($1, $2, $3, $4, '', $5)",
    [id, entityId, kind, key, nextSort]
  );
  const rows = await db.select<
    { id: string; entity_id: string; kind: string; field_key: string; field_value: string; sort: number }[]
  >(
    "SELECT id, entity_id, kind, field_key, field_value, sort FROM entity_fields WHERE entity_id = $1 AND kind = $2 AND field_key = $3",
    [entityId, kind, key]
  );
  const r = rows[0];
  return { id: r.id, entityId: r.entity_id, kind: r.kind as FieldKind, key: r.field_key, value: r.field_value, sort: r.sort };
}

export async function sqliteDeleteEntityField(db: DbHandle, fieldId: string): Promise<void> {
  await db.execute("DELETE FROM entity_fields WHERE id = $1", [fieldId]);
}

export async function sqliteReorderEntityFields(
  db: DbHandle,
  updates: { id: string; sort: number }[]
): Promise<void> {
  for (const { id, sort } of updates) {
    await db.execute("UPDATE entity_fields SET sort = $1 WHERE id = $2", [sort, id]);
  }
}

export async function sqliteListLinksFor(
  db: DbHandle,
  entityId: string
): Promise<EntityLink[]> {
  const rows = await db.select<
    { id: string; from_id: string; to_id: string; relation: string }[]
  >(
    "SELECT id, from_id, to_id, relation FROM entity_links WHERE from_id = $1",
    [entityId]
  );
  return rows.map((r) => ({ id: r.id, fromId: r.from_id, toId: r.to_id, relation: r.relation }));
}

/** Reverse-direction query: links where to_id = toId (e.g. characters linked to a location). */
export async function sqliteListLinksTo(
  db: DbHandle,
  toId: string
): Promise<EntityLink[]> {
  const rows = await db.select<
    { id: string; from_id: string; to_id: string; relation: string }[]
  >(
    "SELECT id, from_id, to_id, relation FROM entity_links WHERE to_id = $1",
    [toId]
  );
  return rows.map((r) => ({ id: r.id, fromId: r.from_id, toId: r.to_id, relation: r.relation }));
}

/** In-place key rename: UPDATE field_key WHERE id = fieldId. No migration needed. */
export async function sqliteUpdateEntityFieldKey(
  db: DbHandle,
  fieldId: string,
  newKey: string
): Promise<void> {
  await db.execute("UPDATE entity_fields SET field_key = $1 WHERE id = $2", [newKey, fieldId]);
}

export async function sqliteAddLink(
  db: DbHandle,
  fromId: string,
  toId: string,
  relation: string
): Promise<EntityLink> {
  const id = crypto.randomUUID();
  // OR IGNORE: UNIQUE(from_id, to_id) — INSERT skipped on duplicate pair.
  // SELECT re-fetches the surviving row so the caller always gets a valid EntityLink.
  await db.execute(
    "INSERT OR IGNORE INTO entity_links (id, from_id, to_id, relation) VALUES ($1, $2, $3, $4)",
    [id, fromId, toId, relation]
  );
  const rows = await db.select<
    { id: string; from_id: string; to_id: string; relation: string }[]
  >(
    "SELECT id, from_id, to_id, relation FROM entity_links WHERE from_id = $1 AND to_id = $2",
    [fromId, toId]
  );
  const r = rows[0];
  return { id: r.id, fromId: r.from_id, toId: r.to_id, relation: r.relation };
}

export async function sqliteRemoveLink(db: DbHandle, linkId: string): Promise<void> {
  await db.execute("DELETE FROM entity_links WHERE id = $1", [linkId]);
}

export async function sqliteUpdateLinkRelation(
  db: DbHandle,
  linkId: string,
  relation: string
): Promise<void> {
  await db.execute("UPDATE entity_links SET relation = $1 WHERE id = $2", [relation, linkId]);
}

export async function sqliteSetPortrait(
  db: DbHandle,
  type: EntityType,
  id: string,
  path: string
): Promise<void> {
  const table = type === "character" ? "characters" : "locations";
  await db.execute(`UPDATE ${table} SET portrait_path = $1 WHERE id = $2`, [path, id]);
}

export async function sqliteClearPortrait(
  db: DbHandle,
  type: EntityType,
  id: string
): Promise<void> {
  const table = type === "character" ? "characters" : "locations";
  await db.execute(`UPDATE ${table} SET portrait_path = NULL WHERE id = $1`, [id]);
}

/** Purge entity_fields, entity_links, and entity_relations rows for a deleted entity. */
export async function sqlitePurgeEntityDetail(db: DbHandle, id: string): Promise<void> {
  await db.execute("DELETE FROM entity_fields WHERE entity_id = $1", [id]);
  await db.execute("DELETE FROM entity_links WHERE from_id = $1 OR to_id = $1", [id]);
  await db.execute("DELETE FROM entity_relations WHERE from_entity = $1 OR to_entity = $1", [id]);
}
