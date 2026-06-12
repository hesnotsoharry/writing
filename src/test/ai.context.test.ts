/**
 * ai.context.ts — unit tests for assembleBrainstormContext.
 *
 * Tests operate at the assembly/shape boundary: mock the store interface,
 * pass real cap constants, assert exact output values.
 * No mocking of the function under test.
 */
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { SceneEntityGroup, StoryBibleStore } from "../db/storyBibleStore";
import {
  assembleBrainstormContext,
  ENTITY_NOTES_CHARS,
  SCENE_EXCERPT_CHARS,
} from "../features/ai/ai.context";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockStore(groups: SceneEntityGroup[]): StoryBibleStore {
  return {
    loadSceneEntities: vi.fn().mockResolvedValue(groups),
  } as unknown as StoryBibleStore;
}

function makeGroup(type: string, name: string, notes: string | null): SceneEntityGroup {
  return {
    type,
    entities: [{ id: `${type}-1`, projectId: "proj", type, name, notes, aliases: null }],
  };
}

/** Build a Y.Doc whose "content" fragment contains a single paragraph of `text`. */
function makeDoc(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const para = new Y.XmlElement("paragraph");
  const xt = new Y.XmlText();
  xt.insert(0, text);
  para.insert(0, [xt]);
  frag.insert(0, [para]);
  return doc;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("assembleBrainstormContext", () => {
  it("preserves scene title verbatim", async () => {
    const store = makeMockStore([]);
    const result = await assembleBrainstormContext({
      sceneTitle: "The Battle of Khem",
      doc: null,
      sceneId: null,
      store,
    });
    expect(result.sceneTitle).toBe("The Battle of Khem");
  });

  it("returns empty excerpt when doc is null", async () => {
    const store = makeMockStore([]);
    const result = await assembleBrainstormContext({
      sceneTitle: "Test",
      doc: null,
      sceneId: null,
      store,
    });
    expect(result.sceneExcerpt).toBe("");
  });

  it("caps scene excerpt at SCENE_EXCERPT_CHARS characters", async () => {
    const doc = makeDoc("A".repeat(SCENE_EXCERPT_CHARS + 500));
    const store = makeMockStore([]);
    const result = await assembleBrainstormContext({
      sceneTitle: "T", doc, sceneId: null, store,
    });
    expect(result.sceneExcerpt.length).toBe(SCENE_EXCERPT_CHARS);
    expect(result.sceneExcerpt).toBe("A".repeat(SCENE_EXCERPT_CHARS));
  });

  it("maps entity groups to summaries with type, name, and keyFacts", async () => {
    const store = makeMockStore([makeGroup("character", "Elara", "A skilled mage.")]);
    const result = await assembleBrainstormContext({
      sceneTitle: "T", doc: null, sceneId: "scene-1", store,
    });
    expect(result.entitySummaries).toHaveLength(1);
    expect(result.entitySummaries[0]).toMatchObject({
      type: "character",
      name: "Elara",
      keyFacts: "A skilled mage.",
    });
  });

  it("caps entity notes at ENTITY_NOTES_CHARS characters", async () => {
    const longNotes = "B".repeat(ENTITY_NOTES_CHARS + 100);
    const store = makeMockStore([makeGroup("location", "Khem", longNotes)]);
    const result = await assembleBrainstormContext({
      sceneTitle: "T", doc: null, sceneId: "scene-1", store,
    });
    expect(result.entitySummaries[0].keyFacts).toBe("B".repeat(ENTITY_NOTES_CHARS));
  });

  it("returns empty entitySummaries when sceneId is null without calling store", async () => {
    const store = makeMockStore([makeGroup("character", "X", "Y")]);
    const result = await assembleBrainstormContext({
      sceneTitle: "T", doc: null, sceneId: null, store,
    });
    expect(result.entitySummaries).toHaveLength(0);
    expect(store.loadSceneEntities).not.toHaveBeenCalled();
  });

  it("returns empty entitySummaries and does not throw when store rejects", async () => {
    const store = {
      loadSceneEntities: vi.fn().mockRejectedValue(new Error("DB error")),
    } as unknown as StoryBibleStore;
    const result = await assembleBrainstormContext({
      sceneTitle: "T", doc: null, sceneId: "scene-1", store,
    });
    expect(result.entitySummaries).toHaveLength(0);
  });

  it("flattens multiple entity groups into a single summary array", async () => {
    const store = makeMockStore([
      makeGroup("character", "Elara", "A mage."),
      makeGroup("location", "Khem", "A city."),
    ]);
    const result = await assembleBrainstormContext({
      sceneTitle: "T", doc: null, sceneId: "scene-1", store,
    });
    expect(result.entitySummaries).toHaveLength(2);
    expect(result.entitySummaries[0].name).toBe("Elara");
    expect(result.entitySummaries[1].name).toBe("Khem");
  });

  it("returns excerpt from doc text when doc is provided", async () => {
    const doc = makeDoc("Hello world");
    const store = makeMockStore([]);
    const result = await assembleBrainstormContext({
      sceneTitle: "T", doc, sceneId: null, store,
    });
    expect(result.sceneExcerpt).toBe("Hello world");
  });
});
