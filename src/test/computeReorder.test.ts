import { describe, expect, it } from "vitest";

import { computeReorder } from "../binder/computeReorder";

const ids = (updates: { id: string }[]) => updates.map((u) => u.id);
const orders = (updates: { sort_order: number }[]) =>
  updates.map((u) => u.sort_order);

describe("computeReorder — gap-based integer sort_order helper", () => {
  it("assigns gap-spaced sort_orders starting at 1000", () => {
    const result = computeReorder(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      "a",
      0
    );
    expect(orders(result)).toEqual([1000, 2000, 3000]);
  });

  it("moves an item to the front of its container", () => {
    const result = computeReorder(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      "c",
      0
    );
    expect(ids(result)).toEqual(["c", "a", "b"]);
  });

  it("moves an item to the back of its container", () => {
    const result = computeReorder(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      "a",
      2
    );
    expect(ids(result)).toEqual(["b", "c", "a"]);
  });

  it("moves an item to the middle of its container", () => {
    const result = computeReorder(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      "a",
      1
    );
    expect(ids(result)).toEqual(["b", "a", "c"]);
  });

  it("inserts a new item (not yet in the list) at a given index", () => {
    const result = computeReorder(
      [{ id: "a" }, { id: "b" }],
      "newId",
      1
    );
    expect(ids(result)).toEqual(["a", "newId", "b"]);
  });

  it("clamps toIndex below 0 to 0", () => {
    const result = computeReorder(
      [{ id: "a" }, { id: "b" }],
      "c",
      -5
    );
    expect(ids(result)).toEqual(["c", "a", "b"]);
  });

  it("clamps toIndex beyond length to the end", () => {
    const result = computeReorder(
      [{ id: "a" }, { id: "b" }],
      "c",
      99
    );
    expect(ids(result)).toEqual(["a", "b", "c"]);
  });

  it("handles a single existing item moving to position 0", () => {
    const result = computeReorder([{ id: "a" }], "a", 0);
    expect(ids(result)).toEqual(["a"]);
    expect(orders(result)).toEqual([1000]);
  });

  it("handles inserting into an empty container", () => {
    const result = computeReorder([], "x", 0);
    expect(ids(result)).toEqual(["x"]);
    expect(orders(result)).toEqual([1000]);
  });

  it("renormalizes so no gaps are ever exhausted (deterministic spacing)", () => {
    // Even after many moves the output is always 1000*n, never 0 or negative.
    const base = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const result = computeReorder(base, "d", 0);
    expect(result.every((u) => u.sort_order >= 1000)).toBe(true);
    expect(result.every((u) => u.sort_order % 1000 === 0)).toBe(true);
  });
});
