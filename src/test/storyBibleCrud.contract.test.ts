// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 3, Phase 1 — Story Bible schema + store seam).
// Locks the StoryBibleStore contract: CRUD for characters/locations, scene links replace semantics.
// Runs against InMemoryStoryBibleStore only — per the existing pattern (no SQLite in unit tests).
import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";

describe("StoryBibleStore contract", () => {
  it("createCharacter returns a Character with the given project/name/notes", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Arya", "Stark girl");

    expect(char.projectId).toBe("proj-1");
    expect(char.name).toBe("Arya");
    expect(char.notes).toBe("Stark girl");
    expect(char.aliases).toBeNull();
    expect(typeof char.id).toBe("string");
    expect(char.id.length).toBeGreaterThan(0);
  });

  it("listCharacters returns only characters for the requested project", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("proj-1", "Arya", null);
    await store.createCharacter("proj-1", "Jon", null);
    await store.createCharacter("proj-2", "Other", null);

    const chars = await store.listCharacters("proj-1");

    expect(chars).toHaveLength(2);
    expect(chars.map((c) => c.name).sort()).toEqual(["Arya", "Jon"]);
  });

  it("createLocation returns a Location with the given project/name/notes", async () => {
    const store = new InMemoryStoryBibleStore();
    const loc = await store.createLocation("proj-1", "Winterfell", "Cold place");

    expect(loc.projectId).toBe("proj-1");
    expect(loc.name).toBe("Winterfell");
    expect(loc.notes).toBe("Cold place");
    expect(loc.aliases).toBeNull();
    expect(typeof loc.id).toBe("string");
  });

  it("listLocations returns only locations for the requested project", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createLocation("proj-1", "Winterfell", null);
    await store.createLocation("proj-2", "Dragonstone", null);

    const locs = await store.listLocations("proj-1");

    expect(locs).toHaveLength(1);
    expect(locs[0].name).toBe("Winterfell");
  });

  it("renameEntity updates the name of a character", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "OldName", null);

    await store.renameEntity("character", char.id, "NewName");

    const chars = await store.listCharacters("proj-1");
    expect(chars.find((c) => c.id === char.id)?.name).toBe("NewName");
  });

  it("renameEntity updates the name of a location", async () => {
    const store = new InMemoryStoryBibleStore();
    const loc = await store.createLocation("proj-1", "OldPlace", null);

    await store.renameEntity("location", loc.id, "NewPlace");

    const locs = await store.listLocations("proj-1");
    expect(locs.find((l) => l.id === loc.id)?.name).toBe("NewPlace");
  });

  it("updateEntityNotes persists new notes for a character", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Arya", null);

    await store.updateEntityNotes("character", char.id, "Faceless");

    const chars = await store.listCharacters("proj-1");
    expect(chars.find((c) => c.id === char.id)?.notes).toBe("Faceless");
  });

  it("updateEntityNotes persists new notes for a location", async () => {
    const store = new InMemoryStoryBibleStore();
    const loc = await store.createLocation("proj-1", "Castle", null);

    await store.updateEntityNotes("location", loc.id, "Big walls");

    const locs = await store.listLocations("proj-1");
    expect(locs.find((l) => l.id === loc.id)?.notes).toBe("Big walls");
  });

  it("deleteEntity removes a character and clears its scene_links", async () => {
    const store = new InMemoryStoryBibleStore();
    const keep = await store.createCharacter("proj-1", "Keep", null);
    const doomed = await store.createCharacter("proj-1", "Doomed", null);

    await store.replaceSceneLinks("scene-1", [
      { entityType: "character", entityId: doomed.id },
      { entityType: "character", entityId: keep.id },
    ]);

    await store.deleteEntity("character", doomed.id);

    const chars = await store.listCharacters("proj-1");
    expect(chars.find((c) => c.id === doomed.id)).toBeUndefined();
    expect(chars.find((c) => c.id === keep.id)).toBeDefined();

    const links = await store.loadSceneLinks("scene-1");
    expect(links.find((l) => l.entityId === doomed.id)).toBeUndefined();
    expect(links.find((l) => l.entityId === keep.id)).toBeDefined();
  });

  it("deleteEntity removes a location and clears its scene_links", async () => {
    const store = new InMemoryStoryBibleStore();
    const loc = await store.createLocation("proj-1", "Doomed Place", null);

    await store.replaceSceneLinks("scene-1", [
      { entityType: "location", entityId: loc.id },
    ]);

    await store.deleteEntity("location", loc.id);

    const locs = await store.listLocations("proj-1");
    expect(locs.find((l) => l.id === loc.id)).toBeUndefined();

    const links = await store.loadSceneLinks("scene-1");
    expect(links).toHaveLength(0);
  });

  it("replaceSceneLinks replaces — not merges — on second call", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Arya", null);
    const loc = await store.createLocation("proj-1", "Winterfell", null);

    await store.replaceSceneLinks("scene-1", [
      { entityType: "character", entityId: char.id },
    ]);
    // Second call must wipe the first set and install only the new set.
    await store.replaceSceneLinks("scene-1", [
      { entityType: "location", entityId: loc.id },
    ]);

    const links = await store.loadSceneLinks("scene-1");
    expect(links).toHaveLength(1);
    expect(links[0].entityType).toBe("location");
    expect(links[0].entityId).toBe(loc.id);
  });

  it("loadSceneLinks round-trips all link fields", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Jon", null);
    const loc = await store.createLocation("proj-1", "Castle Black", null);

    await store.replaceSceneLinks("scene-42", [
      { entityType: "character", entityId: char.id },
      { entityType: "location", entityId: loc.id },
    ]);

    const links = await store.loadSceneLinks("scene-42");
    expect(links).toHaveLength(2);
    expect(links).toContainEqual({ entityType: "character", entityId: char.id });
    expect(links).toContainEqual({ entityType: "location", entityId: loc.id });
  });

  it("findScenesForEntity returns only scenes that reference the entity", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Jon", null);
    const other = await store.createCharacter("proj-1", "Sam", null);

    await store.replaceSceneLinks("scene-A", [
      { entityType: "character", entityId: char.id },
    ]);
    await store.replaceSceneLinks("scene-B", [
      { entityType: "character", entityId: char.id },
    ]);
    await store.replaceSceneLinks("scene-C", [
      { entityType: "character", entityId: other.id },
    ]);

    const sceneIds = await store.findScenesForEntity(char.id);

    expect(sceneIds.sort()).toEqual(["scene-A", "scene-B"]);
  });

  it("replaceSceneLinks with empty array clears all links for a scene", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Arya", null);

    await store.replaceSceneLinks("scene-1", [
      { entityType: "character", entityId: char.id },
    ]);
    await store.replaceSceneLinks("scene-1", []);

    const links = await store.loadSceneLinks("scene-1");
    expect(links).toHaveLength(0);
  });

  it("listEntities returns characters and locations merged with correct type discriminators", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Arya", "Faceless");
    const loc = await store.createLocation("proj-1", "Winterfell", "Cold");

    const entities = await store.listEntities("proj-1");

    expect(entities).toHaveLength(2);
    expect(entities.find((e) => e.id === char.id)).toEqual({
      id: char.id,
      projectId: "proj-1",
      type: "character",
      name: "Arya",
      notes: "Faceless",
      aliases: null,
    });
    expect(entities.find((e) => e.id === loc.id)).toEqual({
      id: loc.id,
      projectId: "proj-1",
      type: "location",
      name: "Winterfell",
      notes: "Cold",
      aliases: null,
    });
  });

  it("deleteEntity filters scene_links by both entity_type and entity_id", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Arya", null);
    const loc = await store.createLocation("proj-1", "Winterfell", null);

    await store.replaceSceneLinks("scene-1", [
      { entityType: "character", entityId: char.id },
      { entityType: "location", entityId: loc.id },
    ]);

    await store.deleteEntity("character", char.id);

    const links = await store.loadSceneLinks("scene-1");
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      entityType: "location",
      entityId: loc.id,
    });
  });
});

describe("Custom entity type CRUD", () => {
  it("createEntity + listEntitiesByType returns only entities of same type in same project", async () => {
    const store = new InMemoryStoryBibleStore();
    const item1 = await store.createEntity("proj-1", "item", "Sword", "Sharp");
    const item2 = await store.createEntity("proj-1", "item", "Shield", "Defense");
    await store.createEntity("proj-1", "faction", "Wildfire", "Fire-based");

    const items = await store.listEntitiesByType("proj-1", "item");

    expect(items).toHaveLength(2);
    expect(items.map((e) => e.id).sort()).toEqual([item1.id, item2.id].sort());
    expect(items.every((e) => e.type === "item")).toBe(true);
  });

  it("listEntitiesByType is project-scoped", async () => {
    const store = new InMemoryStoryBibleStore();
    const item1 = await store.createEntity("proj-1", "item", "Sword", null);
    const item2 = await store.createEntity("proj-2", "item", "Shield", null);

    const proj1Items = await store.listEntitiesByType("proj-1", "item");
    const proj2Items = await store.listEntitiesByType("proj-2", "item");

    expect(proj1Items).toHaveLength(1);
    expect(proj1Items[0].id).toBe(item1.id);
    expect(proj2Items).toHaveLength(1);
    expect(proj2Items[0].id).toBe(item2.id);
  });

  it("listEntitiesByType returns empty array if no entities of that type", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createEntity("proj-1", "item", "Sword", null);

    const factions = await store.listEntitiesByType("proj-1", "faction");

    expect(factions).toHaveLength(0);
  });

  it("createCustomType + listCustomTypes returns custom types for project", async () => {
    const store = new InMemoryStoryBibleStore();
    const type1 = await store.createCustomType({
      projectId: "proj-1",
      name: "Artifact",
      icon: "crown",
      color: "gold",
    });
    const type2 = await store.createCustomType({
      projectId: "proj-1",
      name: "Monument",
      icon: "column",
      color: "gray",
    });

    const types = await store.listCustomTypes("proj-1");

    expect(types).toHaveLength(2);
    expect(types.map((t) => t.id).sort()).toEqual([type1.id, type2.id].sort());
  });

  it("listCustomTypes is project-scoped", async () => {
    const store = new InMemoryStoryBibleStore();
    const type1 = await store.createCustomType({
      projectId: "proj-1",
      name: "Artifact",
      icon: "crown",
      color: "gold",
    });
    const type2 = await store.createCustomType({
      projectId: "proj-2",
      name: "Monument",
      icon: "column",
      color: "gray",
    });

    const proj1Types = await store.listCustomTypes("proj-1");
    const proj2Types = await store.listCustomTypes("proj-2");

    expect(proj1Types).toHaveLength(1);
    expect(proj1Types[0].id).toBe(type1.id);
    expect(proj2Types).toHaveLength(1);
    expect(proj2Types[0].id).toBe(type2.id);
  });

  it("deleteCustomType removes only the specified type", async () => {
    const store = new InMemoryStoryBibleStore();
    const type1 = await store.createCustomType({
      projectId: "proj-1",
      name: "Artifact",
      icon: "crown",
      color: "gold",
    });
    const type2 = await store.createCustomType({
      projectId: "proj-1",
      name: "Monument",
      icon: "column",
      color: "gray",
    });

    await store.deleteCustomType(type1.id);

    const types = await store.listCustomTypes("proj-1");
    expect(types).toHaveLength(1);
    expect(types[0].id).toBe(type2.id);
  });

  it("createCustomType stores fieldsJson and sectionsJson as empty arrays by default", async () => {
    const store = new InMemoryStoryBibleStore();
    const type = await store.createCustomType({
      projectId: "proj-1",
      name: "Artifact",
      icon: "crown",
      color: "gold",
    });

    expect(type.fieldsJson).toBe("[]");
    expect(type.sectionsJson).toBe("[]");
  });
});
