import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/storyBibleStore";

/**
 * Wave 9 Phase 1 acceptance test (orchestrator-authored — loadSceneEntities contract).
 *
 * Contract: loadSceneEntities(sceneId) returns the FULL Entity objects (including
 * notes) that are linked to the scene via scene_links, grouped into
 * { characters, locations }. Project entities NOT linked to the scene are excluded.
 * A scene with no links returns empty arrays for both groups.
 *
 * This is the consumer surface the inspector's entity cards consume — avatar initial
 * from `name`, role subtitle from the first line of `notes`. The SQLite implementation
 * mirrors this contract via a scene_links → entities join; its real-DB behavior is
 * verified by manual smoke at wave end (there is no DB harness in unit tests).
 */
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
    const { characters, locations } = await store.loadSceneEntities("s1");

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
    const { characters } = await store.loadSceneEntities("s1");
    expect(characters.map((c) => c.name)).not.toContain("Bob");
  });

  it("returns empty groups for a scene with no links", async () => {
    const store = await seed();
    const result = await store.loadSceneEntities("s-unlinked");
    expect(result.characters).toEqual([]);
    expect(result.locations).toEqual([]);
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

    const { characters } = await store.loadSceneEntities("s1");
    expect(characters.map((c) => c.name)).toEqual(["Anna", "Zoe"]);
  });
});
