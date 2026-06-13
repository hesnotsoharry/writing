import { describe, expect, it } from "vitest";

import { parseProseSelection } from "../features/ai/ai.helpers";

// Orchestrator-authored Phase I acceptance test (Wave 35) — the pure, testable seam
// of the selection affordance. Implementer adds parseProseSelection to ai.helpers.ts
// and may NOT modify this file. The DOM selectionchange listener, coordsAtPos/rect
// positioning, the floating AiAskPill, and the right-click menu are CDP-smoke-only
// (jsdom cannot exercise editor selection geometry) — this oracle pins the word-count
// + min-3-words threshold logic that gates whether the pill appears at all.

describe("parseProseSelection — min-3-words gate + word count", () => {
  it("returns the trimmed text + word count for a 3-word selection", () => {
    expect(parseProseSelection("one two three")).toEqual({ text: "one two three", words: 3 });
  });

  it("returns null below the 3-word threshold", () => {
    expect(parseProseSelection("one two")).toBeNull();
    expect(parseProseSelection("single")).toBeNull();
  });

  it("collapses arbitrary whitespace/newlines when counting words", () => {
    const out = parseProseSelection("  the   tide \n came  in   fast  ");
    expect(out).not.toBeNull();
    expect(out?.words).toBe(5);
  });

  it("trims surrounding whitespace in the returned text", () => {
    const out = parseProseSelection("  the tide came  ");
    expect(out?.text).toBe("the tide came");
  });

  it("returns null for an empty or whitespace-only selection", () => {
    expect(parseProseSelection("")).toBeNull();
    expect(parseProseSelection("   \n  ")).toBeNull();
  });

  it("counts a long selection correctly", () => {
    const out = parseProseSelection("I shiver as I walk the barren path ahead");
    expect(out?.words).toBe(9);
  });
});
