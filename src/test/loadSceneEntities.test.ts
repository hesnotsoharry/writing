import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import type { SceneEntityGroup } from "../db/storyBibleStore";

/**
 * Wave 9 Phase 1 acceptance test (orchestrator-authored — loadSceneEntities contract).
 *
 * Contract: loadSceneEntities(sceneId) returns an ordered array of non-empty
 * SceneEntityGroup objects for all entity types linked to the scene via scene_links.
 * Groups appear in taxonomy order (character → location → item → faction → lore → theme),
 * with custom types alphabetically after built-ins. Within each group, entities are
 * name-sorted. Project entities NOT linked to the scene are excluded.
 * A scene with no links returns an empty array.
 *
 * The SQLite implementation mirrors this contract via a scene_links → entities join;
 * its real-DB behavior is verified by manual smoke at wave end (no DB harness in unit tests).
 */

function groupFor(groups: SceneEntityGroup[], type: string) {
  return groups.find((g) => g.type === type)?.entities ?? [];
}

describe("StoryBibleStore.loadSceneEntities", () => {
  async function seed(): Promise<InMemoryStoryBibleStore> {
    const store = new InMemoryStoryBibleStore();
    const sarah = await store.createCharacter(
      "p1",
      "Sarah",
      "Protagonist. A determined heir."
    );
    const thornfield = await store.createLocation(
      "p1",
      "Thornfield",
      "A crumbling manor."
    );
    // Exists in the project but is NOT linked to s1 — must be excluded.
    await store.createCharacter("p1", "Bob", "Antagonist.");
    await store.replaceSceneLinks("s1", [
      { entityType: "character", entityId: sarah.id },
      { entityType: "location", entityId: thornfield.id },
    ]);
    return store;
  }

  it("returns linked characters and locations as full Entity objects, grouped by type", async () => {
    const store = await seed();
    const groups = await store.loadSceneEntities("s1");
    const characters = groupFor(groups, "character");
    const locations = groupFor(groups, "location");

    expect(characters).toHaveLength(1);
    expect(locations).toHaveLength(1);

    const [sarah] = characters;
    expect(sarah.name).toBe("Sarah");
    expect(sarah.type).toBe("character");
    expect(sarah.notes).toBe("Protagonist. A determined heir.");

    const [thornfield] = locations;
    expect(thornfield.name).toBe("Thornfield");
    expect(thornfield.type).toBe("location");
    expect(thornfield.notes).toBe("A crumbling manor.");
  });

  it("excludes project entities that are not linked to the scene", async () => {
    const store = await seed();
    const groups = await store.loadSceneEntities("s1");
    const characters = groupFor(groups, "character");
    expect(characters.map((c) => c.name)).not.toContain("Bob");
  });

  it("returns an empty array for a scene with no links", async () => {
    const store = await seed();
    const result = await store.loadSceneEntities("s-unlinked");
    expect(result).toEqual([]);
  });

  it("returns each group in a deterministic name-sorted order", async () => {
    const store = new InMemoryStoryBibleStore();
    const zoe = await store.createCharacter("p1", "Zoe", null);
    const anna = await store.createCharacter("p1", "Anna", null);
    // Linked in non-alphabetical order — the result must still come back sorted.
    await store.replaceSceneLinks("s1", [
      { entityType: "character", entityId: zoe.id },
      { entityType: "character", entityId: anna.id },
    ]);

    const groups = await store.loadSceneEntities("s1");
    const characters = groupFor(groups, "character");
    expect(characters.map((c) => c.name)).toEqual(["Anna", "Zoe"]);
  });

  it("returns a dedicated group for generic entity types (item) when linked", async () => {
    const store = new InMemoryStoryBibleStore();
    const item = await store.createEntity("p1", "item", "Sword of Dawn", null);
    await store.replaceSceneLinks("s1", [{ entityType: "item", entityId: item.id }]);

    const groups = await store.loadSceneEntities("s1");
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("item");
    expect(groups[0].entities).toHaveLength(1);
    expect(groups[0].entities[0].name).toBe("Sword of Dawn");
  });

  it("orders multiple type groups by taxonomy: character before item before theme", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("p1", "Alice", null);
    const item = await store.createEntity("p1", "item", "Potion", null);
    const theme = await store.createEntity("p1", "theme", "Hope", null);
    // Links added in reverse taxonomy order to prove sorting is applied.
    await store.replaceSceneLinks("s1", [
      { entityType: "theme", entityId: theme.id },
      { entityType: "item", entityId: item.id },
      { entityType: "character", entityId: char.id },
    ]);

    const groups = await store.loadSceneEntities("s1");
    expect(groups.map((g) => g.type)).toEqual(["character", "item", "theme"]);
  });
});
