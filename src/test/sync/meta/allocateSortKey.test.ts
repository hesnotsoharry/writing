import { describe, expect, it } from "vitest";

import { allocateSortKeys } from "../../../sync/meta/allocateSortKey";
import { keyBetween } from "../../../sync/meta/sortKey";

describe("allocateSortKeys", () => {
  it("rebalances when neighbors share a collided key instead of throwing", () => {
    const keys = allocateSortKeys(
      [{ id: "a", sortKey: "K" }, { id: "b", sortKey: "K" }],
      ["a", "x", "b"],
      "x",
    );
    expect([...keys.keys()].sort()).toEqual(["a", "b", "x"]);
    expect(new Set(keys.values()).size).toBe(3);
    const ordered = [...keys.entries()].sort((left, right) =>
      left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0
    ).map(([id]) => id);
    expect(ordered).toEqual(["a", "x", "b"]);
  });

  it("returns a unique key between neighbors when bounds are valid", () => {
    const lower = keyBetween(null, null);
    const upper = keyBetween(lower, null);
    const keys = allocateSortKeys(
      [{ id: "a", sortKey: lower }, { id: "c", sortKey: upper }],
      ["a", "b", "c"],
      "b",
    );
    expect(keys.size).toBe(1);
    const key = keys.get("b");
    expect(key && lower < key && key < upper).toBe(true);
  });
});
