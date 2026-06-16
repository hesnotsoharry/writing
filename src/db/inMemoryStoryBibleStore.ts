/**
 * In-memory fake StoryBibleStore — used in tests.
 * Mirrors the same seam discipline as InMemoryBinderStore.
 * Extracted from storyBibleStore.ts to keep that file within the 300-line limit.
 */
import type { ManuscriptAbout } from "../features/ai/ai.types";
import { EMPTY_ABOUT } from "../features/ai/ai.types";
import {
  imAddEntityField,
  imAddLink,
  imClearPortrait,
  imCreateCharacter,
  imCreateLocation,
  imDeleteEntityField,
  type ImEntityCtx,
  imGetEntity,
  imGetEntityFields,
  imListEntities,
  imListLinksFor,
  imListLinksTo,
  imLoadSceneEntities,
  imPurgeEntityDetail,
  imRemoveLink,
  imRenameEntity,
  imReorderEntityFields,
  type ImSceneEntitiesCtx,
  imSetEntityField,
  imSetPortrait,
  imUpdateEntityFieldKey,
  imUpdateEntityNotes,
  imUpdateLinkRelation,
} from "./inMemoryEntityDetail";
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

// ── imAddRelation (pure helper) ───────────────────────────────────────────────

function imAddRelation(projectId: string, args: AddRelationArgs, relations: Relation[]): Relation {
  const { fromEntity, toEntity, label, reciprocalLabel } = args;
  const now = Date.now();
  const fwd: Relation = { id: crypto.randomUUID(), projectId, fromEntity, toEntity, label, reciprocalId: null, createdAt: now };
  relations.push(fwd);
  if (reciprocalLabel !== undefined) {
    const noInv = !relations.find((r) => r.projectId === projectId && r.fromEntity === toEntity && r.toEntity === fromEntity);
    if (noInv) {
      const inv: Relation = { id: crypto.randomUUID(), projectId, fromEntity: toEntity, toEntity: fromEntity, label: reciprocalLabel, reciprocalId: fwd.id, createdAt: now };
      relations.push(inv);
      fwd.reciprocalId = inv.id;
    }
  }
  return fwd;
}

// ── InMemoryStoryBibleStore ───────────────────────────────────────────────────

export class InMemoryStoryBibleStore implements StoryBibleStore {
  private characters: Character[] = [];
  private locations: Location[] = [];
  private genericEntities: Entity[] = [];
  private sceneLinks: (SceneLink & { sceneId: string })[] = [];
  private entityFields: EntityField[] = [];
  private entityLinks: EntityLink[] = [];
  private portraits = new Map<string, string>();
  private relations: Relation[] = [];
  private customTypes: CustomEntityType[] = [];
  private aboutByProject = new Map<string, ManuscriptAbout>();

  async listCharacters(projectId: string): Promise<Character[]> {
    return this.characters.filter((c) => c.projectId === projectId);
  }

  async listLocations(projectId: string): Promise<Location[]> {
    return this.locations.filter((l) => l.projectId === projectId);
  }

  async createCharacter(projectId: string, name: string, notes: string | null): Promise<Character> {
    return imCreateCharacter(projectId, name, notes, this.characters);
  }

  async createLocation(projectId: string, name: string, notes: string | null): Promise<Location> {
    return imCreateLocation(projectId, name, notes, this.locations);
  }

  async renameEntity(type: EntityType, id: string, name: string): Promise<void> {
    if (type !== "character" && type !== "location") {
      const e = this.genericEntities.find((x) => x.id === id);
      if (e) e.name = name;
      return;
    }
    const r = imRenameEntity(type, id, name, { characters: this.characters, locations: this.locations });
    this.characters = r.characters; this.locations = r.locations;
  }

  async updateEntityNotes(type: EntityType, id: string, notes: string | null): Promise<void> {
    if (type !== "character" && type !== "location") {
      const e = this.genericEntities.find((x) => x.id === id);
      if (e) e.notes = notes;
      return;
    }
    const r = imUpdateEntityNotes(type, id, notes, { characters: this.characters, locations: this.locations });
    this.characters = r.characters; this.locations = r.locations;
  }

  async deleteEntity(type: EntityType, id: string): Promise<void> {
    if (type === "character") {
      this.characters = this.characters.filter((c) => c.id !== id);
    } else if (type === "location") {
      this.locations = this.locations.filter((l) => l.id !== id);
    } else {
      this.genericEntities = this.genericEntities.filter((e) => e.id !== id);
    }
    this.sceneLinks = this.sceneLinks.filter((sl) => !(sl.entityType === type && sl.entityId === id));
    const purged = imPurgeEntityDetail(id, this.entityFields, this.entityLinks, this.portraits);
    this.entityFields = purged.entityFields;
    this.entityLinks = purged.entityLinks;
    this.relations = this.relations.filter((r) => r.fromEntity !== id && r.toEntity !== id);
  }

  async replaceSceneLinks(sceneId: string, links: SceneLink[]): Promise<void> {
    this.sceneLinks = this.sceneLinks.filter((sl) => sl.sceneId !== sceneId);
    for (const link of links) { this.sceneLinks.push({ sceneId, ...link }); }
  }

  async loadSceneLinks(sceneId: string): Promise<SceneLink[]> {
    return this.sceneLinks.filter((sl) => sl.sceneId === sceneId).map(({ entityType, entityId }) => ({ entityType, entityId }));
  }

  async loadSceneEntities(sceneId: string): Promise<SceneEntityGroup[]> {
    const ctx: ImSceneEntitiesCtx = { sceneLinks: this.sceneLinks, characters: this.characters, locations: this.locations, genericEntities: this.genericEntities };
    return imLoadSceneEntities(sceneId, ctx);
  }

  async findScenesForEntity(entityId: string): Promise<string[]> {
    return this.sceneLinks.filter((sl) => sl.entityId === entityId).map((sl) => sl.sceneId);
  }

  async listEntities(projectId: string): Promise<Entity[]> {
    const chars = await this.listCharacters(projectId);
    const locs = await this.listLocations(projectId);
    const gen = this.genericEntities.filter((e) => e.projectId === projectId);
    return [...imListEntities(chars, locs), ...gen];
  }

  async getEntity(type: EntityType, id: string): Promise<EntityWithPortrait | null> {
    if (type !== "character" && type !== "location") {
      const e = this.genericEntities.find((x) => x.id === id);
      if (!e) return null;
      return { ...e, portraitPath: null };
    }
    const ctx: ImEntityCtx = { characters: this.characters, locations: this.locations, portraits: this.portraits };
    return imGetEntity(type, id, ctx);
  }

  async getEntityFields(entityId: string): Promise<EntityField[]> {
    return imGetEntityFields(entityId, this.entityFields);
  }

  async setEntityField(entityId: string, kind: FieldKind, key: string, value: string): Promise<void> {
    imSetEntityField({ entityId, kind, key }, value, this.entityFields);
  }

  async addEntityField(entityId: string, kind: FieldKind, key: string): Promise<EntityField> {
    return imAddEntityField(entityId, kind, key, this.entityFields);
  }

  async deleteEntityField(fieldId: string): Promise<void> {
    this.entityFields = imDeleteEntityField(fieldId, this.entityFields);
  }

  async reorderEntityFields(updates: { id: string; sort: number }[]): Promise<void> {
    imReorderEntityFields(updates, this.entityFields);
  }

  async listLinksFor(entityId: string): Promise<EntityLink[]> {
    return imListLinksFor(entityId, this.entityLinks);
  }

  async listLinksTo(toId: string): Promise<EntityLink[]> {
    return imListLinksTo(toId, this.entityLinks);
  }

  async updateEntityFieldKey(fieldId: string, newKey: string): Promise<void> {
    imUpdateEntityFieldKey(fieldId, newKey, this.entityFields);
  }

  async addLink(fromId: string, toId: string, relation: string): Promise<EntityLink> {
    return imAddLink(fromId, toId, relation, this.entityLinks);
  }

  async removeLink(linkId: string): Promise<void> {
    this.entityLinks = imRemoveLink(linkId, this.entityLinks);
  }

  async updateLinkRelation(linkId: string, relation: string): Promise<void> {
    imUpdateLinkRelation(linkId, relation, this.entityLinks);
  }

  async setPortrait(_type: EntityType, id: string, path: string): Promise<void> {
    imSetPortrait(id, path, this.portraits);
  }

  async clearPortrait(_type: EntityType, id: string): Promise<void> {
    imClearPortrait(id, this.portraits);
  }

  // ── Wave 27 Phase 5 — Entity types expansion ─────────────────────────────

  async createEntity(
    projectId: string,
    type: EntityType,
    name: string,
    notes: string | null
  ): Promise<Entity> {
    const entity: Entity = { id: crypto.randomUUID(), projectId, type, name, notes, aliases: null };
    this.genericEntities.push(entity);
    return entity;
  }

  async listEntitiesByType(projectId: string, type: EntityType): Promise<Entity[]> {
    return this.genericEntities.filter((e) => e.projectId === projectId && e.type === type);
  }

  async createCustomType(args: CreateCustomTypeArgs): Promise<CustomEntityType> {
    const { projectId, name, icon, color } = args;
    const ct: CustomEntityType = {
      id: crypto.randomUUID(),
      projectId,
      name,
      icon,
      color,
      fieldsJson: "[]",
      sectionsJson: "[]",
    };
    this.customTypes.push(ct);
    return ct;
  }

  async listCustomTypes(projectId: string): Promise<CustomEntityType[]> {
    return this.customTypes.filter((ct) => ct.projectId === projectId);
  }

  async deleteCustomType(id: string): Promise<void> {
    this.customTypes = this.customTypes.filter((ct) => ct.id !== id);
  }

  async addRelation(projectId: string, args: AddRelationArgs): Promise<Relation> {
    const existing = this.relations.find(
      (r) => r.projectId === projectId && r.fromEntity === args.fromEntity && r.toEntity === args.toEntity
    );
    if (existing) return existing;
    return imAddRelation(projectId, args, this.relations);
  }

  async listRelations(projectId: string, entityId?: string): Promise<Relation[]> {
    return this.relations.filter(
      (r) => r.projectId === projectId &&
        (entityId === undefined || r.fromEntity === entityId || r.toEntity === entityId)
    );
  }

  async deleteRelation(id: string): Promise<void> {
    const row = this.relations.find((r) => r.id === id);
    if (!row) return;
    const recipId = row.reciprocalId;
    this.relations = this.relations.filter((r) => r.id !== id);
    if (recipId) { this.relations = this.relations.filter((r) => r.id !== recipId); }
  }

  async updateRelationLabel(id: string, label: string): Promise<void> {
    const row = this.relations.find((r) => r.id === id);
    if (row) row.label = label;
  }

  async allRelations(projectId: string): Promise<Relation[]> {
    return this.listRelations(projectId);
  }

  async setEntityExclusion(type: EntityType, id: string, exclude: boolean): Promise<void> {
    if (type === "character") {
      const c = this.characters.find((x) => x.id === id);
      if (c) (c as unknown as Record<string, unknown>)["exclude_from_ai"] = exclude;
    } else if (type === "location") {
      const l = this.locations.find((x) => x.id === id);
      if (l) (l as unknown as Record<string, unknown>)["exclude_from_ai"] = exclude;
    } else {
      const e = this.genericEntities.find((x) => x.id === id);
      if (e) e.exclude_from_ai = exclude;
    }
  }

  // ── Wave 35 Phase E — AI context v2 ──────────────────────────────────────

  async getManuscriptAbout(projectId: string): Promise<ManuscriptAbout> {
    return { ...(this.aboutByProject.get(projectId) ?? EMPTY_ABOUT) };
  }

  async setManuscriptAbout(projectId: string, about: ManuscriptAbout): Promise<void> {
    this.aboutByProject.set(projectId, { ...about });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getSceneText(_sceneId: string): Promise<{ title: string; text: string } | null> {
    return null;
  }
}
