import { describe, expect, it } from "vitest";

import {
  buildBinderRows,
  buildBinderTree,
  CHAPTER_EMPTY_LABEL,
  type RawFolderRow,
  type RawSceneRow,
  SHORT_PIECES_EMPTY_LABEL,
  SHORT_PIECES_TITLE,
} from "./binderTree";

function folder(id: string, sortOrder = 1000): RawFolderRow {
  return { id, title: `Chapter ${id}`, sort_order: sortOrder };
}

function scene(id: string, folderId: string | null, sortOrder = 1000): RawSceneRow {
  return {
    id,
    folder_id: folderId,
    title: `Scene ${id}`,
    synopsis: null,
    sort_order: sortOrder,
    word_count: 12,
    status: "blank",
  };
}

/** Row shorthand for readable assertions: "header:Title", "scene:id", "add:folderId". */
function summarize(rows: ReturnType<typeof buildBinderRows>): string[] {
  return rows.map((row) => {
    if (row.kind === "header") return `header:${row.title}`;
    if (row.kind === "add") return `add:${row.folderId ?? "short"}`;
    return `scene:${row.scene.id}`;
  });
}

describe("buildBinderTree", () => {
  it("puts folder_id NULL scenes in the short-pieces bucket", () => {
    const tree = buildBinderTree([folder("f1")], [scene("s1", "f1"), scene("loose", null)]);
    expect(tree.chapters).toHaveLength(1);
    expect(tree.chapters[0].scenes.map(({ id }) => id)).toEqual(["s1"]);
    expect(tree.shortPieces.map(({ id }) => id)).toEqual(["loose"]);
  });

  it("keeps mixed loose and foldered scenes reachable, in row order", () => {
    const tree = buildBinderTree(
      [folder("f1", 1000), folder("f2", 2000)],
      [scene("a", "f1"), scene("loose-1", null), scene("b", "f2"), scene("loose-2", null)],
    );
    expect(tree.chapters.map(({ id }) => id)).toEqual(["f1", "f2"]);
    expect(tree.chapters[0].scenes.map(({ id }) => id)).toEqual(["a"]);
    expect(tree.chapters[1].scenes.map(({ id }) => id)).toEqual(["b"]);
    expect(tree.shortPieces.map(({ id }) => id)).toEqual(["loose-1", "loose-2"]);
  });

  it("rescues scenes whose folder_id points at a folder this project lacks", () => {
    const tree = buildBinderTree([folder("f1")], [scene("orphan", "gone")]);
    expect(tree.chapters[0].scenes).toEqual([]);
    expect(tree.shortPieces.map(({ id }) => id)).toEqual(["orphan"]);
  });

  it("normalizes legacy status strings", () => {
    const tree = buildBinderTree([], [{ ...scene("s", null), status: "done" }]);
    expect(tree.shortPieces[0].status).toBe("final");
  });
});

describe("buildBinderRows", () => {
  it("offers an add-scene affordance for a chapter that has no scenes", () => {
    const rows = buildBinderRows(buildBinderTree([folder("f1")], []));
    expect(summarize(rows)).toEqual([
      "header:Chapter f1",
      "add:f1",
      `header:${SHORT_PIECES_TITLE}`,
      "add:short",
    ]);
    expect(rows.find((row) => row.kind === "add" && row.folderId === "f1")).toMatchObject({
      label: CHAPTER_EMPTY_LABEL,
    });
  });

  it("offers an add-scene affordance with no folders and no scenes", () => {
    const rows = buildBinderRows(buildBinderTree([], []));
    expect(summarize(rows)).toEqual([`header:${SHORT_PIECES_TITLE}`, "add:short"]);
    expect(rows[1]).toMatchObject({ folderId: null, label: SHORT_PIECES_EMPTY_LABEL });
  });

  it("renders loose scenes under their own Short pieces header", () => {
    const rows = buildBinderRows(buildBinderTree([], [scene("loose", null)]));
    expect(summarize(rows)).toEqual([`header:${SHORT_PIECES_TITLE}`, "scene:loose"]);
  });

  it("renders mixed loose and foldered scenes, chapters first", () => {
    const rows = buildBinderRows(buildBinderTree(
      [folder("f1", 1000), folder("f2", 2000)],
      [scene("a", "f1"), scene("loose", null)],
    ));
    expect(summarize(rows)).toEqual([
      "header:Chapter f1",
      "scene:a",
      "header:Chapter f2",
      "add:f2",
      `header:${SHORT_PIECES_TITLE}`,
      "scene:loose",
    ]);
  });

  it("gives every row a unique key for the FlatList", () => {
    const rows = buildBinderRows(buildBinderTree(
      [folder("f1"), folder("f2")],
      [scene("a", "f1")],
    ));
    expect(new Set(rows.map(({ id }) => id)).size).toBe(rows.length);
  });
});
