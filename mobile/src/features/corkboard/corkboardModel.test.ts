import { describe, expect, it } from "vitest";

import type { Folder, Scene } from "../../shared/binderStore";
import { computeReorder } from "../../shared/computeReorder";
import { buildCorkGroups, dragPreviewOffsets, dragTargetIndex, getCardLayout, previewSlotIndex, reorderPreview } from "./corkboardModel";

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

describe("corkboard drag preview", () => {
  it("mirrors the slot mapping computeReorder produces for the same move", () => {
    const ids = ["a", "b", "c", "d"];
    const slots = (from: number, to: number) => {
      const order = computeReorder(ids.map((id) => ({ id })), ids[from], to).map(({ id }) => id);
      return ids.map((id, index) => [previewSlotIndex(index, from, to), order.indexOf(id)]);
    };
    for (const [from, to] of [[0, 3], [3, 0], [1, 2], [2, 1], [0, 0]]) {
      for (const [predicted, actual] of slots(from, to)) expect(predicted).toBe(actual);
    }
  });

  it("opens a gap by sliding the passed cards back by their measured heights", () => {
    const offsets = dragPreviewOffsets({
      heights: [100, 200, 300], columns: 1, cardWidth: 354, gutter: 16, from: 0, to: 2,
    });
    // Card A drops below B and C, so it travels their two heights plus two gutters.
    expect(offsets[0]).toEqual({ dx: 0, dy: 200 + 16 + 300 + 16 });
    // B and C each rise by A's height plus one gutter — exact despite the three
    // cards all being different heights.
    expect(offsets[1]).toEqual({ dx: 0, dy: -(100 + 16) });
    expect(offsets[2]).toEqual({ dx: 0, dy: -(100 + 16) });
  });

  it("slides upward drags the other way and leaves untouched cards alone", () => {
    const offsets = dragPreviewOffsets({
      heights: [100, 100, 100, 100], columns: 1, cardWidth: 354, gutter: 10, from: 2, to: 1,
    });
    expect(offsets.map(({ dy }) => dy)).toEqual([0, 110, -110, 0]);
  });

  it("moves a two-column drag across both axes of the grid", () => {
    const offsets = dragPreviewOffsets({
      heights: [180, 180, 180, 180], columns: 2, cardWidth: 171, gutter: 12, from: 0, to: 3,
    });
    expect(offsets).toEqual([
      { dx: 183, dy: 192 }, { dx: -183, dy: 0 }, { dx: 183, dy: -192 }, { dx: -183, dy: 0 },
    ]);
  });

  it("sizes each wrap row by its tallest card rather than a nominal row height", () => {
    // Wrap line 0 holds a 160 and a 200; RN stretches the line, so the row is
    // 200 tall and the vertical travel must be 200 + gutter, not 160 or 180.
    const offsets = dragPreviewOffsets({
      heights: [160, 200, 180, 180], columns: 2, cardWidth: 171, gutter: 12, from: 0, to: 3,
    });
    expect(offsets.map(({ dy }) => dy)).toEqual([212, 0, -212, 0]);
  });

  it("holds every card still when the drop index equals the origin", () => {
    const offsets = dragPreviewOffsets({
      heights: [100, 100, 100], columns: 1, cardWidth: 354, gutter: 16, from: 1, to: 1,
    });
    expect(offsets).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
  });
});
