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
  /** Return scene_ids that reference the given entity (for usage counts). */
  findScenesForEntity(entityId: string): Promise<string[]>;
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
}
