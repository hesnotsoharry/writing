import { describe, expect, it } from "vitest";

import type { Scene } from "../../shared/binderStore";
import { computeReorder } from "../../shared/computeReorder";
import { dragTargetIndex, getCardLayout, reorderPreview } from "./corkboardModel";

function scene(id: string): Scene {
  return { id, project_id: "p", folder_id: "f", title: id, synopsis: null, sort_order: 0, word_count: 0, status: "blank" };
}

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
