import type { DbClient } from "../../db/dbClient";

async function firstProjectId(db: DbClient, sql: string, id: string): Promise<string | undefined> {
  const rows = await db.select<Array<{ project_id: string }>>(sql, [id]);
  return rows[0]?.project_id;
}

export function findEntityProjectId(db: DbClient, id: string): Promise<string | undefined> {
  return firstProjectId(db, `SELECT project_id FROM characters WHERE id = $1 UNION ALL
    SELECT project_id FROM locations WHERE id = $1 UNION ALL
    SELECT project_id FROM entities WHERE id = $1`, id);
}

export function findFieldProjectId(db: DbClient, id: string): Promise<string | undefined> {
  return firstProjectId(db, `SELECT project_id FROM characters WHERE id =
    (SELECT entity_id FROM entity_fields WHERE id = $1) UNION ALL
    SELECT project_id FROM locations WHERE id = (SELECT entity_id FROM entity_fields WHERE id = $1)
    UNION ALL SELECT project_id FROM entities WHERE id =
    (SELECT entity_id FROM entity_fields WHERE id = $1)`, id);
}

export function findSceneProjectId(db: DbClient, id: string): Promise<string | undefined> {
  return firstProjectId(db, "SELECT project_id FROM scenes WHERE id = $1", id);
}

export function findEntityTypeProjectId(db: DbClient, id: string): Promise<string | undefined> {
  return firstProjectId(db, "SELECT project_id FROM entity_types_custom WHERE id = $1", id);
}

export function findEntityLinkProjectId(db: DbClient, id: string): Promise<string | undefined> {
  return firstProjectId(db, `SELECT project_id FROM characters WHERE id =
    (SELECT from_id FROM entity_links WHERE id = $1) UNION ALL
    SELECT project_id FROM locations WHERE id = (SELECT from_id FROM entity_links WHERE id = $1)
    UNION ALL SELECT project_id FROM entities WHERE id =
    (SELECT from_id FROM entity_links WHERE id = $1)`, id);
}

export function findRelationProjectId(db: DbClient, id: string): Promise<string | undefined> {
  return firstProjectId(db, "SELECT project_id FROM entity_relations WHERE id = $1", id);
}
