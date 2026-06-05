/**
 * SQLite helpers for Wave 27 Phase 5 entity-type expansion.
 * Extracted from sqliteStoryBibleStore.ts to keep that file ≤300 lines.
 * All functions take a `db` parameter (DbHandle) so callers await getDb() once.
 */
import type { DbHandle } from "./schema";
import type {
  CreateCustomTypeArgs,
  CustomEntityType,
  Entity,
  EntityType,
} from "./storyBibleStore";

interface CreateEntityArgs { projectId: string; type: EntityType; name: string; notes: string | null; }

export async function sqliteCreateEntity(db: DbHandle, args: CreateEntityArgs): Promise<Entity> {
  const { projectId, type, name, notes } = args;
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO entities (id, project_id, entity_type, name, notes, aliases) VALUES ($1, $2, $3, $4, $5, NULL)",
    [id, projectId, type, name, notes]
  );
  return { id, projectId, type, name, notes, aliases: null };
}

export async function sqliteListEntitiesByType(
  db: DbHandle,
  projectId: string,
  type: EntityType,
): Promise<Entity[]> {
  const rows = await db.select<
    { id: string; project_id: string; entity_type: string; name: string; notes: string | null; aliases: string | null }[]
  >(
    "SELECT id, project_id, entity_type, name, notes, aliases FROM entities WHERE project_id = $1 AND entity_type = $2",
    [projectId, type]
  );
  return rows.map((r) => ({
    id: r.id, projectId: r.project_id, type: r.entity_type, name: r.name, notes: r.notes, aliases: r.aliases,
  }));
}

export async function sqliteCreateCustomType(
  db: DbHandle,
  args: CreateCustomTypeArgs,
): Promise<CustomEntityType> {
  const { projectId, name, icon, color } = args;
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO entity_types_custom (id, project_id, name, icon, color, fields_json, sections_json) VALUES ($1, $2, $3, $4, $5, '[]', '[]')",
    [id, projectId, name, icon, color]
  );
  return { id, projectId, name, icon, color, fieldsJson: "[]", sectionsJson: "[]" };
}

export async function sqliteListCustomTypes(
  db: DbHandle,
  projectId: string,
): Promise<CustomEntityType[]> {
  const rows = await db.select<
    { id: string; project_id: string; name: string; icon: string; color: string; fields_json: string; sections_json: string }[]
  >(
    "SELECT id, project_id, name, icon, color, fields_json, sections_json FROM entity_types_custom WHERE project_id = $1",
    [projectId]
  );
  return rows.map((r) => ({
    id: r.id, projectId: r.project_id, name: r.name, icon: r.icon, color: r.color,
    fieldsJson: r.fields_json, sectionsJson: r.sections_json,
  }));
}

export async function sqliteDeleteCustomType(db: DbHandle, id: string): Promise<void> {
  await db.execute("DELETE FROM entity_types_custom WHERE id = $1", [id]);
}
