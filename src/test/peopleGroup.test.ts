/**
 * Unit tests for pickerCandidates — the pure helper in PeopleGroup.tsx.
 * Contracts: excludes self, excludes already-linked ids, preserves order,
 * returns empty when all are excluded, and handles empty inputs cleanly.
 */

import { describe, expect, it } from "vitest";

import { pickerCandidates } from "../storybible/fullEntry/PeopleGroup";

const ALL = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
  { id: "c", name: "Carol" },
  { id: "d", name: "Dave" },
];

describe("pickerCandidates", () => {
  it("excludes self from the candidate list", () => {
    const result = pickerCandidates(ALL, "a", []);
    expect(result.map((c) => c.id)).not.toContain("a");
    expect(result).toHaveLength(3);
  });

  it("excludes already-linked ids", () => {
    const result = pickerCandidates(ALL, "a", ["b", "c"]);
    expect(result.map((c) => c.id)).toEqual(["d"]);
  });

  it("keeps unlinked characters that are not self", () => {
    const result = pickerCandidates(ALL, "a", ["b"]);
    expect(result.map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("preserves insertion order of the input array", () => {
    const result = pickerCandidates(ALL, "z-unknown", []);
    expect(result.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns empty array when self is the only character", () => {
    const result = pickerCandidates([{ id: "a", name: "Alice" }], "a", []);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when all non-self characters are already linked", () => {
    const result = pickerCandidates(ALL, "a", ["b", "c", "d"]);
    expect(result).toHaveLength(0);
  });

  it("returns all characters when selfId is not present in the list and nothing is linked", () => {
    const result = pickerCandidates(ALL, "nobody", []);
    expect(result).toHaveLength(4);
    expect(result.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not mutate the input array", () => {
    const input = [...ALL];
    pickerCandidates(input, "a", ["b"]);
    expect(input).toHaveLength(4);
  });
});
