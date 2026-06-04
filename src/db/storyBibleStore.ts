/** Domain types for the Story Bible data model. */

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

  async listCharacters(projectId: string): Promise<Character[]> {
    return this.characters.filter((c) => c.projectId === projectId);
  }

  async listLocations(projectId: string): Promise<Location[]> {
    return this.locations.filter((l) => l.projectId === projectId);
  }

  async createCharacter(
    projectId: string,
    name: string,
    notes: string | null
  ): Promise<Character> {
    const character: Character = {
      id: crypto.randomUUID(),
      projectId,
      name,
      notes,
      aliases: null,
    };
    this.characters.push(character);
    return character;
  }

  async createLocation(
    projectId: string,
    name: string,
    notes: string | null
  ): Promise<Location> {
    const location: Location = {
      id: crypto.randomUUID(),
      projectId,
      name,
      notes,
      aliases: null,
    };
    this.locations.push(location);
    return location;
  }

  async renameEntity(
    type: EntityType,
    id: string,
    name: string
  ): Promise<void> {
    if (type === "character") {
      this.characters = this.characters.map((c) =>
        c.id === id ? { ...c, name } : c
      );
    } else {
      this.locations = this.locations.map((l) =>
        l.id === id ? { ...l, name } : l
      );
    }
  }

  async updateEntityNotes(
    type: EntityType,
    id: string,
    notes: string | null
  ): Promise<void> {
    if (type === "character") {
      this.characters = this.characters.map((c) =>
        c.id === id ? { ...c, notes } : c
      );
    } else {
      this.locations = this.locations.map((l) =>
        l.id === id ? { ...l, notes } : l
      );
    }
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

  async loadSceneEntities(
    sceneId: string
  ): Promise<{ characters: Entity[]; locations: Entity[] }> {
    const links = this.sceneLinks.filter((sl) => sl.sceneId === sceneId);
    const characters: Entity[] = [];
    const locations: Entity[] = [];
    for (const link of links) {
      if (link.entityType === "character") {
        const c = this.characters.find((ch) => ch.id === link.entityId);
        if (c) {
          characters.push({
            id: c.id,
            projectId: c.projectId,
            type: "character" as const,
            name: c.name,
            notes: c.notes,
            aliases: c.aliases,
          });
        }
      } else {
        const l = this.locations.find((lo) => lo.id === link.entityId);
        if (l) {
          locations.push({
            id: l.id,
            projectId: l.projectId,
            type: "location" as const,
            name: l.name,
            notes: l.notes,
            aliases: l.aliases,
          });
        }
      }
    }
    // Sort by name for a deterministic, stable card order in the inspector —
    // mirrors the `ORDER BY name` the SQLite impl applies (the consumer renders
    // these as an ordered list; link-insertion order is not meaningful to it).
    const byName = (a: Entity, b: Entity) => a.name.localeCompare(b.name);
    characters.sort(byName);
    locations.sort(byName);
    return { characters, locations };
  }

  async findScenesForEntity(entityId: string): Promise<string[]> {
    return this.sceneLinks
      .filter((sl) => sl.entityId === entityId)
      .map((sl) => sl.sceneId);
  }

  async listEntities(projectId: string): Promise<Entity[]> {
    const chars = await this.listCharacters(projectId);
    const locs = await this.listLocations(projectId);
    return [
      ...chars.map((c) => ({
        id: c.id,
        projectId: c.projectId,
        type: "character" as const,
        name: c.name,
        notes: c.notes,
        aliases: c.aliases,
      })),
      ...locs.map((l) => ({
        id: l.id,
        projectId: l.projectId,
        type: "location" as const,
        name: l.name,
        notes: l.notes,
        aliases: l.aliases,
      })),
    ];
  }

  // ── Wave 24 Full Entry additive surface — STUBS (orchestrator-declared; Phase 1 fills). ──
  async getEntity(
    _type: EntityType,
    _id: string
  ): Promise<EntityWithPortrait | null> {
    throw new Error("not implemented");
  }
  async getEntityFields(_entityId: string): Promise<EntityField[]> {
    throw new Error("not implemented");
  }
  async setEntityField(
    _entityId: string,
    _kind: FieldKind,
    _key: string,
    _value: string
  ): Promise<void> {
    throw new Error("not implemented");
  }
  async addEntityField(
    _entityId: string,
    _kind: FieldKind,
    _key: string
  ): Promise<EntityField> {
    throw new Error("not implemented");
  }
  async deleteEntityField(_fieldId: string): Promise<void> {
    throw new Error("not implemented");
  }
  async reorderEntityFields(
    _updates: { id: string; sort: number }[]
  ): Promise<void> {
    throw new Error("not implemented");
  }
  async listLinksFor(_entityId: string): Promise<EntityLink[]> {
    throw new Error("not implemented");
  }
  async addLink(
    _fromId: string,
    _toId: string,
    _relation: string
  ): Promise<EntityLink> {
    throw new Error("not implemented");
  }
  async removeLink(_linkId: string): Promise<void> {
    throw new Error("not implemented");
  }
  async updateLinkRelation(_linkId: string, _relation: string): Promise<void> {
    throw new Error("not implemented");
  }
  async setPortrait(
    _type: EntityType,
    _id: string,
    _path: string
  ): Promise<void> {
    throw new Error("not implemented");
  }
  async clearPortrait(_type: EntityType, _id: string): Promise<void> {
    throw new Error("not implemented");
  }
}
