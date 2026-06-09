/** Domain types and interface for the Story Bible data model. */

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

/**
 * EntityType is `string` (not a literal union) for forward-compatibility with
 * Phase 5's custom entity types. Phase 4 only creates/reads "character" and
 * "location" rows, but relation methods must not reject future values.
 */
export type EntityType = string;

export interface SceneLink {
  entityType: EntityType;
  entityId: string;
}

/** A group of linked entities sharing the same type, for inspector display. */
export interface SceneEntityGroup {
  type: EntityType;
  entities: Entity[];
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
 * A typed directed relationship edge stored in entity_relations.
 * Distinct from EntityLink (which is the old entity_links table used by
 * PeopleGroup for the char/location graph). Relations are the Phase 4 concept:
 * labelled, project-scoped, with optional auto-reciprocal.
 */
export interface Relation {
  id: string;
  projectId: string;
  fromEntity: string;
  toEntity: string;
  label: string;
  reciprocalId: string | null;
  createdAt: number;
}

/** A curated preset with a forward label and an inverse label. */
export interface RelationPreset {
  label: string;
  inv: string;
}

/** Arguments for addRelation — bundles the from/to/label fields to stay under max-params. */
export interface AddRelationArgs {
  fromEntity: string;
  toEntity: string;
  label: string;
  reciprocalLabel?: string;
}

/**
 * A user-defined custom entity type stored in entity_types_custom.
 * Built-in types (character/location/item/faction/lore/theme) are code-defined
 * and never appear in this table.
 */
export interface CustomEntityType {
  id: string;
  projectId: string;
  name: string;
  icon: string;
  color: string;
  /** JSON-serialized array of {key: string; label: string} objects. */
  fieldsJson: string;
  /** JSON-serialized array of {key: string; icon: string; label: string} objects. */
  sectionsJson: string;
}

/** Options object for createCustomType (>4 params rule). */
export interface CreateCustomTypeArgs {
  projectId: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * Curated relation presets keyed by entity type.
 * Use '*' as the fallback key shared across all types.
 * Phase 5 can extend with per-type entries (e.g. RELATION_PRESETS['character']).
 * Consumers: call getPresetsForType(entityType) to resolve the right list.
 */
export const RELATION_PRESETS: Record<string, RelationPreset[]> = {
  character: [
    { label: "Parent of",      inv: "Child of" },
    { label: "Child of",       inv: "Parent of" },
    { label: "Sibling of",     inv: "Sibling of" },
    { label: "Spouse of",      inv: "Spouse of" },
    { label: "Grandparent of", inv: "Grandchild of" },
    { label: "Grandchild of",  inv: "Grandparent of" },
    { label: "Friend of",      inv: "Friend of" },
    { label: "Ally of",        inv: "Ally of" },
    { label: "Rival of",       inv: "Rival of" },
    { label: "Mentor of",      inv: "Apprentice of" },
    { label: "Apprentice of",  inv: "Mentor of" },
    { label: "Confidant of",   inv: "Confidant of" },
  ],
  faction: [
    { label: "Member of",  inv: "Has member" },
    { label: "Ally of",    inv: "Ally of" },
    { label: "Rival of",   inv: "Rival of" },
  ],
  location: [
    { label: "Located in", inv: "Contains" },
    { label: "Contains",   inv: "Located in" },
  ],
  '*': [
    { label: "Ally of",    inv: "Ally of" },
    { label: "Rival of",   inv: "Rival of" },
    { label: "Member of",  inv: "Has member" },
    { label: "Located in", inv: "Contains" },
    { label: "Friend of",  inv: "Friend of" },
  ],
};

/**
 * Returns the preset list for the given entity type, falling back to '*'.
 */
export function getPresetsForType(entityType: string): RelationPreset[] {
  return RELATION_PRESETS[entityType] ?? RELATION_PRESETS['*'] ?? [];
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
   * Returns an array of non-empty groups in taxonomy order (character, location,
   * item, faction, lore, theme), custom types alphabetically after built-ins.
   */
  loadSceneEntities(sceneId: string): Promise<SceneEntityGroup[]>;
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

  // ── Wave 27 Phase 5 — Entity types expansion ─────────────────────────────
  /**
   * Create a generic entity row of the given type (item/faction/lore/theme/custom).
   * Stores in the `entities` table (NOT characters/locations).
   */
  createEntity(
    projectId: string,
    type: EntityType,
    name: string,
    notes: string | null
  ): Promise<Entity>;

  /**
   * List all entities of the given type for a project (from the generic `entities` table).
   * Does NOT include characters or locations (those have their own tables).
   */
  listEntitiesByType(projectId: string, type: EntityType): Promise<Entity[]>;

  /** Create a custom entity-type definition. */
  createCustomType(args: CreateCustomTypeArgs): Promise<CustomEntityType>;
  /** List all custom entity-type definitions for a project. */
  listCustomTypes(projectId: string): Promise<CustomEntityType[]>;
  /** Delete a custom entity-type definition (does NOT cascade-delete entity rows). */
  deleteCustomType(id: string): Promise<void>;

  // ── Wave 27 Phase 4 — Typed relation edges ────────────────────────────────
  /**
   * Add a directed relation edge from→to with the given label.
   * If opts.reciprocalLabel is provided, also writes the inverse edge and links
   * both via reciprocal_id. Dedup-safe: a duplicate (project_id, from_entity,
   * to_entity) is silently ignored and the existing row is returned.
   */
  addRelation(projectId: string, args: AddRelationArgs): Promise<Relation>;
  /**
   * List all relation edges that involve entityId (either as from_entity OR to_entity).
   * If entityId is omitted, returns all relations for the project.
   */
  listRelations(projectId: string, entityId?: string): Promise<Relation[]>;
  /** Delete a relation by id. If the row has a reciprocal_id, also deletes the inverse. */
  deleteRelation(id: string): Promise<void>;
  /** Update a relation's label in-place. Does NOT update the reciprocal edge's label. */
  updateRelationLabel(id: string, label: string): Promise<void>;
  /**
   * Return all relations for a project (no entity filter).
   * Alias for listRelations(projectId) without an entityId; exposed as the
   * spec-surface name used by map views.
   */
  allRelations(projectId: string): Promise<Relation[]>;
}

// InMemoryStoryBibleStore lives in ./inMemoryStoryBibleStore.ts (extracted to stay under 300 lines).
