import { describe, expect, it } from "vitest";

import { diffCounts, diffWords } from "../lib/diffWords";

// ── diffWords ─────────────────────────────────────────────────────────────────

describe("diffWords", () => {
  it("returns all 'same' tokens when both strings are identical", () => {
    const tokens = diffWords("the quick brown fox", "the quick brown fox");
    expect(tokens.every((t) => t.t === "same")).toBe(true);
    expect(tokens.map((t) => t.v)).toStrictEqual(["the", "quick", "brown", "fox"]);
  });

  it("returns all 'add' tokens when from is empty", () => {
    const tokens = diffWords("", "hello world");
    expect(tokens).toStrictEqual([
      { t: "add", v: "hello" },
      { t: "add", v: "world" },
    ]);
  });

  it("returns all 'del' tokens when to is empty", () => {
    const tokens = diffWords("hello world", "");
    expect(tokens).toStrictEqual([
      { t: "del", v: "hello" },
      { t: "del", v: "world" },
    ]);
  });

  it("detects a single word replacement (del + add)", () => {
    const tokens = diffWords("the cat sat", "the dog sat");
    const types = tokens.map((t) => t.t);
    expect(types).toContain("del");
    expect(types).toContain("add");
    const del = tokens.filter((t) => t.t === "del").map((t) => t.v);
    const add = tokens.filter((t) => t.t === "add").map((t) => t.v);
    expect(del).toStrictEqual(["cat"]);
    expect(add).toStrictEqual(["dog"]);
  });

  it("preserves common words as 'same' tokens around an insertion", () => {
    const tokens = diffWords("the fox", "the quick fox");
    expect(tokens.find((t) => t.t === "add")?.v).toBe("quick");
    const sameWords = tokens.filter((t) => t.t === "same").map((t) => t.v);
    expect(sameWords).toStrictEqual(["the", "fox"]);
  });

  it("handles extra whitespace by splitting on any whitespace", () => {
    const tokens = diffWords("hello  world", "hello world");
    expect(tokens.every((t) => t.t === "same")).toBe(true);
  });

  it("returns empty array for two empty strings", () => {
    expect(diffWords("", "")).toStrictEqual([]);
  });
});

// ── diffCounts ────────────────────────────────────────────────────────────────

describe("diffCounts", () => {
  it("returns { added: 0, removed: 0 } for identical strings", () => {
    expect(diffCounts("the cat sat", "the cat sat")).toStrictEqual({ added: 0, removed: 0 });
  });

  it("counts added words correctly when words are appended", () => {
    const result = diffCounts("hello", "hello world today");
    expect(result.added).toBe(2);
    expect(result.removed).toBe(0);
  });

  it("counts removed words correctly when words are deleted", () => {
    const result = diffCounts("hello world today", "hello");
    expect(result.added).toBe(0);
    expect(result.removed).toBe(2);
  });

  it("counts both added and removed when words are replaced", () => {
    // "the", "on", "the" are common; "cat", "sat", "mat" removed; "dog", "lay", "floor" added
    const result = diffCounts("the cat sat on the mat", "the dog lay on the floor");
    expect(result.added).toBe(3);
    expect(result.removed).toBe(3);
  });

  it("returns { added: 0, removed: 0 } for two empty strings", () => {
    expect(diffCounts("", "")).toStrictEqual({ added: 0, removed: 0 });
  });

  it("counts all words as added when from is empty", () => {
    const result = diffCounts("", "one two three");
    expect(result.added).toBe(3);
    expect(result.removed).toBe(0);
  });
});
