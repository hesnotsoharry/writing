import { describe, expect, it } from "vitest";

import type { Folder, Scene } from "../../shared/binderStore";
import { computeReorder } from "../../shared/computeReorder";
import { applyOptimisticOrder, buildOutlineGroups, deriveStickyHeaderIndices, flattenOutline, OUTLINER_ROW_HEIGHT, outlinerDropIndex, outlinerPreviewOffsets, outlinerPreviewSlot, outlinerRowHeight, reorderGroupIds, reservesSceneDivider, showsSceneDivider, summarizeOutline } from "./outlinerModel";

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

  it("rescues orphan-folder scenes into short pieces alongside loose ones", () => {
    const scenes = [
      scene("foldered", "c1", 10, "draft"),
      scene("loose", null, 20, "blank"),
      scene("orphan", "gone", 30, "revise"),
    ];
    const groups = buildOutlineGroups(folders, scenes);
    expect(groups.map(({ title }) => title)).toEqual(["Chapter 1", "Chapter 2", "Short pieces"]);
    expect(groups[0].scenes.map(({ id }) => id)).toEqual(["foldered"]);
    expect(groups[1].scenes).toEqual([]);
    expect(groups[2].scenes.map(({ id }) => id)).toEqual(["loose", "orphan"]);
    expect(groups[2].wordTotal).toBe(50);
  });

  it("still omits the short-pieces group when every scene resolves to a folder", () => {
    const groups = buildOutlineGroups(folders, [scene("a", "c1", 1, "draft"), scene("b", "c2", 1, "draft")]);
    expect(groups.map(({ title }) => title)).toEqual(["Chapter 1", "Chapter 2"]);
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

describe("outliner drag preview", () => {
  it("mirrors the slot mapping computeReorder produces for the same move", () => {
    const ids = ["a", "b", "c", "d"];
    for (const [from, to] of [[0, 3], [3, 0], [1, 2], [2, 1], [2, 2]]) {
      const order = computeReorder(ids.map((id) => ({ id })), ids[from], to).map(({ id }) => id);
      ids.forEach((id, index) => { expect(outlinerPreviewSlot(index, from, to)).toBe(order.indexOf(id)); });
    }
  });

  it("slides passed rows by the dragged row's own height, whatever theirs is", () => {
    // Rows differ wildly (a wrapped synopsis and a wrapped label strip both
    // grow a row), so a fixed OUTLINER_ROW_HEIGHT step would misalign them.
    expect(outlinerPreviewOffsets([80, 300, 120], 0, 2)).toEqual([420, -80, -80]);
    expect(outlinerPreviewOffsets([80, 300, 120], 2, 0)).toEqual([120, 120, -380]);
  });

  it("moves only the rows between the origin and the drop", () => {
    expect(outlinerPreviewOffsets([100, 100, 100, 100], 1, 2)).toEqual([0, 100, -100, 0]);
    expect(outlinerPreviewOffsets([100, 100, 100, 100], 3, 1)).toEqual([0, 100, 100, -200]);
  });

  it("holds every row still when the drop index equals the origin or is out of range", () => {
    expect(outlinerPreviewOffsets([100, 100], 1, 1)).toEqual([0, 0]);
    expect(outlinerPreviewOffsets([100, 100], -1, 1)).toEqual([0, 0]);
    expect(outlinerPreviewOffsets([100, 100], 5, 1)).toEqual([0, 0]);
  });
});

describe("outliner optimistic order", () => {
  const base = () => buildOutlineGroups(folders, [
    scene("a", "c1", 10, "draft"), scene("b", "c1", 20, "draft"), scene("c", "c1", 30, "draft"),
    scene("loose", null, 5, "blank"),
  ]);

  it("reorders a group by exactly the ids the persisted move will produce", () => {
    const scenes = base()[0].scenes;
    const ids = reorderGroupIds(scenes, "a", 2);
    expect(ids).toEqual(computeReorder(scenes.map(({ id }) => ({ id })), "a", 2).map(({ id }) => id));
    expect(applyOptimisticOrder(base(), { c1: ids })[0].scenes.map(({ id }) => id)).toEqual(["b", "c", "a"]);
  });

  it("keeps the freshly loaded scene rows, overriding only their order", () => {
    const groups = base();
    groups[0].scenes[0] = { ...groups[0].scenes[0], word_count: 999 };
    const applied = applyOptimisticOrder(groups, { c1: ["c", "b", "a"] });
    expect(applied[0].scenes.map(({ id, word_count: words }) => [id, words])).toEqual([
      ["c", 30], ["b", 20], ["a", 999],
    ]);
  });

  it("keys the short-pieces group under its own name", () => {
    const applied = applyOptimisticOrder(base(), { short: ["loose"] });
    expect(applied[2].scenes.map(({ id }) => id)).toEqual(["loose"]);
  });

  it("ignores a remembered order once it stops describing the group", () => {
    const groups = base();
    // A scene was deleted, added, or moved to another chapter since the drop.
    expect(applyOptimisticOrder(groups, { c1: ["c", "b"] })[0].scenes.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(applyOptimisticOrder(groups, { c1: ["c", "b", "gone"] })[0].scenes.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(applyOptimisticOrder(groups, {})[0].scenes.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });
});

describe("scene dividers", () => {
  it("separates consecutive scenes inside a chapter", () => {
    expect([0, 1, 2].map((index) => showsSceneDivider(index, 4, false))).toEqual([true, true, true]);
  });

  it("stops at the last row of a chapter, so the divider never runs into the next header", () => {
    expect(showsSceneDivider(3, 4, false)).toBe(false);
    expect(showsSceneDivider(0, 1, false)).toBe(false);
    expect(showsSceneDivider(0, 0, false)).toBe(false);
  });

  it("drops the divider off a lifted row, so a dragged card carries no hairline", () => {
    expect(showsSceneDivider(0, 4, true)).toBe(false);
    expect(showsSceneDivider(3, 4, true)).toBe(false);
  });
});

describe("reserved divider space", () => {
  it("reserves the hairline box for every row a scene follows, lifted or not", () => {
    expect([0, 1, 2, 3].map((index) => reservesSceneDivider(index, 4))).toEqual([true, true, true, false]);
    expect(reservesSceneDivider(0, 1)).toBe(false);
    expect(reservesSceneDivider(0, 0)).toBe(false);
  });
});

describe("row height under column choices", () => {
  const all = { status: true, synopsis: true, words: true, labels: true };

  it("matches the full-row constant when every column shows", () => {
    expect(outlinerRowHeight(all)).toBe(OUTLINER_ROW_HEIGHT);
  });

  it("drops a band for each stacked field that is hidden", () => {
    expect(outlinerRowHeight({ ...all, labels: false })).toBe(104);
    expect(outlinerRowHeight({ ...all, synopsis: false })).toBe(104);
    expect(outlinerRowHeight({ ...all, synopsis: false, labels: false })).toBe(60);
  });

  it("charges nothing for the status dot or word count — they ride the title line", () => {
    expect(outlinerRowHeight({ ...all, status: false, words: false })).toBe(OUTLINER_ROW_HEIGHT);
  });

  it("steps the drop index by the shorter row once the synopsis is off", () => {
    const compact = outlinerRowHeight({ ...all, synopsis: false, labels: false });
    expect(outlinerDropIndex(0, compact, 4, compact)).toBe(1);
    expect(outlinerDropIndex(0, compact, 4, OUTLINER_ROW_HEIGHT)).toBe(0);
  });
});
