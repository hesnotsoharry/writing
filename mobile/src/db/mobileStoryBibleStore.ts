import type { BibleLocalBridge } from "../../../src/sync/bible/bibleLocalBridge";
import {
  findEntityLinkProjectId, findEntityProjectId, findEntityTypeProjectId,
  findFieldProjectId, findRelationProjectId, findSceneProjectId,
} from "../../../src/sync/bible/bibleMutationContext";
import type { DbClient } from "../shared/dbClient";
import {
  sqliteGetManuscriptAbout,
  sqliteGetSceneExcludedFromAi,
  sqliteGetSceneText,
  sqliteSetManuscriptAbout,
} from "../shared/sqliteAiContextStore";
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
} from "../shared/sqliteEntityDetail";
import {
  sqliteCreateCustomType,
  sqliteCreateEntity,
  sqliteDeleteCustomType,
  sqliteListCustomTypes,
  sqliteListEntitiesByType,
} from "../shared/sqliteEntityTypeStore";
import {
  sqliteAddRelation,
  sqliteDeleteRelation,
  sqliteListRelations,
  sqliteUpdateRelationLabel,
} from "../shared/sqliteRelationQueries";
import type {
  AddRelationArgs, Character, CreateCustomTypeArgs, CustomEntityType, Entity,
  EntityField, EntityLink, EntityType, EntityWithPortrait, FieldKind, Location,
  ManuscriptAbout, Relation, SceneEntityGroup, SceneLink, StoryBibleStore,
} from "../shared/storyBibleStore";
import { bridgeMobileBibleLocalWrite } from "./mobileBibleLocalBridge";
import { MobileEntityChangeEmitter } from "./mobileEntityChangeEmitter";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

interface EntityRow {
  id: string; project_id: string; name: string; notes: string | null;
  aliases: string | null; exclude_from_ai: number;
}
function mapEntity(row: EntityRow, type: string): Entity {
  return {
    id: row.id, projectId: row.project_id, type, name: row.name,
    notes: row.notes, aliases: row.aliases, exclude_from_ai: row.exclude_from_ai !== 0,
  };
}
function tableFor(type: EntityType): "characters" | "locations" | "entities" {
  if (type === "character") return "characters";
  if (type === "location") return "locations";
  return "entities";
}

export class MobileStoryBibleStore implements StoryBibleStore {
  private readonly changes = new MobileEntityChangeEmitter();
  constructor(private readonly db: DbClient, private readonly bibleBridge?: BibleLocalBridge) {}
  subscribeEntityChanges(listener: () => void): () => void { return this.changes.subscribe(listener); }
  private localWrite<T>(projectId: string | undefined, write: () => Promise<T>): Promise<T> {
    return projectId
      ? bridgeMobileBibleLocalWrite(projectId, this.db, write, this.bibleBridge)
      : write();
  }

  listCharacters(projectId: string): Promise<Character[]> {
    return this.db.select(
      "SELECT id, project_id AS projectId, name, notes, aliases FROM characters WHERE project_id = ?", [projectId],
    );
  }
  listLocations(projectId: string): Promise<Location[]> {
    return this.db.select(
      "SELECT id, project_id AS projectId, name, notes, aliases FROM locations WHERE project_id = ?", [projectId],
    );
  }

  async listEntities(projectId: string): Promise<Entity[]> {
    const characters = await this.db.select<EntityRow[]>(
      "SELECT id, project_id, name, notes, aliases, exclude_from_ai FROM characters WHERE project_id = ?", [projectId],
    );
    const locations = await this.db.select<EntityRow[]>(
      "SELECT id, project_id, name, notes, aliases, exclude_from_ai FROM locations WHERE project_id = ?", [projectId],
    );
    const generic = await this.db.select<Array<EntityRow & { entity_type: string }>>(
      "SELECT id, project_id, entity_type, name, notes, aliases, exclude_from_ai FROM entities WHERE project_id = ?", [projectId],
    );
    return [
      ...characters.map((row) => mapEntity(row, "character")),
      ...locations.map((row) => mapEntity(row, "location")),
      ...generic.map((row) => mapEntity(row, row.entity_type)),
    ];
  }

  createCharacter(projectId: string, name: string, notes: string | null): Promise<Character> {
    return this.createLegacy("character", projectId, name, notes) as Promise<Character>;
  }
  createLocation(projectId: string, name: string, notes: string | null): Promise<Location> {
    return this.createLegacy("location", projectId, name, notes) as Promise<Location>;
  }
  private async createLegacy(type: "character" | "location", projectId: string, name: string, notes: string | null) {
    const id = crypto.randomUUID();
    await this.localWrite(projectId, async () => this.db.execute(
      `INSERT INTO ${tableFor(type)} (id, project_id, name, notes, aliases) VALUES (?, ?, ?, ?, NULL)`,
      [id, projectId, name, notes],
    ));
    this.changes.notify();
    return { id, projectId, name, notes, aliases: null };
  }

  async renameEntity(type: EntityType, id: string, name: string): Promise<void> {
    const projectId = await findEntityProjectId(this.db, id);
    await this.localWrite(projectId, async () => this.db.execute(
      `UPDATE ${tableFor(type)} SET name = ? WHERE id = ?`, [name, id],
    ));
    this.changes.notify();
  }
  async updateEntityNotes(type: EntityType, id: string, notes: string | null): Promise<void> {
    const projectId = await findEntityProjectId(this.db, id);
    await this.localWrite(projectId, async () => this.db.execute(
      `UPDATE ${tableFor(type)} SET notes = ? WHERE id = ?`, [notes, id],
    ));
    this.changes.notify();
  }
  async deleteEntity(type: EntityType, id: string): Promise<void> {
    const projectId = await findEntityProjectId(this.db, id);
    await this.localWrite(projectId, async () => {
      await this.db.execute(`DELETE FROM ${tableFor(type)} WHERE id = ?`, [id]);
      await this.db.execute("DELETE FROM scene_links WHERE entity_id = ? AND entity_type = ?", [id, type]);
      await sqlitePurgeEntityDetail(this.db, id);
    });
    this.changes.notify();
  }
  async setEntityExclusion(type: EntityType, id: string, exclude: boolean): Promise<void> {
    const projectId = await findEntityProjectId(this.db, id);
    await this.localWrite(projectId, () => sqliteSetEntityExclusion(this.db, type, id, exclude));
    this.changes.notify();
  }

  async replaceSceneLinks(sceneId: string, links: SceneLink[]): Promise<void> {
    const projectId = await findSceneProjectId(this.db, sceneId);
    await this.localWrite(projectId, async () => {
      await this.db.execute("DELETE FROM scene_links WHERE scene_id = ?", [sceneId]);
      for (const link of links) await this.db.execute(
        "INSERT OR IGNORE INTO scene_links (scene_id, entity_type, entity_id) VALUES (?, ?, ?)",
        [sceneId, link.entityType, link.entityId],
      );
    });
    this.changes.notify();
  }
  async loadSceneLinks(sceneId: string): Promise<SceneLink[]> {
    const rows = await this.db.select<{ entity_type: string; entity_id: string }[]>(
      "SELECT entity_type, entity_id FROM scene_links WHERE scene_id = ?", [sceneId],
    );
    return rows.map((row) => ({ entityType: row.entity_type, entityId: row.entity_id }));
  }

  async loadSceneEntities(sceneId: string): Promise<SceneEntityGroup[]> {
    const links = await this.loadSceneLinks(sceneId);
    const entities = new Map((await this.listEntitiesForSceneProject(sceneId)).map((entity) => [entity.id, entity]));
    const groups = new Map<string, Entity[]>();
    links.forEach((link) => {
      const entity = entities.get(link.entityId);
      if (entity) (groups.get(link.entityType) ?? groups.set(link.entityType, []).get(link.entityType))?.push(entity);
    });
    const taxonomy = ["character", "location", "item", "faction", "lore", "theme"];
    return [...groups].sort(([left], [right]) => {
      const a = taxonomy.indexOf(left); const b = taxonomy.indexOf(right);
      if (a < 0 && b < 0) return left.localeCompare(right);
      return (a < 0 ? taxonomy.length : a) - (b < 0 ? taxonomy.length : b);
    }).map(([type, values]) => ({ type, entities: values.sort((a, b) => a.name.localeCompare(b.name)) }));
  }
  private async listEntitiesForSceneProject(sceneId: string): Promise<Entity[]> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM scenes WHERE id = ?", [sceneId]);
    return rows[0] ? this.listEntities(rows[0].project_id) : [];
  }
  async findScenesForEntity(entityId: string): Promise<string[]> {
    const rows = await this.db.select<{ scene_id: string }[]>("SELECT scene_id FROM scene_links WHERE entity_id = ?", [entityId]);
    return rows.map(({ scene_id }) => scene_id);
  }

  getEntity(type: EntityType, id: string): Promise<EntityWithPortrait | null> { return sqliteGetEntity(this.db, type, id); }
  getEntityFields(id: string): Promise<EntityField[]> { return sqliteGetEntityFields(this.db, id); }
  async setEntityField(entityId: string, kind: FieldKind, key: string, value: string): Promise<void> {
    const projectId = await findEntityProjectId(this.db, entityId);
    await this.localWrite(projectId, () => sqliteSetEntityField(this.db, { entityId, kind, key }, value));
    this.changes.notify();
  }
  async addEntityField(entityId: string, kind: FieldKind, key: string): Promise<EntityField> {
    const projectId = await findEntityProjectId(this.db, entityId);
    const field = await this.localWrite(projectId, () => sqliteAddEntityField(this.db, entityId, kind, key));
    this.changes.notify(); return field;
  }
  async deleteEntityField(id: string): Promise<void> {
    const projectId = await findFieldProjectId(this.db, id);
    await this.localWrite(projectId, () => sqliteDeleteEntityField(this.db, id)); this.changes.notify();
  }
  async reorderEntityFields(updates: { id: string; sort: number }[]): Promise<void> {
    const projectId = updates[0] ? await findFieldProjectId(this.db, updates[0].id) : undefined;
    await this.localWrite(projectId, () => sqliteReorderEntityFields(this.db, updates)); this.changes.notify();
  }
  listLinksFor(id: string): Promise<EntityLink[]> { return sqliteListLinksFor(this.db, id); }
  listLinksTo(id: string): Promise<EntityLink[]> { return sqliteListLinksTo(this.db, id); }
  async updateEntityFieldKey(id: string, key: string): Promise<void> {
    const projectId = await findFieldProjectId(this.db, id);
    await this.localWrite(projectId, () => sqliteUpdateEntityFieldKey(this.db, id, key)); this.changes.notify();
  }
  async addLink(from: string, to: string, relation: string): Promise<EntityLink> {
    const projectId = await findEntityProjectId(this.db, from);
    const link = await this.localWrite(projectId, () => sqliteAddLink(this.db, from, to, relation));
    this.changes.notify(); return link;
  }
  async removeLink(id: string): Promise<void> {
    const projectId = await findEntityLinkProjectId(this.db, id);
    await this.localWrite(projectId, () => sqliteRemoveLink(this.db, id)); this.changes.notify();
  }
  async updateLinkRelation(id: string, relation: string): Promise<void> {
    const projectId = await findEntityLinkProjectId(this.db, id);
    await this.localWrite(projectId, () => sqliteUpdateLinkRelation(this.db, id, relation));
    this.changes.notify();
  }
  setPortrait(type: EntityType, id: string, path: string): Promise<void> { return sqliteSetPortrait(this.db, type, id, path); }
  clearPortrait(type: EntityType, id: string): Promise<void> { return sqliteClearPortrait(this.db, type, id); }

  async createEntity(projectId: string, type: EntityType, name: string, notes: string | null): Promise<Entity> {
    const entity = await this.localWrite(
      projectId, () => sqliteCreateEntity(this.db, { projectId, type, name, notes }),
    );
    this.changes.notify(); return entity;
  }
  listEntitiesByType(projectId: string, type: EntityType): Promise<Entity[]> { return sqliteListEntitiesByType(this.db, projectId, type); }
  async createCustomType(args: CreateCustomTypeArgs): Promise<CustomEntityType> {
    const type = await this.localWrite(args.projectId, () => sqliteCreateCustomType(this.db, args));
    this.changes.notify(); return type;
  }
  listCustomTypes(projectId: string): Promise<CustomEntityType[]> { return sqliteListCustomTypes(this.db, projectId); }
  async deleteCustomType(id: string): Promise<void> {
    const projectId = await findEntityTypeProjectId(this.db, id);
    await this.localWrite(projectId, () => sqliteDeleteCustomType(this.db, id)); this.changes.notify();
  }
  async addRelation(projectId: string, args: AddRelationArgs): Promise<Relation> {
    const relation = await this.localWrite(projectId, () => this.addRelationSql(projectId, args));
    this.changes.notify(); return relation;
  }
  private async addRelationSql(projectId: string, args: AddRelationArgs): Promise<Relation> {
    await this.db.execute("BEGIN IMMEDIATE");
    try {
      const relation = await sqliteAddRelation(this.db, projectId, args);
      await this.db.execute("COMMIT");
      return relation;
    } catch (error) {
      await this.db.execute("ROLLBACK");
      throw error;
    }
  }
  listRelations(projectId: string, entityId?: string): Promise<Relation[]> { return sqliteListRelations(this.db, projectId, entityId); }
  async deleteRelation(id: string): Promise<void> {
    const projectId = await findRelationProjectId(this.db, id);
    await this.localWrite(projectId, () => this.deleteRelationSql(id));
    this.changes.notify();
  }
  private async deleteRelationSql(id: string): Promise<void> {
    await this.db.execute("BEGIN IMMEDIATE");
    try {
      await sqliteDeleteRelation(this.db, id);
      await this.db.execute("COMMIT");
    } catch (error) {
      await this.db.execute("ROLLBACK");
      throw error;
    }
  }
  async updateRelationLabel(id: string, label: string): Promise<void> {
    const projectId = await findRelationProjectId(this.db, id);
    await this.localWrite(projectId, () => sqliteUpdateRelationLabel(this.db, id, label));
    this.changes.notify();
  }
  allRelations(projectId: string): Promise<Relation[]> { return this.listRelations(projectId); }

  getManuscriptAbout(projectId: string): Promise<ManuscriptAbout> { return sqliteGetManuscriptAbout(this.db, projectId); }
  async setManuscriptAbout(projectId: string, about: ManuscriptAbout): Promise<void> {
    await sqliteSetManuscriptAbout(this.db, projectId, about);
    mobileLocalWrites.notify({ domain: "manuscript_about", projectId, rowId: projectId, deleted: false });
  }
  getSceneText(sceneId: string): Promise<{ title: string; text: string } | null> { return sqliteGetSceneText(this.db, sceneId); }
  getSceneExcludedFromAi(sceneId: string): Promise<boolean> { return sqliteGetSceneExcludedFromAi(this.db, sceneId); }
}
