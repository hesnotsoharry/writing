// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { BinderTree } from "../binder/buildTree";
import { buildLeafContent } from "../editor/usePageFlip";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A minimal BinderTree with one chapter containing two scenes, plus one short piece. */
const tree: BinderTree = {
  chapters: [
    {
      folder: { id: "ch1", project_id: "p1", title: "Part One", sort_order: 0 },
      scenes: [
        {
          id: "s1",
          project_id: "p1",
          folder_id: "ch1",
          title: "The Beginning",
          synopsis: null,
          sort_order: 0,
          word_count: 412,
          status: "draft",
        },
        {
          id: "s2",
          project_id: "p1",
          folder_id: "ch1",
          title: "The Middle",
          synopsis: null,
          sort_order: 1,
          word_count: 1024,
          status: "revise",
        },
      ],
    },
  ],
  shortPieces: [
    {
      id: "sp1",
      project_id: "p1",
      folder_id: null,
      title: "An Aside",
      synopsis: null,
      sort_order: 0,
      word_count: 88,
      status: "blank",
    },
  ],
};

// ---------------------------------------------------------------------------
// buildLeafContent
// ---------------------------------------------------------------------------

describe("buildLeafContent", () => {
  it("returns correct chapterTitle, title, status, words for a scene inside a chapter", () => {
    const result = buildLeafContent(tree, "s1", "");
    expect(result).not.toBeNull();
    expect(result!.chapterTitle).toBe("Part One");
    expect(result!.title).toBe("The Beginning");
    expect(result!.status).toBe("draft");
    expect(result!.words).toBe(412);
  });

  it("returns the second scene in the same chapter correctly", () => {
    const result = buildLeafContent(tree, "s2", "");
    expect(result).not.toBeNull();
    expect(result!.chapterTitle).toBe("Part One");
    expect(result!.title).toBe("The Middle");
    expect(result!.status).toBe("revise");
    expect(result!.words).toBe(1024);
  });

  it("returns chapterTitle '' for a short piece (no containing chapter)", () => {
    const result = buildLeafContent(tree, "sp1", "");
    expect(result).not.toBeNull();
    expect(result!.chapterTitle).toBe("");
    expect(result!.title).toBe("An Aside");
    expect(result!.status).toBe("blank");
    expect(result!.words).toBe(88);
  });

  it("returns null when the scene id is not found (e.g. deleted)", () => {
    const result = buildLeafContent(tree, "nonexistent-id", "");
    expect(result).toBeNull();
  });

  it("normalizes legacy 'done' status to 'final'", () => {
    const treeWithLegacy: BinderTree = {
      chapters: [],
      shortPieces: [
        {
          id: "legacy1",
          project_id: "p1",
          folder_id: null,
          title: "Legacy Scene",
          synopsis: null,
          sort_order: 0,
          word_count: 300,
          // Cast needed: the DB is free-text TEXT so raw values can be "done"
          status: "done" as never,
        },
      ],
    };
    const result = buildLeafContent(treeWithLegacy, "legacy1", "");
    expect(result).not.toBeNull();
    expect(result!.status).toBe("final");
  });

  it("carries proseHTML through to the returned LeafContent", () => {
    const html = "<p>Hello world</p>";
    const result = buildLeafContent(tree, "s1", html);
    expect(result).not.toBeNull();
    expect(result!.proseHTML).toBe(html);
  });

  it("accepts empty proseHTML without error (header-only floor)", () => {
    const result = buildLeafContent(tree, "s1", "");
    expect(result).not.toBeNull();
    expect(result!.proseHTML).toBe("");
  });
});
