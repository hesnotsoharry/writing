import { describe, expect, it } from "vitest";

import type { Entity, SceneLink } from "../db/storyBibleStore";
import { createDetectionSync } from "../lib/detectionSync";

/**
 * Phase 4 acceptance test (orchestrator-authored — boundary contract).
 *
 * `createDetectionSync` coordinates detection → scene_links persistence. It
 * takes NARROW injected deps (not whole stores) so it stays decoupled:
 *   - loadProjection(sceneId): the saved plaintext for a scene (null if none)
 *   - listEntities(projectId): the project's characters + locations
 *   - replaceSceneLinks(sceneId, links): DELETE-then-INSERT the scene's links
 *   - listSceneIds(projectId): every scene id in the project (for rescan)
 *
 * Contract:
 *   - linkScene(sceneId, projectId): detect entities in the scene's projection,
 *     map each matched id back to its entity type, replace the scene's links.
 *     Null projection → no-op (leave links untouched). String projection
 *     (even "") → detect + replace (empty clears links).
 *   - rescanProject(projectId): linkScene for every scene in the project.
 *   - Writes to the SAME scene are serialized (no interleaving of the
 *     replaceSceneLinks for one sceneId) — guards the save-vs-rescan race.
 */

function makeEntity(
  id: string,
  name: string,
  type: "character" | "location" = "character"
): Entity {
  return { id, projectId: "p1", type, name, notes: null, aliases: null };
}

function sortLinks(links: SceneLink[]): SceneLink[] {
  return [...links].sort((a, b) => a.entityId.localeCompare(b.entityId));
}

describe("detection sync — linkScene", () => {
  it("detects entities in a scene's projection and replaces its links", async () => {
    const projections = new Map([["s1", "Sarah reached Thornfield at dusk."]]);
    const entities = [makeEntity("e1", "Sarah"), makeEntity("e2", "Thornfield", "location")];
    const links = new Map<string, SceneLink[]>();

    const sync = createDetectionSync({
      loadProjection: async (id) => projections.get(id) ?? null,
      listEntities: async () => entities,
      replaceSceneLinks: async (id, l) => void links.set(id, l),
      listSceneIds: async () => [...projections.keys()],
    });

    await sync.linkScene("s1", "p1");

    expect(sortLinks(links.get("s1")!)).toEqual([
      { entityType: "character", entityId: "e1" },
      { entityType: "location", entityId: "e2" },
    ]);
  });

  it("replaces (not merges) on re-link when the prose changes", async () => {
    const projections = new Map([["s1", "Sarah waited."]]);
    const entities = [makeEntity("e1", "Sarah"), makeEntity("e2", "Thornfield", "location")];
    const links = new Map<string, SceneLink[]>();
    const sync = createDetectionSync({
      loadProjection: async (id) => projections.get(id) ?? null,
      listEntities: async () => entities,
      replaceSceneLinks: async (id, l) => void links.set(id, l),
      listSceneIds: async () => [...projections.keys()],
    });

    await sync.linkScene("s1", "p1");
    expect(links.get("s1")).toEqual([{ entityType: "character", entityId: "e1" }]);

    projections.set("s1", "Thornfield stood empty.");
    await sync.linkScene("s1", "p1");
    expect(links.get("s1")).toEqual([{ entityType: "location", entityId: "e2" }]);
  });

  it("clears links when the projection has no entity mentions", async () => {
    const projections = new Map([["s1", "Nobody at all."]]);
    const links = new Map<string, SceneLink[]>([
      ["s1", [{ entityType: "character", entityId: "e1" }]],
    ]);
    const sync = createDetectionSync({
      loadProjection: async (id) => projections.get(id) ?? null,
      listEntities: async () => [makeEntity("e1", "Sarah")],
      replaceSceneLinks: async (id, l) => void links.set(id, l),
      listSceneIds: async () => [...projections.keys()],
    });

    await sync.linkScene("s1", "p1");
    expect(links.get("s1")).toEqual([]);
  });

  it("is a no-op for a scene with no projection (does not touch links)", async () => {
    const links = new Map<string, SceneLink[]>([
      ["s1", [{ entityType: "character", entityId: "e1" }]],
    ]);
    let replaceCalled = false;
    const sync = createDetectionSync({
      loadProjection: async () => null,
      listEntities: async () => [makeEntity("e1", "Sarah")],
      replaceSceneLinks: async (id, l) => {
        replaceCalled = true;
        links.set(id, l);
      },
      listSceneIds: async () => ["s1"],
    });

    await sync.linkScene("s1", "p1");
    expect(replaceCalled).toBe(false);
    expect(links.get("s1")).toEqual([{ entityType: "character", entityId: "e1" }]);
  });
});

describe("detection sync — rescanProject", () => {
  it("re-links every scene in the project", async () => {
    const projections = new Map([
      ["s1", "Sarah here."],
      ["s2", "Thornfield there."],
      ["s3", "Empty."],
    ]);
    const entities = [makeEntity("e1", "Sarah"), makeEntity("e2", "Thornfield", "location")];
    const links = new Map<string, SceneLink[]>();
    const sync = createDetectionSync({
      loadProjection: async (id) => projections.get(id) ?? null,
      listEntities: async () => entities,
      replaceSceneLinks: async (id, l) => void links.set(id, l),
      listSceneIds: async () => [...projections.keys()],
    });

    await sync.rescanProject("p1");

    expect(links.get("s1")).toEqual([{ entityType: "character", entityId: "e1" }]);
    expect(links.get("s2")).toEqual([{ entityType: "location", entityId: "e2" }]);
    expect(links.get("s3")).toEqual([]);
  });
});

describe("detection sync — per-scene write serialization", () => {
  it("never runs two replaceSceneLinks for the same scene concurrently", async () => {
    const projections = new Map([["s1", "Sarah here."]]);
    const entities = [makeEntity("e1", "Sarah")];
    let active = 0;
    let maxActive = 0;
    const sync = createDetectionSync({
      loadProjection: async (id) => projections.get(id) ?? null,
      listEntities: async () => entities,
      replaceSceneLinks: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        await Promise.resolve();
        active -= 1;
      },
      listSceneIds: async () => [...projections.keys()],
    });

    // Two concurrent link requests for the SAME scene must serialize.
    await Promise.all([sync.linkScene("s1", "p1"), sync.linkScene("s1", "p1")]);

    expect(maxActive).toBe(1);
  });
});
