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
