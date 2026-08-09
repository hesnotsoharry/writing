import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { assembleContext, SCENE_EXCERPT_CHARS } from "../../shared/aiContext";
import type { StoryBibleStore } from "../../shared/storyBibleStore";
import { measureContext } from "./aiLogic";

function markedDoc(): Y.Doc {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  const text = new Y.XmlText();
  text.insert(0, "visible ");
  text.insert(8, "private passage", { aiExclude: true });
  text.insert(23, " ending");
  paragraph.insert(0, [text]);
  doc.getXmlFragment("content").insert(0, [paragraph]);
  return doc;
}

function store(): StoryBibleStore {
  return {
    getSceneExcludedFromAi: async (id: string) => id === "excluded",
    getSceneText: async (id: string) => id === "extra"
      ? { title: "Extra", text: "extra scene text" }
      : id === "excluded" ? { title: "Excluded", text: "secret" } : null,
    loadSceneEntities: async () => [{ type: "character", entities: [
      { id: "a", projectId: "p", type: "character", name: "Included", notes: "facts", aliases: null, exclude_from_ai: false },
      { id: "b", projectId: "p", type: "character", name: "Off", notes: "facts", aliases: null, exclude_from_ai: false },
      { id: "c", projectId: "p", type: "character", name: "Never", notes: "facts", aliases: null, exclude_from_ai: true },
    ] }],
    getManuscriptAbout: async () => ({ synopsis: "synopsis", genre: "", tone: "", pov: "", notes: "" }),
  } as unknown as StoryBibleStore;
}

describe("mobile context parity", () => {
  it("meters exactly the excerpt assembleContext sends and excludes hidden raw text", async () => {
    const context = await assembleContext({ verb: "brainstorm", cfg: {
      extraSceneIds: [], offEntityNames: [], about: false, boundary: null,
    }, sceneTitle: "Scene", sceneId: "scene", doc: markedDoc(), store: store(), projectId: "p" });
    const metrics = measureContext(context, "claude-haiku-4-5-20251001");
    expect(context.sceneExcerpt).not.toContain("private passage");
    expect(metrics.sentCharacters).toBe(context.sceneExcerpt.length);
    expect(metrics.characterCap).toBe(SCENE_EXCERPT_CHARS);
  });

  it("applies per-scene and per-entity exclusions through assembleContext", async () => {
    const context = await assembleContext({ verb: "brainstorm", cfg: {
      extraSceneIds: ["extra", "excluded"], offEntityNames: ["Off"], about: true, boundary: "chapter-2",
    }, sceneTitle: "Scene", sceneId: "scene", doc: markedDoc(), store: store(), projectId: "p" });
    expect(context.extraScenes).toEqual([
      { title: "Extra", excerpt: "extra scene text" },
      { title: "Excluded", excerpt: "[this scene was withheld by the author]" },
    ]);
    expect(context.entitySummaries.map((entity) => entity.name)).toEqual(["Included"]);
    expect(context.about?.synopsis).toBe("synopsis");
    expect(context.boundaryLine).toContain("chapter-2");
  });
});
