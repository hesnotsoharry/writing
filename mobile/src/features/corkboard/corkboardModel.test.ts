import { describe, expect, it } from "vitest";

import type { Folder, Scene } from "../../shared/binderStore";
import { computeReorder } from "../../shared/computeReorder";
import { buildCorkGroups, dragTargetIndex, getCardLayout, reorderPreview } from "./corkboardModel";

function scene(id: string): Scene {
  return { id, project_id: "p", folder_id: "f", title: id, synopsis: null, sort_order: 0, word_count: 0, status: "blank" };
}

function inFolder(id: string, folderId: string | null): Scene {
  return { ...scene(id), folder_id: folderId };
}

const folders: Folder[] = [
  { id: "f1", project_id: "p", title: "Chapter 1", sort_order: 1 },
  { id: "f2", project_id: "p", title: "Chapter 2", sort_order: 2 },
];

describe("corkboard grouping", () => {
  it("rescues orphan-folder scenes into short pieces alongside loose ones", () => {
    const groups = buildCorkGroups(folders, [
      inFolder("foldered", "f1"), inFolder("loose", null), inFolder("orphan", "gone"),
    ]);
    expect(groups.map(({ title }) => title)).toEqual(["Chapter 1", "Chapter 2", "Short pieces"]);
    expect(groups[0].scenes.map(({ id }) => id)).toEqual(["foldered"]);
    expect(groups[1].scenes).toEqual([]);
    expect(groups[2].scenes.map(({ id }) => id)).toEqual(["loose", "orphan"]);
  });

  it("still omits the short-pieces group when every scene resolves to a folder", () => {
    const groups = buildCorkGroups(folders, [inFolder("a", "f1"), inFolder("b", "f2")]);
    expect(groups.map(({ id }) => id)).toEqual(["f1", "f2"]);
  });
});

describe("corkboard layout and reorder", () => {
  it("uses the designed 18px outer gutters and 12px two-column gutter", () => {
    expect(getCardLayout(390, 1)).toEqual({ columns: 1, contentWidth: 354, gutter: 16, cardWidth: 354 });
    expect(getCardLayout(390, 2)).toEqual({ columns: 2, contentWidth: 354, gutter: 12, cardWidth: 171 });
  });

  it("maps a drag target to the shared computeReorder result", () => {
    const scenes = [scene("a"), scene("b"), scene("c")];
    const target = dragTargetIndex({
      fromIndex: 2, translationX: 0, translationY: -300,
      count: 3, columns: 1, cardWidth: 354, rowHeight: 150, gutter: 16,
    });
    const preview = reorderPreview(scenes, "c", target).map(({ id }) => id);
    const shared = computeReorder(scenes.map(({ id }) => ({ id })), "c", target).map(({ id }) => id);
    expect(target).toBe(0);
    expect(preview).toEqual(shared);
  });
});
