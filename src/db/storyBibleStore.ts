/** Domain types for the Story Bible data model. */

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
  imSetEntityField,
  imSetPortrait,
  imUpdateEntityFieldKey,
  imUpdateEntityNotes,
  imUpdateLinkRelation,
} from "./inMemoryEntityDetail";

export interface Character {
  id: string;
  projectId: string;
  name: string;
  notes: string | null;
  aliases: string | null;
}

export interface Location {
  id: string;
  projectId: string;
  name: string;
  notes: string | null;
  aliases: string | null;
}

export type EntityType = "character" | "location";

export interface SceneLink {
  entityType: EntityType;
  entityId: string;
}

export interface Entity {
  id: string;
  projectId: string;
  type: EntityType;
  name: string;
  notes: string | null;
  aliases: string | null;
}

export type FieldKind = "fact" | "section";

/** Logical key identifying a field row — used to keep setEntityField under 4 params. */
export interface FieldKey {
  entityId: string;
  kind: FieldKind;
  key: string;
}

/** A generic entity_fields row — short facts and long prose sections share this shape. */
export interface EntityField {
  id: string;
  entityId: string;
  kind: FieldKind;
  key: string;
  value: string;
  sort: number;
}

/** A directional entity→entity link (relationships / characters-here). */
export interface EntityLink {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
}

/**
 * Entity plus its portrait path — the single-entity loader's return shape.
 * portrait_path is intentionally NOT a field on the base Entity (Wave 24 Decision 4):
 * it stays off the batch list-read path and out of the existing entity-shape assertions.
 */
export type EntityWithPortrait = Entity & { portraitPath: string | null };

/** Abstraction over Story Bible persistence (characters, locations, scene links). */
export interface StoryBibleStore {
  listCharacters(projectId: string): Promise<Character[]>;
  listLocations(projectId: string): Promise<Location[]>;
  listEntities(projectId: string): Promise<Entity[]>;
  createCharacter(
    projectId: string,
    name: string,
    notes: string | null
  ): Promise<Character>;
  createLocation(
    projectId: string,
    name: string,
    notes: string | null
  ): Promise<Location>;
  renameEntity(type: EntityType, id: string, name: string): Promise<void>;
  updateEntityNotes(
    type: EntityType,
    id: string,
    notes: string | null
  ): Promise<void>;
  /** Delete entity and remove all its scene_links rows. */
  deleteEntity(type: EntityType, id: string): Promise<void>;
  /**
   * Replace the full set of links for a scene: DELETE all rows for sceneId,
   * then INSERT the new set. Not a merge — caller owns the full replacement.
   */
  replaceSceneLinks(sceneId: string, links: SceneLink[]): Promise<void>;
  loadSceneLinks(sceneId: string): Promise<SceneLink[]>;
  /**
   * Return the full Entity objects linked to a scene, grouped by type.
   * Additive read-query (wave 9) — the inspector's entity cards consume this
   * (avatar initial from name, role subtitle from notes).
   */
  loadSceneEntities(
    sceneId: string
  ): Promise<{ characters: Entity[]; locations: Entity[] }>;
  /** Return scene_ids that reference the given entity (for usage counts). */
  findScenesForEntity(entityId: string): Promise<string[]>;

  // ── Wave 24 Full Entry additive surface ───────────────────────────────────
  /** Load one entity by type+id, including its portrait_path. Null if absent. */
  getEntity(type: EntityType, id: string): Promise<EntityWithPortrait | null>;
  /** All entity_fields rows for an entity, ordered by kind then sort. */
  getEntityFields(entityId: string): Promise<EntityField[]>;
  /** Upsert a field value on the logical key (entity_id, kind, key). */
  setEntityField(
    entityId: string,
    kind: FieldKind,
    key: string,
    value: string
  ): Promise<void>;
  /** Add a new custom field (empty value, sort after the last); returns the row. */
  addEntityField(
    entityId: string,
    kind: FieldKind,
    key: string
  ): Promise<EntityField>;
  /** Remove a field row by id. */
  deleteEntityField(fieldId: string): Promise<void>;
  /** Set sort values for a list of field ids. */
  reorderEntityFields(updates: { id: string; sort: number }[]): Promise<void>;
  /** All directional links where from_id = entityId. */
  listLinksFor(entityId: string): Promise<EntityLink[]>;
  /**
   * All directional links where to_id = toId.
   * Used by location entries to find the characters linked TO them
   * (char→location links are stored as fromId=char, toId=loc).
   */
  listLinksTo(toId: string): Promise<EntityLink[]>;
  /**
   * Rename a custom field's key in-place, preserving its id/value/sort.
   * No-op if the field is not found. Used by detail-box label editing.
   */
  updateEntityFieldKey(fieldId: string, newKey: string): Promise<void>;
  /** Add a directional link from→to; dedup-safe on (from_id, to_id). */
  addLink(fromId: string, toId: string, relation: string): Promise<EntityLink>;
  /** Remove a link by id. */
  removeLink(linkId: string): Promise<void>;
  /** Update a link's relation label. */
  updateLinkRelation(linkId: string, relation: string): Promise<void>;
  /** Set/replace the portrait_path for an entity. */
  setPortrait(type: EntityType, id: string, path: string): Promise<void>;
  /** Clear the portrait_path (set null). */
  clearPortrait(type: EntityType, id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory fake — used in tests; mirrors InMemoryBinderStore discipline.
// ---------------------------------------------------------------------------

export class InMemoryStoryBibleStore implements StoryBibleStore {
  private characters: Character[] = [];
  private locations: Location[] = [];
  private sceneLinks: (SceneLink & { sceneId: string })[] = [];
  private entityFields: EntityField[] = [];
  private entityLinks: EntityLink[] = [];
  private portraits = new Map<string, string>();

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
    const r = imRenameEntity(type, id, name, { characters: this.characters, locations: this.locations });
    this.characters = r.characters; this.locations = r.locations;
  }

  async updateEntityNotes(type: EntityType, id: string, notes: string | null): Promise<void> {
    const r = imUpdateEntityNotes(type, id, notes, { characters: this.characters, locations: this.locations });
    this.characters = r.characters; this.locations = r.locations;
  }

  async deleteEntity(type: EntityType, id: string): Promise<void> {
    if (type === "character") {
      this.characters = this.characters.filter((c) => c.id !== id);
    } else {
      this.locations = this.locations.filter((l) => l.id !== id);
    }
    this.sceneLinks = this.sceneLinks.filter(
      (sl) => !(sl.entityType === type && sl.entityId === id)
    );
    const purged = imPurgeEntityDetail(id, this.entityFields, this.entityLinks, this.portraits);
    this.entityFields = purged.entityFields;
    this.entityLinks = purged.entityLinks;
  }

  async replaceSceneLinks(sceneId: string, links: SceneLink[]): Promise<void> {
    this.sceneLinks = this.sceneLinks.filter((sl) => sl.sceneId !== sceneId);
    for (const link of links) {
      this.sceneLinks.push({ sceneId, ...link });
    }
  }

  async loadSceneLinks(sceneId: string): Promise<SceneLink[]> {
    return this.sceneLinks
      .filter((sl) => sl.sceneId === sceneId)
      .map(({ entityType, entityId }) => ({ entityType, entityId }));
  }

  async loadSceneEntities(sceneId: string): Promise<{ characters: Entity[]; locations: Entity[] }> {
    return imLoadSceneEntities(sceneId, this.sceneLinks, this.characters, this.locations);
  }

  async findScenesForEntity(entityId: string): Promise<string[]> {
    return this.sceneLinks
      .filter((sl) => sl.entityId === entityId)
      .map((sl) => sl.sceneId);
  }

  async listEntities(projectId: string): Promise<Entity[]> {
    const chars = await this.listCharacters(projectId);
    const locs = await this.listLocations(projectId);
    return imListEntities(chars, locs);
  }

  // ── Wave 24 Full Entry additive surface ──────────────────────────────────
  async getEntity(type: EntityType, id: string): Promise<EntityWithPortrait | null> {
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
}
