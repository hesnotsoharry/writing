import { describe, expect, it } from "vitest";

import type { Folder, Scene } from "../../shared/binderStore";
import { buildOutlineGroups, deriveStickyHeaderIndices, flattenOutline, OUTLINER_ROW_HEIGHT, outlinerDropIndex, summarizeOutline } from "./outlinerModel";

const folders: Folder[] = [
  { id: "c1", project_id: "p", title: "Chapter 1", sort_order: 1 },
  { id: "c2", project_id: "p", title: "Chapter 2", sort_order: 2 },
];
function scene(id: string, folderId: string | null, words: number, status: Scene["status"]): Scene {
  return { id, project_id: "p", folder_id: folderId, title: id, synopsis: null, sort_order: 1, word_count: words, status };
}

describe("outliner grouping", () => {
  it("groups chapters and short pieces with counts and word totals", () => {
    const scenes = [scene("a", "c1", 100, "draft"), scene("b", "c1", 200, "final"), scene("loose", null, 50, "blank")];
    const groups = buildOutlineGroups(folders, scenes);
    expect(groups.map(({ title, scenes: rows, wordTotal }) => [title, rows.length, wordTotal])).toEqual([
      ["Chapter 1", 2, 300], ["Chapter 2", 0, 0], ["Short pieces", 1, 50],
    ]);
    expect(summarizeOutline(scenes)).toEqual({
      sceneCount: 3, wordTotal: 350,
      status: { blank: 1, outline: 0, draft: 1, revise: 0, final: 1 },
    });
  });

  it("derives sticky indices from the live flattened order", () => {
    const groups = buildOutlineGroups(folders, [scene("a", "c1", 1, "draft"), scene("b", "c2", 1, "draft"), scene("loose", null, 1, "draft")]);
    expect(deriveStickyHeaderIndices(flattenOutline(groups))).toEqual([0, 2, 4]);
    groups[0].scenes.reverse();
    expect(deriveStickyHeaderIndices(flattenOutline(groups))).toEqual([0, 2, 4]);
  });

  it("maps drag distance to rendered row steps and clamps group bounds", () => {
    expect(outlinerDropIndex(1, OUTLINER_ROW_HEIGHT, 4)).toBe(2);
    expect(outlinerDropIndex(1, -OUTLINER_ROW_HEIGHT * 3, 4)).toBe(0);
    expect(outlinerDropIndex(1, OUTLINER_ROW_HEIGHT * 6, 4)).toBe(3);
  });
});
