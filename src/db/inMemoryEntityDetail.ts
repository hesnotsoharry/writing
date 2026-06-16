/**
 * Pure free-function helpers for the InMemoryStoryBibleStore Wave-24 Full Entry surface.
 * All functions operate on the store's collections passed by reference — mutations are
 * in-place so the class methods stay as thin delegators.
 *
 * Mutation convention:
 *   Helpers that change a single row mutate the passed array in place (void);
 *   helpers that drop rows return a new filtered array the caller reassigns.
 */

import type {
  Character,
  Entity,
  EntityField,
  EntityLink,
  EntityType,
  EntityWithPortrait,
  FieldKey,
  FieldKind,
  Location,
  SceneEntityGroup,
  SceneLink,
} from "./storyBibleStore";

/** Subset of store state needed to resolve a single entity by type+id. */
export interface ImEntityCtx {
  characters: Character[];
  locations: Location[];
  portraits: Map<string, string>;
}

// ── Pre-Wave-24 method implementations ───────────────────────────────────────

/** Shared lists context for entity list mutations (rename, notes update). */
interface ImListCtx {
  characters: Character[];
  locations: Location[];
}

export function imRenameEntity(
  type: EntityType,
  id: string,
  name: string,
  ctx: ImListCtx
): ImListCtx {
  if (type === "character") return { ...ctx, characters: ctx.characters.map((c) => c.id === id ? { ...c, name } : c) };
  return { ...ctx, locations: ctx.locations.map((l) => l.id === id ? { ...l, name } : l) };
}

export function imUpdateEntityNotes(
  type: EntityType,
  id: string,
  notes: string | null,
  ctx: ImListCtx
): ImListCtx {
  if (type === "character") return { ...ctx, characters: ctx.characters.map((c) => c.id === id ? { ...c, notes } : c) };
  return { ...ctx, locations: ctx.locations.map((l) => l.id === id ? { ...l, notes } : l) };
}

export function imCreateCharacter(
  projectId: string,
  name: string,
  notes: string | null,
  characters: Character[]
): Character {
  const character: Character = { id: crypto.randomUUID(), projectId, name, notes, aliases: null };
  characters.push(character);
  return character;
}

export function imCreateLocation(
  projectId: string,
  name: string,
  notes: string | null,
  locations: Location[]
): Location {
  const location: Location = { id: crypto.randomUUID(), projectId, name, notes, aliases: null };
  locations.push(location);
  return location;
}

/** Store collections needed to resolve scene-linked entities across all tables. */
export interface ImSceneEntitiesCtx {
  sceneLinks: (SceneLink & { sceneId: string })[];
  characters: Character[];
  locations: Location[];
  genericEntities: Entity[];
}

export function imLoadSceneEntities(sceneId: string, ctx: ImSceneEntitiesCtx): SceneEntityGroup[] {
  const { sceneLinks, characters, locations, genericEntities } = ctx;
  const links = sceneLinks.filter((sl) => sl.sceneId === sceneId);
  const byType = new Map<string, Entity[]>();
  for (const link of links) {
    let entity: Entity | undefined;
    if (link.entityType === "character") {
      const c = characters.find((ch) => ch.id === link.entityId);
      if (c) entity = { id: c.id, projectId: c.projectId, type: "character", name: c.name, notes: c.notes, aliases: c.aliases, exclude_from_ai: (c as unknown as Record<string, unknown>)["exclude_from_ai"] === true };
    } else if (link.entityType === "location") {
      const l = locations.find((lo) => lo.id === link.entityId);
      if (l) entity = { id: l.id, projectId: l.projectId, type: "location", name: l.name, notes: l.notes, aliases: l.aliases, exclude_from_ai: (l as unknown as Record<string, unknown>)["exclude_from_ai"] === true };
    } else {
      entity = genericEntities.find((e) => e.id === link.entityId);
    }
    if (entity) {
      const bucket = byType.get(link.entityType);
      if (bucket) bucket.push(entity);
      else byType.set(link.entityType, [entity]);
    }
  }
  // Sort groups in taxonomy order (character, location, item, faction, lore, theme),
  // custom types alphabetically after built-ins. Within each group, sort by name.
  const TAXONOMY = ["character", "location", "item", "faction", "lore", "theme"];
  const sortKey = (t: string) => { const i = TAXONOMY.indexOf(t); return i === -1 ? TAXONOMY.length : i; };
  const byName = (a: Entity, b: Entity) => a.name.localeCompare(b.name);
  return [...byType.entries()]
    .sort(([a], [b]) => { const d = sortKey(a) - sortKey(b); return d !== 0 ? d : a.localeCompare(b); })
    .map(([type, entities]) => ({ type, entities: [...entities].sort(byName) }));
}

export function imListEntities(characters: Character[], locations: Location[]): Entity[] {
  return [
    ...characters.map((c) => ({ id: c.id, projectId: c.projectId, type: "character" as const, name: c.name, notes: c.notes, aliases: c.aliases, exclude_from_ai: (c as unknown as Record<string, unknown>)["exclude_from_ai"] === true })),
    ...locations.map((l) => ({ id: l.id, projectId: l.projectId, type: "location" as const, name: l.name, notes: l.notes, aliases: l.aliases, exclude_from_ai: (l as unknown as Record<string, unknown>)["exclude_from_ai"] === true })),
  ];
}

export function imGetEntity(
  type: EntityType,
  id: string,
  ctx: ImEntityCtx
): EntityWithPortrait | null {
  let base: Entity | undefined;
  if (type === "character") {
    const c = ctx.characters.find((ch) => ch.id === id);
    if (!c) return null;
    base = { id: c.id, projectId: c.projectId, type: "character", name: c.name, notes: c.notes, aliases: c.aliases };
  } else {
    const l = ctx.locations.find((lo) => lo.id === id);
    if (!l) return null;
    base = { id: l.id, projectId: l.projectId, type: "location", name: l.name, notes: l.notes, aliases: l.aliases };
  }
  return { ...base, portraitPath: ctx.portraits.get(id) ?? null };
}

export function imGetEntityFields(
  entityId: string,
  entityFields: EntityField[]
): EntityField[] {
  return entityFields
    .filter((f) => f.entityId === entityId)
    .slice()
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.sort - b.sort;
    });
}

export function imSetEntityField(
  fk: FieldKey,
  value: string,
  entityFields: EntityField[]
): void {
  const idx = entityFields.findIndex(
    (f) => f.entityId === fk.entityId && f.kind === fk.kind && f.key === fk.key
  );
  if (idx !== -1) {
    entityFields[idx] = { ...entityFields[idx], value };
  } else {
    const maxSort = entityFields
      .filter((f) => f.entityId === fk.entityId)
      .reduce((m, f) => Math.max(m, f.sort), -1);
    entityFields.push({ id: crypto.randomUUID(), entityId: fk.entityId, kind: fk.kind, key: fk.key, value, sort: maxSort + 1 });
  }
}

export function imAddEntityField(
  entityId: string,
  kind: FieldKind,
  key: string,
  entityFields: EntityField[]
): EntityField {
  const existing = entityFields.find(
    (f) => f.entityId === entityId && f.kind === kind && f.key === key
  );
  if (existing) return existing;
  const maxSort = entityFields
    .filter((f) => f.entityId === entityId)
    .reduce((m, f) => Math.max(m, f.sort), -1);
  const field: EntityField = { id: crypto.randomUUID(), entityId, kind, key, value: "", sort: maxSort + 1 };
  entityFields.push(field);
  return field;
}

export function imDeleteEntityField(fieldId: string, entityFields: EntityField[]): EntityField[] {
  return entityFields.filter((f) => f.id !== fieldId);
}

export function imReorderEntityFields(
  updates: { id: string; sort: number }[],
  entityFields: EntityField[]
): void {
  for (const { id, sort } of updates) {
    const idx = entityFields.findIndex((f) => f.id === id);
    if (idx !== -1) {
      entityFields[idx] = { ...entityFields[idx], sort };
    }
  }
}

export function imListLinksFor(entityId: string, entityLinks: EntityLink[]): EntityLink[] {
  return entityLinks.filter((l) => l.fromId === entityId);
}

/** Reverse-direction query: links where to_id === toId (e.g. location → its characters). */
export function imListLinksTo(toId: string, entityLinks: EntityLink[]): EntityLink[] {
  return entityLinks.filter((l) => l.toId === toId);
}

/**
 * In-place key rename for a custom entity field.
 * Updates the `key` column of the row identified by `fieldId` while preserving
 * its `id`, `entityId`, `kind`, `value`, and `sort` — no delete+add needed.
 * No-op if the field is not found.
 */
export function imUpdateEntityFieldKey(
  fieldId: string,
  newKey: string,
  entityFields: EntityField[]
): void {
  const idx = entityFields.findIndex((f) => f.id === fieldId);
  if (idx !== -1) {
    entityFields[idx] = { ...entityFields[idx], key: newKey };
  }
}

export function imAddLink(
  fromId: string,
  toId: string,
  relation: string,
  entityLinks: EntityLink[]
): EntityLink {
  const existing = entityLinks.find((l) => l.fromId === fromId && l.toId === toId);
  if (existing) return existing;
  const link: EntityLink = { id: crypto.randomUUID(), fromId, toId, relation };
  entityLinks.push(link);
  return link;
}

export function imRemoveLink(linkId: string, entityLinks: EntityLink[]): EntityLink[] {
  return entityLinks.filter((l) => l.id !== linkId);
}

export function imUpdateLinkRelation(
  linkId: string,
  relation: string,
  entityLinks: EntityLink[]
): void {
  const idx = entityLinks.findIndex((l) => l.id === linkId);
  if (idx !== -1) {
    entityLinks[idx] = { ...entityLinks[idx], relation };
  }
}

export function imSetPortrait(id: string, path: string, portraits: Map<string, string>): void {
  portraits.set(id, path);
}

export function imClearPortrait(id: string, portraits: Map<string, string>): void {
  portraits.delete(id);
}

/** Purge all entity_fields, entity_links, and portrait for an entity (used by deleteEntity). */
export function imPurgeEntityDetail(
  id: string,
  entityFields: EntityField[],
  entityLinks: EntityLink[],
  portraits: Map<string, string>
): { entityFields: EntityField[]; entityLinks: EntityLink[] } {
  portraits.delete(id);
  return {
    entityFields: entityFields.filter((f) => f.entityId !== id),
    entityLinks: entityLinks.filter((l) => l.fromId !== id && l.toId !== id),
  };
}
