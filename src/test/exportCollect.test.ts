import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { buildTree } from "../binder/buildTree";
import type { Folder, Scene } from "../db/binderStore";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { collectBlocks, sanitizeFilename } from "../features/export/exportCollect";
import { encodeDoc } from "../yjs/serialize";

/** Build a Y.Doc with text in a single XmlFragment paragraph (mirrors serialize.test.ts). */
function docWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return doc;
}

function makeScene(
  id: string,
  title: string,
  sortOrder: number,
  folderId: string | null = null
): Scene {
  return {
    id,
    project_id: "proj-1",
    folder_id: folderId,
    title,
    synopsis: null,
    sort_order: sortOrder,
    word_count: 0,
    status: "blank",
  };
}

function makeFolder(id: string, title: string, sortOrder: number): Folder {
  return { id, project_id: "proj-1", title, sort_order: sortOrder };
}

async function seedDoc(
  store: InMemorySceneDocStore,
  sceneId: string,
  text: string
): Promise<void> {
  const doc = docWithText(text);
  await store.save(sceneId, encodeDoc(doc), text);
}

describe("sanitizeFilename", () => {
  it("strips illegal characters and collapses whitespace", () => {
    expect(sanitizeFilename('My: Chapter / "One" <Two>|')).toBe("My Chapter One Two");
  });

  it("collapses whitespace", () => {
    expect(sanitizeFilename("  Act   One  ")).toBe("Act One");
  });

  it("falls back to Untitled when the result is empty", () => {
    expect(sanitizeFilename(":/\\*?<>|")).toBe("Untitled");
  });

  it("returns the name unchanged when it has no illegal chars", () => {
    expect(sanitizeFilename("Chapter 1")).toBe("Chapter 1");
  });
});

describe("collectBlocks — scene scope", () => {
  it("returns the scene text and sanitized title for a scene in a chapter", async () => {
    const store = new InMemorySceneDocStore();
    const scene = makeScene("s1", "Opening Scene", 1000, "f1");
    const folder = makeFolder("f1", "Act One", 1000);
    await seedDoc(store, "s1", "The beginning.");

    const tree = buildTree([folder], [scene]);
    const result = await collectBlocks("scene", "s1", tree, store);

    expect(result.suggestedTitle).toBe("Opening Scene");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toBe("The beginning.");
  });

  it("returns the scene text for a short piece (no folder)", async () => {
    const store = new InMemorySceneDocStore();
    const scene = makeScene("sp1", "Short Piece", 1000, null);
    await seedDoc(store, "sp1", "A standalone scene.");

    const tree = buildTree([], [scene]);
    const result = await collectBlocks("scene", "sp1", tree, store);

    expect(result.blocks[0]).toBe("A standalone scene.");
    expect(result.suggestedTitle).toBe("Short Piece");
  });

  it("returns empty blocks and Untitled for an unknown scene id", async () => {
    const store = new InMemorySceneDocStore();
    const tree = buildTree([], []);
    const result = await collectBlocks("scene", "nonexistent", tree, store);

    expect(result.blocks).toHaveLength(0);
    expect(result.suggestedTitle).toBe("Untitled");
  });

  it("returns empty string block for a scene with no stored doc", async () => {
    const store = new InMemorySceneDocStore();
    const scene = makeScene("s2", "Empty Scene", 1000, null);
    const tree = buildTree([], [scene]);
    const result = await collectBlocks("scene", "s2", tree, store);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toBe("");
  });
});

describe("collectBlocks — chapter scope", () => {
  it("returns scenes in sort_order with the folder title as suggestedTitle", async () => {
    const store = new InMemorySceneDocStore();
    const folder = makeFolder("f1", "Chapter 1", 1000);
    const s1 = makeScene("s1", "Scene A", 1000, "f1");
    const s2 = makeScene("s2", "Scene B", 2000, "f1");
    await seedDoc(store, "s1", "First text.");
    await seedDoc(store, "s2", "Second text.");

    const tree = buildTree([folder], [s2, s1]); // unsorted — buildTree sorts
    const result = await collectBlocks("chapter", "f1", tree, store);

    expect(result.suggestedTitle).toBe("Chapter 1");
    expect(result.blocks).toEqual(["First text.", "Second text."]);
  });

  it("returns Untitled and empty blocks for an unknown folder id", async () => {
    const store = new InMemorySceneDocStore();
    const tree = buildTree([], []);
    const result = await collectBlocks("chapter", "nope", tree, store);

    expect(result.suggestedTitle).toBe("Untitled");
    expect(result.blocks).toHaveLength(0);
  });
});

describe("collectBlocks — manuscript scope", () => {
  it("includes chapter headings, scenes in order, then short pieces", async () => {
    const store = new InMemorySceneDocStore();
    const f1 = makeFolder("f1", "Act One", 1000);
    const f2 = makeFolder("f2", "Act Two", 2000);
    const s1 = makeScene("s1", "S1", 1000, "f1");
    const s2 = makeScene("s2", "S2", 1000, "f2");
    const sp = makeScene("sp1", "Short Piece", 1000, null);
    await seedDoc(store, "s1", "Act one prose.");
    await seedDoc(store, "s2", "Act two prose.");
    await seedDoc(store, "sp1", "Short prose.");

    const tree = buildTree([f2, f1], [s1, s2, sp]);
    const result = await collectBlocks("manuscript", "proj-1", tree, store);

    expect(result.suggestedTitle).toBe("Manuscript");
    // blocks: [Act One heading, s1 text, Act Two heading, s2 text, short piece text]
    expect(result.blocks).toEqual([
      "Act One",
      "Act one prose.",
      "Act Two",
      "Act two prose.",
      "Short prose.",
    ]);
  });

  it("sanitizes folder title with illegal chars as heading block", async () => {
    const store = new InMemorySceneDocStore();
    const f1 = makeFolder("f1", 'Chapter: "One"', 1000);
    const s1 = makeScene("s1", "S1", 1000, "f1");
    await seedDoc(store, "s1", "Text.");

    const tree = buildTree([f1], [s1]);
    const result = await collectBlocks("manuscript", "proj-1", tree, store);

    // The heading block is the raw folder title — sanitizeFilename is for suggestedTitle, not headings
    expect(result.blocks[0]).toBe('Chapter: "One"');
  });
});
