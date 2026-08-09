import type { DbClient } from "../../db/dbClient";
import type { BibleApplyTarget } from "./bibleApplyExec";
import type { BibleDeleteOp, BibleProjectionSnapshot } from "./bibleApplyPlan";
import {
  type BibleEntity, type BibleEntityLink, type BibleEntityType, type BibleField,
  type BibleRelation, type BibleSceneLink, sceneLinkId,
} from "./bibleDoc";

type EntitySqlRow = {
  id: string; project_id: string; entity_type?: string; name: string;
  notes: string | null; aliases: string | null; exclude_from_ai: number;
};

async function loadEntities(db: DbClient, projectId: string): Promise<BibleEntity[]> {
  const columns = "id, project_id, name, notes, aliases, exclude_from_ai";
  const [characters, locations, generic] = await Promise.all([
    db.select<EntitySqlRow[]>(`SELECT ${columns} FROM characters WHERE project_id = $1`, [projectId]),
    db.select<EntitySqlRow[]>(`SELECT ${columns} FROM locations WHERE project_id = $1`, [projectId]),
    db.select<EntitySqlRow[]>(
      `SELECT id, project_id, entity_type, name, notes, aliases, exclude_from_ai
       FROM entities WHERE project_id = $1`, [projectId],
    ),
  ]);
  return [
    ...characters.map((row) => mapEntity(row, "character", "character")),
    ...locations.map((row) => mapEntity(row, "location", "location")),
    ...generic.map((row) => mapEntity(row, "entity", row.entity_type ?? "")),
  ];
}

function mapEntity(
  row: EntitySqlRow, storage: BibleEntity["storage"], entityType: string,
): BibleEntity {
  return {
    id: row.id, projectId: row.project_id, storage, entityType, name: row.name,
    notes: row.notes, aliases: row.aliases, excludeFromAi: row.exclude_from_ai !== 0,
  };
}

async function loadEntityTypes(db: DbClient, projectId: string): Promise<BibleEntityType[]> {
  const rows = await db.select<Array<{
    id: string; project_id: string; name: string; icon: string; color: string;
    fields_json: string; sections_json: string;
  }>>(`SELECT id, project_id, name, icon, color, fields_json, sections_json
       FROM entity_types_custom WHERE project_id = $1`, [projectId]);
  return rows.map((row) => ({
    id: row.id, projectId: row.project_id, name: row.name, icon: row.icon, color: row.color,
    fieldsJson: row.fields_json, sectionsJson: row.sections_json,
  }));
}

async function loadFields(db: DbClient, projectId: string): Promise<BibleField[]> {
  const rows = await db.select<Array<{
    id: string; entity_id: string; kind: "fact" | "section";
    field_key: string; field_value: string; sort: number;
  }>>(`SELECT f.id, f.entity_id, f.kind, f.field_key, f.field_value, f.sort
       FROM entity_fields f WHERE f.entity_id IN (${projectEntityIdsSql()})`, [projectId]);
  return rows.map((row) => ({
    id: row.id, entityId: row.entity_id, kind: row.kind,
    fieldKey: row.field_key, fieldValue: row.field_value, sort: row.sort,
  }));
}

function projectEntityIdsSql(): string {
  return `SELECT id FROM characters WHERE project_id = $1 UNION
    SELECT id FROM locations WHERE project_id = $1 UNION
    SELECT id FROM entities WHERE project_id = $1`;
}

async function loadSceneLinks(db: DbClient, projectId: string): Promise<BibleSceneLink[]> {
  const rows = await db.select<Array<{
    scene_id: string; entity_type: string; entity_id: string;
  }>>(`SELECT sl.scene_id, sl.entity_type, sl.entity_id FROM scene_links sl
       INNER JOIN scenes s ON s.id = sl.scene_id WHERE s.project_id = $1`, [projectId]);
  return rows.map((row) => ({
    id: sceneLinkId(row.scene_id, row.entity_id), sceneId: row.scene_id,
    entityType: row.entity_type, entityId: row.entity_id,
  }));
}

async function loadEntityLinks(db: DbClient, projectId: string): Promise<BibleEntityLink[]> {
  const rows = await db.select<Array<{
    id: string; from_id: string; to_id: string; relation: string;
  }>>(`SELECT id, from_id, to_id, relation FROM entity_links
       WHERE from_id IN (${projectEntityIdsSql()})`, [projectId]);
  return rows.map((row) => ({
    id: row.id, fromId: row.from_id, toId: row.to_id, relation: row.relation,
  }));
}

async function loadRelations(db: DbClient, projectId: string): Promise<BibleRelation[]> {
  const rows = await db.select<Array<{
    id: string; project_id: string; from_entity: string; to_entity: string;
    relation_label: string; reciprocal_id: string | null; created_at: number;
  }>>(`SELECT id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at
       FROM entity_relations WHERE project_id = $1`, [projectId]);
  return rows.map((row) => ({
    id: row.id, projectId: row.project_id, fromEntity: row.from_entity,
    toEntity: row.to_entity, relationLabel: row.relation_label,
    reciprocalId: row.reciprocal_id, createdAt: row.created_at,
  }));
}

export async function loadBibleProjection(
  db: DbClient, projectId: string,
): Promise<BibleProjectionSnapshot> {
  const [entities, entityTypes, fields, sceneLinks, entityLinks, relations] = await Promise.all([
    loadEntities(db, projectId), loadEntityTypes(db, projectId), loadFields(db, projectId),
    loadSceneLinks(db, projectId), loadEntityLinks(db, projectId), loadRelations(db, projectId),
  ]);
  return { entities, entityTypes, fields, sceneLinks, entityLinks, relations };
}

export class DbBibleApplyTarget implements BibleApplyTarget {
  constructor(private readonly db: DbClient) {}
  load(projectId: string): Promise<BibleProjectionSnapshot> {
    return loadBibleProjection(this.db, projectId);
  }
  async upsertEntityType(row: BibleEntityType): Promise<void> {
    await this.db.execute(
      `INSERT INTO entity_types_custom
       (id, project_id, name, icon, color, fields_json, sections_json) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id, name=excluded.name,
       icon=excluded.icon, color=excluded.color, fields_json=excluded.fields_json,
       sections_json=excluded.sections_json`,
      [row.id, row.projectId, row.name, row.icon, row.color, row.fieldsJson, row.sectionsJson],
    );
  }
  async upsertEntity(row: BibleEntity): Promise<void> {
    const table = row.storage === "entity" ? "entities" : `${row.storage}s`;
    const typeColumn = row.storage === "entity" ? "entity_type, " : "";
    const typeValue = row.storage === "entity" ? [row.entityType] : [];
    const parameters = [row.id, row.projectId, ...typeValue, row.name, row.notes, row.aliases,
      row.excludeFromAi ? 1 : 0];
    const placeholders = parameters.map((_, index) => `$${index + 1}`).join(",");
    await this.db.execute(
      `INSERT INTO ${table} (id, project_id, ${typeColumn}name, notes, aliases, exclude_from_ai)
       VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,
       ${row.storage === "entity" ? "entity_type=excluded.entity_type," : ""}
       name=excluded.name, notes=excluded.notes, aliases=excluded.aliases,
       exclude_from_ai=excluded.exclude_from_ai`, parameters,
    );
  }
  async upsertField(row: BibleField): Promise<void> {
    await this.db.execute(
      `INSERT INTO entity_fields (id, entity_id, kind, field_key, field_value, sort)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET entity_id=excluded.entity_id,
       kind=excluded.kind, field_key=excluded.field_key, field_value=excluded.field_value,
       sort=excluded.sort`,
      [row.id, row.entityId, row.kind, row.fieldKey, row.fieldValue, row.sort],
    );
  }
  async upsertSceneLink(row: BibleSceneLink): Promise<void> {
    await this.db.execute(
      `INSERT INTO scene_links (scene_id, entity_type, entity_id) VALUES ($1,$2,$3)
       ON CONFLICT(scene_id, entity_id) DO UPDATE SET entity_type=excluded.entity_type`,
      [row.sceneId, row.entityType, row.entityId],
    );
  }
  async upsertEntityLink(row: BibleEntityLink): Promise<void> {
    await this.db.execute(
      `INSERT INTO entity_links (id, from_id, to_id, relation) VALUES ($1,$2,$3,$4)
       ON CONFLICT(id) DO UPDATE SET from_id=excluded.from_id, to_id=excluded.to_id,
       relation=excluded.relation`, [row.id, row.fromId, row.toId, row.relation],
    );
  }
  async upsertRelations(rows: BibleRelation[]): Promise<void> {
    const values = rows.map((_, index) => {
      const start = index * 7; return `(${Array.from({ length: 7 }, (__, offset) => `$${start + offset + 1}`)})`;
    }).join(",");
    const parameters = rows.flatMap((row) => [row.id, row.projectId, row.fromEntity,
      row.toEntity, row.relationLabel, row.reciprocalId, row.createdAt]);
    await this.db.execute(
      `INSERT INTO entity_relations
       (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at)
       VALUES ${values} ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,
       from_entity=excluded.from_entity, to_entity=excluded.to_entity,
       relation_label=excluded.relation_label, reciprocal_id=excluded.reciprocal_id,
       created_at=excluded.created_at`, parameters,
    );
  }
  async delete(operation: BibleDeleteOp): Promise<void> {
    await applyDelete(this.db, operation);
  }
}

async function applyDelete(db: DbClient, operation: BibleDeleteOp): Promise<void> {
  if (operation.kind === "entity") { await deleteEntity(db, operation.ids[0]); return; }
  if (operation.kind === "sceneLink") { await deleteSceneLink(db, operation.ids[0]); return; }
  const tables: Partial<Record<BibleDeleteOp["kind"], string>> = {
    entityType: "entity_types_custom", field: "entity_fields",
    entityLink: "entity_links", relation: "entity_relations",
  };
  const table = tables[operation.kind];
  if (!table) return;
  const placeholders = operation.ids.map((_, index) => `$${index + 1}`).join(",");
  await db.execute(`DELETE FROM ${table} WHERE id IN (${placeholders})`, operation.ids);
}

async function deleteEntity(db: DbClient, id: string): Promise<void> {
  const rows = await db.select<Array<{ storage: string }>>(
    `SELECT 'character' AS storage FROM characters WHERE id = $1 UNION ALL
     SELECT 'location' FROM locations WHERE id = $1 UNION ALL
     SELECT 'entity' FROM entities WHERE id = $1`, [id],
  );
  const table = rows[0]?.storage === "character" ? "characters"
    : rows[0]?.storage === "location" ? "locations" : "entities";
  await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

async function deleteSceneLink(db: DbClient, id: string): Promise<void> {
  const separator = id.indexOf(":");
  if (separator < 0) return;
  await db.execute("DELETE FROM scene_links WHERE scene_id = $1 AND entity_id = $2", [
    id.slice(0, separator), id.slice(separator + 1),
  ]);
}
