import { describe, expect, it } from "vitest";

import { computeDragReorder } from "../features/outliner/OutlinerDrag";

describe("computeDragReorder — pure reorder helper", () => {
  it("moves an item down: id at index 0 over id at index 2 lands at index 2", () => {
    const result = computeDragReorder(["a", "b", "c"], "a", "c");
    expect(result.ids).toEqual(["b", "c", "a"]);
    expect(result.toIndex).toBe(2);
  });

  it("moves an item up: id at index 2 over id at index 0 lands at index 0", () => {
    const result = computeDragReorder(["a", "b", "c"], "c", "a");
    expect(result.ids).toEqual(["c", "a", "b"]);
    expect(result.toIndex).toBe(0);
  });

  it("no-op when activeId === overId: returns original list, toIndex is current position", () => {
    const result = computeDragReorder(["a", "b", "c"], "b", "b");
    expect(result.ids).toEqual(["a", "b", "c"]);
    expect(result.toIndex).toBe(1);
  });

  it("graceful when activeId not in list: returns original list, toIndex is 0", () => {
    const result = computeDragReorder(["a", "b", "c"], "z", "b");
    expect(result.ids).toEqual(["a", "b", "c"]);
    expect(result.toIndex).toBe(0);
  });

  it("graceful when overId not in list: returns original list, toIndex is activeId's position", () => {
    const result = computeDragReorder(["a", "b", "c"], "a", "z");
    expect(result.ids).toEqual(["a", "b", "c"]);
    expect(result.toIndex).toBe(0);
  });

  it("middle move: id at index 0 over id at index 1 lands at index 1", () => {
    const result = computeDragReorder(["a", "b", "c"], "a", "b");
    expect(result.ids).toEqual(["b", "a", "c"]);
    expect(result.toIndex).toBe(1);
  });

  it("works on a two-element list: swapping both items", () => {
    const result = computeDragReorder(["x", "y"], "x", "y");
    expect(result.ids).toEqual(["y", "x"]);
    expect(result.toIndex).toBe(1);
  });
});
