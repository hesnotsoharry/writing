/**
 * Unit tests for shared credit math helpers.
 *
 * Contract under test:
 *   - estimateCredits: ceil(chars/4 * INPUT_RATE) + ceil(maxTokens * OUTPUT_RATE)
 *   - actualCredits: ceil(inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE)
 *   - Non-negative invariant: when inputTokens ≤ chars/4 AND outputTokens ≤ maxTokens,
 *     actualCredits ≤ estimateCredits (reserve always covers actual, no overdraft).
 */
import { describe, expect, it } from "vitest";

import {
  INPUT_UNITS_PER_TOKEN,
  OUTPUT_UNITS_PER_TOKEN,
  actualCredits,
  estimateCredits,
} from "./credits";

describe("estimateCredits", () => {
  it("returns inputEst + outputReserve for round numbers", () => {
    // 400 chars → 100 input-tokens est → 100 * 0.1 = 10 units
    // maxTokens=1000 → 1000 * 0.5 = 500 units
    expect(estimateCredits(400, 1000)).toBe(510);
  });

  it("ceils fractional input estimate", () => {
    // 10 chars → 2.5 tokens est → 0.25 units → ceil = 1
    // maxTokens=1 → 0.5 units → ceil = 1
    expect(estimateCredits(10, 1)).toBe(2);
  });

  it("returns 0 for empty message with 0 max_tokens", () => {
    expect(estimateCredits(0, 0)).toBe(0);
  });

  it("uses the exported rate constants", () => {
    const chars = 800;
    const max = 512;
    const expected =
      Math.ceil((chars / 4) * INPUT_UNITS_PER_TOKEN) +
      Math.ceil(max * OUTPUT_UNITS_PER_TOKEN);
    expect(estimateCredits(chars, max)).toBe(expected);
  });
});

describe("actualCredits", () => {
  it("calculates from Anthropic reported token counts", () => {
    // 10 * 0.1 + 7 * 0.5 = 1 + 3.5 = 4.5 → ceil = 5
    expect(actualCredits(10, 7)).toBe(5);
  });

  it("returns 0 for zero tokens", () => {
    expect(actualCredits(0, 0)).toBe(0);
  });

  it("uses the exported rate constants", () => {
    const inp = 50;
    const out = 200;
    expect(actualCredits(inp, out)).toBe(
      Math.ceil(inp * INPUT_UNITS_PER_TOKEN + out * OUTPUT_UNITS_PER_TOKEN),
    );
  });
});

describe("non-negative invariant: actualCredits ≤ estimateCredits", () => {
  it("actual equals estimate at exact heuristic with full output used", () => {
    // 400 chars → exactly 100 input tokens; maxTokens = outputTokens = 100
    // estimate: ceil(100*0.1) + ceil(100*0.5) = 10 + 50 = 60
    // actual:   ceil(100*0.1 + 100*0.5) = ceil(60) = 60
    const chars = 400;
    const maxTokens = 100;
    const inputTokens = chars / 4;
    const outputTokens = maxTokens;
    expect(actualCredits(inputTokens, outputTokens)).toBeLessThanOrEqual(
      estimateCredits(chars, maxTokens),
    );
  });

  it("actual is below estimate when output is less than max_tokens", () => {
    // Reserve covers worst case; early stop means refund
    const chars = 4000;
    const maxTokens = 2000;
    const actualInput = 800; // ≤ chars/4 = 1000
    const actualOutput = 300; // ≤ maxTokens
    expect(actualCredits(actualInput, actualOutput)).toBeLessThanOrEqual(
      estimateCredits(chars, maxTokens),
    );
  });
});
