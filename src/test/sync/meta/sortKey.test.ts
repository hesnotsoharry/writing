import { describe, expect, it } from "vitest";

import { initialKeysFor, keyBetween } from "../../../sync/meta/sortKey";

describe("fractional sort keys", () => {
  it("creates a key with no bounds", () => {
    const key = keyBetween(null, null);
    expect(key > "").toBe(true);
  });

  it("prepends and appends", () => {
    const center = keyBetween(null, null);
    expect(keyBetween(null, center) < center).toBe(true);
    expect(keyBetween(center, null) > center).toBe(true);
  });

  it("keeps room through 50 dense insertions", () => {
    const lower = keyBetween(null, null);
    let upper = keyBetween(lower, null);
    for (let index = 0; index < 50; index++) {
      const middle = keyBetween(lower, upper);
      expect(lower < middle && middle < upper).toBe(true);
      upper = middle;
    }
  });

  it("produces stable ordered bootstrap keys", () => {
    expect(initialKeysFor(8)).toEqual(initialKeysFor(8));
    expect([...initialKeysFor(100)].sort()).toEqual(initialKeysFor(100));
    expect(new Set(initialKeysFor(100)).size).toBe(100);
  });
});
