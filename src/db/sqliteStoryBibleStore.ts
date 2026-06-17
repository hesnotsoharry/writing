import type { ManuscriptAbout } from "../features/ai/ai.types";
import { type DbHandle,getDb } from "./schema";
import { sqliteGetManuscriptAbout, sqliteGetSceneExcludedFromAi, sqliteGetSceneText, sqliteSetManuscriptAbout } from "./sqliteAiContextStore";
import {
  sqliteAddEntityField,
  sqliteAddLink,
  sqliteClearPortrait,
  sqliteDeleteEntityField,
  sqliteGetEntity,
  sqliteGetEntityFields,
  sqliteListLinksFor,
  sqliteListLinksTo,
  sqlitePurgeEntityDetail,
  sqliteRemoveLink,
  sqliteReorderEntityFields,
  sqliteSetEntityExclusion,
  sqliteSetEntityField,
  sqliteSetPortrait,
  sqliteUpdateEntityFieldKey,
  sqliteUpdateLinkRelation,
} from "./sqliteEntityDetail";
import {
  sqliteCreateCustomType,
  sqliteCreateEntity,
  sqliteDeleteCustomType,
  sqliteListCustomTypes,
  sqliteListEntitiesByType,
} from "./sqliteEntityTypeStore";
import {
  sqliteAddRelation,
  sqliteDeleteRelation,
  sqliteListRelations,
  sqliteUpdateRelationLabel,
} from "./sqliteRelationStore";
import type {
  AddRelationArgs,
  Character,
  CreateCustomTypeArgs,
  CustomEntityType,
  Entity,
  EntityField,
  EntityLink,
  EntityType,
  EntityWithPortrait,
  FieldKind,
  Location,
  Relation,
  SceneEntityGroup,
  SceneLink,
  StoryBibleStore,
} from "./storyBibleStore";

// ── Row mappers for Entity hydration ────────────────────────────────────────
type EntityRow = { id: string; project_id: string; name: string; notes: string | null; aliases: string | null; exclude_from_ai: number };
const rowToEntity = (r: EntityRow, type: string): Entity => ({ id: r.id, projectId: r.project_id, type, name: r.name, notes: r.notes, aliases: r.aliases, exclude_from_ai: r.exclude_from_ai !== 0 });

/**
 * Free-function form of `listEntities` — takes a `DbHandle` so it works with
 * the sql.js test harness. The class method delegates here. Exercises `rowToEntity`
 * (including the `exclude_from_ai !== 0` boolean conversion) on all three entity tables.
 */
export async function sqliteListEntities(db: DbHandle, projectId: string): Promise<Entity[]> {
  const charRows = await db.select<EntityRow[]>(
    "SELECT id, project_id, name, notes, aliases, exclude_from_ai FROM characters WHERE project_id = $1",
    [projectId]
  );
  const locRows = await db.select<EntityRow[]>(
    "SELECT id, project_id, name, notes, aliases, exclude_from_ai FROM locations WHERE project_id = $1",
    [projectId]
  );
  const genRows = await db.select<(EntityRow & { entity_type: string })[]>(
    "SELECT id, project_id, entity_type, name, notes, aliases, exclude_from_ai FROM entities WHERE project_id = $1",
    [projectId]
  );
  return [
    ...charRows.map((r) => rowToEntity(r, "character")),
    ...locRows.map((r) => rowToEntity(r, "location")),
    ...genRows.map((r) => rowToEntity(r, r.entity_type)),
  ];
}

/** SQLite-backed StoryBibleStore over tauri-plugin-sql. */
export class SqliteStoryBibleStore implements StoryBibleStore {
  // NOTE: deliberately omits exclude_from_ai. Privacy-aware callers assembling AI context
  // MUST use loadSceneEntities or listEntities (via sqliteListEntities) instead.
  async listCharacters(projectId: string): Promise<Character[]> {
    const db = await getDb();
    const rows = await db.select<
      { id: string; project_id: string; name: string; notes: string | null; aliases: string | null }[]
    >(
      "SELECT id, project_id, name, notes, aliases FROM characters WHERE project_id = $1",
      [projectId]
    );
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      notes: r.notes,
      aliases: r.aliases,
    }));
  }

  // NOTE: deliberately omits exclude_from_ai. Privacy-aware callers assembling AI context
  // MUST use loadSceneEntities or listEntities (via sqliteListEntities) instead.
  async listLocations(projectId: string): Promise<Location[]> {
    const db = await getDb();
    const rows = await db.select<
      { id: string; project_id: string; name: string; notes: string | null; aliases: string | null }[]
    >(
      "SELECT id, project_id, name, notes, aliases FROM locations WHERE project_id = $1",
      [projectId]
    );
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      notes: r.notes,
      aliases: r.aliases,
    }));
  }

  async createCharacter(
    projectId: string,
    name: string,
    notes: string | null
  ): Promise<Character> {
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO characters (id, project_id, name, notes, aliases) VALUES ($1, $2, $3, $4, NULL)",
      [id, projectId, name, notes]
    );
    return { id, projectId, name, notes, aliases: null };
  }

  async createLocation(
    projectId: string,
    name: string,
    notes: string | null
  ): Promise<Location> {
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO locations (id, project_id, name, notes, aliases) VALUES ($1, $2, $3, $4, NULL)",
      [id, projectId, name, notes]
    );
    return { id, projectId, name, notes, aliases: null };
  }

  async renameEntity(
    type: EntityType,
    id: string,
    name: string
  ): Promise<void> {
    const db = await getDb();
    if (type === "character") {
      await db.execute("UPDATE characters SET name = $1 WHERE id = $2", [name, id]);
    } else if (type === "location") {
      await db.execute("UPDATE locations SET name = $1 WHERE id = $2", [name, id]);
    } else {
      await db.execute("UPDATE entities SET name = $1 WHERE id = $2", [name, id]);
    }
  }

  async updateEntityNotes(
    type: EntityType,
    id: string,
    notes: string | null
  ): Promise<void> {
    const db = await getDb();
    if (type === "character") {
      await db.execute("UPDATE characters SET notes = $1 WHERE id = $2", [notes, id]);
    } else if (type === "location") {
      await db.execute("UPDATE locations SET notes = $1 WHERE id = $2", [notes, id]);
    } else {
      await db.execute("UPDATE entities SET notes = $1 WHERE id = $2", [notes, id]);
    }
  }

  async deleteEntity(type: EntityType, id: string): Promise<void> {
    const db = await getDb();
    if (type === "character") {
      await db.execute("DELETE FROM characters WHERE id = $1", [id]);
    } else if (type === "location") {
      await db.execute("DELETE FROM locations WHERE id = $1", [id]);
    } else {
      await db.execute("DELETE FROM entities WHERE id = $1", [id]);
    }
    await db.execute(
      "DELETE FROM scene_links WHERE entity_id = $1 AND entity_type = $2",
      [id, type]
    );
    await sqlitePurgeEntityDetail(db, id);
  }

  async setEntityExclusion(type: EntityType, id: string, exclude: boolean): Promise<void> {
    return sqliteSetEntityExclusion(await getDb(), type, id, exclude);
  }

  async replaceSceneLinks(sceneId: string, links: SceneLink[]): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM scene_links WHERE scene_id = $1", [sceneId]);
    for (const link of links) {
      // INSERT OR IGNORE: migration 3 added UNIQUE(scene_id, entity_id). This is a
      // full-replace (the DELETE above clears the scene first), so set-semantics apply —
      // a link present once is correct. OR IGNORE makes a duplicate (scene_id, entity_id)
      // within `links` a no-op instead of throwing a UNIQUE constraint error.
      await db.execute(
        "INSERT OR IGNORE INTO scene_links (scene_id, entity_type, entity_id) VALUES ($1, $2, $3)",
        [sceneId, link.entityType, link.entityId]
      );
    }
  }

  async loadSceneLinks(sceneId: string): Promise<SceneLink[]> {
    const db = await getDb();
    const rows = await db.select<
      { entity_type: EntityType; entity_id: string }[]
    >(
      "SELECT entity_type, entity_id FROM scene_links WHERE scene_id = $1",
      [sceneId]
    );
    return rows.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
    }));
  }

  async loadSceneEntities(sceneId: string): Promise<SceneEntityGroup[]> {
    const db = await getDb();
    // One read per distinct entity_type present in scene_links for this scene.
    // tauri-plugin-sql has no multi-statement execute; sequential reads are the only option.
    // Single-user local app — no concurrent writer, so the non-atomic sequence is safe.
    const typeRows = await db.select<{ entity_type: string }[]>(
      "SELECT DISTINCT entity_type FROM scene_links WHERE scene_id = $1", [sceneId]
    );
    if (typeRows.length === 0) return [];
    const TAXONOMY = ["character", "location", "item", "faction", "lore", "theme"];
    const sortedTypes = typeRows.map((r) => r.entity_type).sort((a, b) => {
      const [ia, ib] = [TAXONOMY.indexOf(a), TAXONOMY.indexOf(b)];
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      return (ia === -1 ? TAXONOMY.length : ia) - (ib === -1 ? TAXONOMY.length : ib);
    });
    const groups: SceneEntityGroup[] = [];
    for (const type of sortedTypes) {
      if (type === "character") {
        const rows = await db.select<EntityRow[]>(
          "SELECT c.id, c.project_id, c.name, c.notes, c.aliases, c.exclude_from_ai FROM scene_links sl JOIN characters c ON c.id = sl.entity_id WHERE sl.scene_id = $1 AND sl.entity_type = 'character' ORDER BY c.name", [sceneId]
        );
        if (rows.length > 0) groups.push({ type, entities: rows.map((r) => rowToEntity(r, type)) });
      } else if (type === "location") {
        const rows = await db.select<EntityRow[]>(
          "SELECT l.id, l.project_id, l.name, l.notes, l.aliases, l.exclude_from_ai FROM scene_links sl JOIN locations l ON l.id = sl.entity_id WHERE sl.scene_id = $1 AND sl.entity_type = 'location' ORDER BY l.name", [sceneId]
        );
        if (rows.length > 0) groups.push({ type, entities: rows.map((r) => rowToEntity(r, type)) });
      } else {
        const rows = await db.select<EntityRow[]>(
          "SELECT e.id, e.project_id, e.name, e.notes, e.aliases, e.exclude_from_ai FROM scene_links sl JOIN entities e ON e.id = sl.entity_id WHERE sl.scene_id = $1 AND sl.entity_type = $2 ORDER BY e.name", [sceneId, type]
        );
        if (rows.length > 0) groups.push({ type, entities: rows.map((r) => rowToEntity(r, type)) });
      }
    }
    return groups;
  }

  async findScenesForEntity(entityId: string): Promise<string[]> {
    const db = await getDb();
    // No entity_type discriminator needed: entity ids are UUIDs (crypto.randomUUID),
    // so they are unique across both characters and locations tables.
    const rows = await db.select<{ scene_id: string }[]>(
      "SELECT scene_id FROM scene_links WHERE entity_id = $1",
      [entityId]
    );
    return rows.map((r) => r.scene_id);
  }

  async listEntities(projectId: string): Promise<Entity[]> {
    return sqliteListEntities(await getDb(), projectId);
  }

  // ── Wave 24 Full Entry additive surface ──────────────────────────────────
  async getEntity(type: EntityType, id: string): Promise<EntityWithPortrait | null> {
    return sqliteGetEntity(await getDb(), type, id);
  }

  async getEntityFields(entityId: string): Promise<EntityField[]> {
    return sqliteGetEntityFields(await getDb(), entityId);
  }

  async setEntityField(entityId: string, kind: FieldKind, key: string, value: string): Promise<void> {
    return sqliteSetEntityField(await getDb(), { entityId, kind, key }, value);
  }

  async addEntityField(entityId: string, kind: FieldKind, key: string): Promise<EntityField> {
    return sqliteAddEntityField(await getDb(), entityId, kind, key);
  }

  async deleteEntityField(fieldId: string): Promise<void> {
    return sqliteDeleteEntityField(await getDb(), fieldId);
  }

  async reorderEntityFields(updates: { id: string; sort: number }[]): Promise<void> {
    return sqliteReorderEntityFields(await getDb(), updates);
  }

  async listLinksFor(entityId: string): Promise<EntityLink[]> {
    return sqliteListLinksFor(await getDb(), entityId);
  }

  async listLinksTo(toId: string): Promise<EntityLink[]> {
    return sqliteListLinksTo(await getDb(), toId);
  }

  async updateEntityFieldKey(fieldId: string, newKey: string): Promise<void> {
    return sqliteUpdateEntityFieldKey(await getDb(), fieldId, newKey);
  }

  async addLink(fromId: string, toId: string, relation: string): Promise<EntityLink> {
    return sqliteAddLink(await getDb(), fromId, toId, relation);
  }

  async removeLink(linkId: string): Promise<void> {
    return sqliteRemoveLink(await getDb(), linkId);
  }

  async updateLinkRelation(linkId: string, relation: string): Promise<void> {
    return sqliteUpdateLinkRelation(await getDb(), linkId, relation);
  }

  async setPortrait(type: EntityType, id: string, path: string): Promise<void> {
    return sqliteSetPortrait(await getDb(), type, id, path);
  }

  async clearPortrait(type: EntityType, id: string): Promise<void> {
    return sqliteClearPortrait(await getDb(), type, id);
  }

  // ── Wave 27 Phase 5 — Entity types expansion (implementations in sqliteEntityTypeStore.ts) ──
  async createEntity(projectId: string, type: EntityType, name: string, notes: string | null): Promise<Entity> { return sqliteCreateEntity(await getDb(), { projectId, type, name, notes }); }
  async listEntitiesByType(projectId: string, type: EntityType): Promise<Entity[]> { return sqliteListEntitiesByType(await getDb(), projectId, type); }
  async createCustomType(args: CreateCustomTypeArgs): Promise<CustomEntityType> { return sqliteCreateCustomType(await getDb(), args); }
  async listCustomTypes(projectId: string): Promise<CustomEntityType[]> { return sqliteListCustomTypes(await getDb(), projectId); }
  async deleteCustomType(id: string): Promise<void> { return sqliteDeleteCustomType(await getDb(), id); }

  // ── Wave 27 Phase 4 — Typed relation edges (implemented in sqliteRelationStore.ts) ──
  async addRelation(projectId: string, args: AddRelationArgs): Promise<Relation> { return sqliteAddRelation(projectId, args); }
  async listRelations(projectId: string, entityId?: string): Promise<Relation[]> { return sqliteListRelations(projectId, entityId); }
  async deleteRelation(id: string): Promise<void> { return sqliteDeleteRelation(id); }
  async updateRelationLabel(id: string, label: string): Promise<void> { return sqliteUpdateRelationLabel(id, label); }
  async allRelations(projectId: string): Promise<Relation[]> { return this.listRelations(projectId); }

  // ── Wave 35 Phase E — AI context v2 read paths ────────────────────────────
  async getManuscriptAbout(projectId: string): Promise<ManuscriptAbout> { return sqliteGetManuscriptAbout(await getDb(), projectId); }
  async setManuscriptAbout(projectId: string, about: ManuscriptAbout): Promise<void> { return sqliteSetManuscriptAbout(await getDb(), projectId, about); }
  async getSceneText(sceneId: string): Promise<{ title: string; text: string } | null> { return sqliteGetSceneText(await getDb(), sceneId); }  async getSceneExcludedFromAi(sceneId: string): Promise<boolean> { return sqliteGetSceneExcludedFromAi(await getDb(), sceneId); }
}
