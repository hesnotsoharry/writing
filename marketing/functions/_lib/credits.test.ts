/**
 * Unit tests for shared credit math helpers.
 *
 * Contract under test:
 *   - estimateCredits: ceil(chars/4 * INPUT_RATE) + ceil(maxTokens * OUTPUT_RATE)
 *   - actualCredits: ceil(inputTokens * INPUT_RATE + outputTokens * OUTPUT_RATE)
 *   - Non-negative invariant: when inputTokens ≤ chars/4 AND outputTokens ≤ maxTokens,
 *     actualCredits ≤ estimateCredits (reserve always covers actual, no overdraft).
 *
 * All migrated tests pass 'claude-haiku-4-5-20251001' as the model arg (Wave 37 D3 —
 * estimateCredits and actualCredits now require a model parameter).
 */
import { describe, expect, it } from "vitest";

import { CREDIT_UNIT_USD } from "./ai-token";
import {
  INPUT_UNITS_PER_TOKEN,
  OUTPUT_UNITS_PER_TOKEN,
  actualCredits,
  estimateCredits,
} from "./credits";

const HAIKU = "claude-haiku-4-5-20251001";

// ── Wave 35 Phase G: verify derived constants (no magic numbers) ──────────────

describe("rate constants derived from CREDIT_UNIT_USD (no magic numbers)", () => {
  it("INPUT_UNITS_PER_TOKEN is 1e-6 / CREDIT_UNIT_USD — formula, not a hardcoded literal", () => {
    // Strict equality: the module expression and the test expression use the same floating-point computation.
    expect(INPUT_UNITS_PER_TOKEN).toBe(1e-6 / CREDIT_UNIT_USD);
    // Numeric proximity: confirms the value is approximately 0.1 (rate model: $1/MTok input).
    expect(INPUT_UNITS_PER_TOKEN).toBeCloseTo(0.1, 10);
  });

  it("OUTPUT_UNITS_PER_TOKEN is 5e-6 / CREDIT_UNIT_USD — formula, not a hardcoded literal", () => {
    expect(OUTPUT_UNITS_PER_TOKEN).toBe(5e-6 / CREDIT_UNIT_USD);
    // Numeric proximity: confirms the value is approximately 0.5 (rate model: $5/MTok output).
    expect(OUTPUT_UNITS_PER_TOKEN).toBeCloseTo(0.5, 10);
  });
});

describe("estimateCredits", () => {
  it("returns inputEst + outputReserve for round numbers", () => {
    // 400 chars → 100 input-tokens est → 100 * 0.1 = 10 units
    // maxTokens=1000 → 1000 * 0.5 = 500 units
    expect(estimateCredits(400, 1000, HAIKU)).toBe(510);
  });

  it("ceils fractional input estimate", () => {
    // 10 chars → 2.5 tokens est → 0.25 units → ceil = 1
    // maxTokens=1 → 0.5 units → ceil = 1
    expect(estimateCredits(10, 1, HAIKU)).toBe(2);
  });

  it("returns 0 for empty message with 0 max_tokens", () => {
    expect(estimateCredits(0, 0, HAIKU)).toBe(0);
  });

  it("uses the exported rate constants", () => {
    const chars = 800;
    const max = 512;
    const expected =
      Math.ceil((chars / 4) * INPUT_UNITS_PER_TOKEN) +
      Math.ceil(max * OUTPUT_UNITS_PER_TOKEN);
    expect(estimateCredits(chars, max, HAIKU)).toBe(expected);
  });
});

describe("actualCredits", () => {
  it("calculates from Anthropic reported token counts", () => {
    // 10 * 0.1 + 7 * 0.5 = 1 + 3.5 = 4.5 → ceil = 5
    expect(actualCredits(10, 7, HAIKU)).toBe(5);
  });

  it("returns 0 for zero tokens", () => {
    expect(actualCredits(0, 0, HAIKU)).toBe(0);
  });

  it("uses the exported rate constants", () => {
    const inp = 50;
    const out = 200;
    expect(actualCredits(inp, out, HAIKU)).toBe(
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
    expect(actualCredits(inputTokens, outputTokens, HAIKU)).toBeLessThanOrEqual(
      estimateCredits(chars, maxTokens, HAIKU),
    );
  });

  it("actual is below estimate when output is less than max_tokens", () => {
    // Reserve covers worst case; early stop means refund
    const chars = 4000;
    const maxTokens = 2000;
    const actualInput = 800; // ≤ chars/4 = 1000
    const actualOutput = 300; // ≤ maxTokens
    expect(actualCredits(actualInput, actualOutput, HAIKU)).toBeLessThanOrEqual(
      estimateCredits(chars, maxTokens, HAIKU),
    );
  });
});
