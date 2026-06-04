/**
 * dropOverlappingGrammar.test.ts
 *
 * Tests the pure helper that enforces Decision 3 (spelling wins on overlap):
 * any grammar/style CheckResult whose [from,to) overlaps any spelling
 * CheckResult is dropped; disjoint and adjacent results are kept.
 *
 * Half-open interval overlap: [a,b) and [c,d) overlap iff a < d && c < b.
 * Adjacency (grammar.from === spell.to) is NOT overlap — kept.
 */

import { describe, expect, it } from "vitest";

import type { CheckResult } from "../editor/extensions/checkTypes";
import { dropOverlappingGrammar } from "../editor/extensions/ProofreadExtension";

// ---------------------------------------------------------------------------
// Helpers to build minimal CheckResult objects.
// ---------------------------------------------------------------------------

function spell(from: number, to: number): CheckResult {
  return { from, to, type: "spelling", message: "", suggestions: [] };
}

function grammar(from: number, to: number): CheckResult {
  return { from, to, type: "grammar", message: "", suggestions: [] };
}

function style(from: number, to: number): CheckResult {
  return { from, to, type: "style", message: "", suggestions: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("dropOverlappingGrammar", () => {
  it("drops grammar range that overlaps a spelling range (same range)", () => {
    const result = dropOverlappingGrammar([spell(5, 10)], [grammar(5, 10)]);
    expect(result).toHaveLength(0);
  });

  it("drops grammar range that partially overlaps a spelling range (grammar starts inside spell)", () => {
    // spell [5,10), grammar [7,14) — overlap: 7 < 10 && 5 < 14
    const result = dropOverlappingGrammar([spell(5, 10)], [grammar(7, 14)]);
    expect(result).toHaveLength(0);
  });

  it("drops grammar range that partially overlaps a spelling range (grammar starts before spell)", () => {
    // spell [5,10), grammar [2,8) — overlap: 2 < 10 && 5 < 8
    const result = dropOverlappingGrammar([spell(5, 10)], [grammar(2, 8)]);
    expect(result).toHaveLength(0);
  });

  it("drops grammar range that fully contains a spelling range", () => {
    // spell [5,8), grammar [3,12) — overlap: 3 < 8 && 5 < 12
    const result = dropOverlappingGrammar([spell(5, 8)], [grammar(3, 12)]);
    expect(result).toHaveLength(0);
  });

  it("drops grammar range when spelling fully contains the grammar range", () => {
    // spell [3,12), grammar [5,8) — overlap: 5 < 12 && 3 < 8
    const result = dropOverlappingGrammar([spell(3, 12)], [grammar(5, 8)]);
    expect(result).toHaveLength(0);
  });

  it("de-conflicts a style result too (type-agnostic — spelling wins for style as well)", () => {
    // Decision 3 covers all non-spelling decorations. A style lint overlapping a
    // misspelling is dropped; a disjoint style lint survives.
    const result = dropOverlappingGrammar([spell(5, 10)], [style(7, 14), style(20, 25)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: 20, to: 25, type: "style" });
  });

  it("keeps grammar range disjoint from all spelling ranges (grammar comes after)", () => {
    // spell [5,10), grammar [12,18) — no overlap: 12 < 10 is false
    const result = dropOverlappingGrammar([spell(5, 10)], [grammar(12, 18)]);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe(12);
    expect(result[0].to).toBe(18);
  });

  it("keeps grammar range disjoint from all spelling ranges (grammar comes before)", () => {
    // spell [10,15), grammar [2,8) — no overlap: 2 < 15 && 10 < 8 → 10 < 8 is false
    const result = dropOverlappingGrammar([spell(10, 15)], [grammar(2, 8)]);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe(2);
  });

  it("keeps grammar range ADJACENT to spelling — grammar.from === spell.to (half-open, not an overlap)", () => {
    // spell [5,10), grammar [10,16) — not overlap: 10 < 10 is false
    const result = dropOverlappingGrammar([spell(5, 10)], [grammar(10, 16)]);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe(10);
  });

  it("keeps grammar range ADJACENT to spelling — grammar.to === spell.from (half-open, not an overlap)", () => {
    // spell [10,15), grammar [4,10) — not overlap: 4 < 15 && 10 < 10 → 10 < 10 is false
    const result = dropOverlappingGrammar([spell(10, 15)], [grammar(4, 10)]);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe(4);
  });

  it("returns all grammar kept when spell array is empty", () => {
    const grammarResults = [grammar(5, 10), grammar(20, 30)];
    const result = dropOverlappingGrammar([], grammarResults);
    expect(result).toHaveLength(2);
    expect(result[0].from).toBe(5);
    expect(result[1].from).toBe(20);
  });

  it("returns empty array when both arrays are empty", () => {
    expect(dropOverlappingGrammar([], [])).toHaveLength(0);
  });

  it("filters only overlapping items from multiple grammar results — keeps disjoint, drops overlapping", () => {
    // spell [5,10)
    // grammar [8,14)  → overlaps → dropped
    // grammar [15,20) → disjoint → kept
    // grammar [1,4)   → disjoint → kept
    const spellResults = [spell(5, 10)];
    const grammarResults = [grammar(8, 14), grammar(15, 20), grammar(1, 4)];
    const result = dropOverlappingGrammar(spellResults, grammarResults);
    expect(result).toHaveLength(2);
    const froms = result.map((r) => r.from).sort((a, b) => a - b);
    expect(froms).toEqual([1, 15]);
  });

  it("handles multiple spelling ranges — grammar overlapping ANY is dropped", () => {
    // spell [5,10) and spell [20,25)
    // grammar [7,12)  → overlaps spell[0] → dropped
    // grammar [22,28) → overlaps spell[1] → dropped
    // grammar [12,18) → disjoint from both → kept
    const spellResults = [spell(5, 10), spell(20, 25)];
    const grammarResults = [grammar(7, 12), grammar(22, 28), grammar(12, 18)];
    const result = dropOverlappingGrammar(spellResults, grammarResults);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe(12);
    expect(result[0].to).toBe(18);
  });
});
