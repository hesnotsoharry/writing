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
  RATES,
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

describe("W44 OpenAI rates", () => {
  it("actualCredits for gpt-5.4: 1000 input + 1000 output = ceil(1000*0.25 + 1000*1.5) = 1750", () => {
    expect(actualCredits(1000, 1000, "gpt-5.4")).toBe(1750);
  });

  it("actualCredits for gpt-5.4-mini: 1000 input + 1000 output = ceil(1000*0.075 + 1000*0.45) = 525", () => {
    expect(actualCredits(1000, 1000, "gpt-5.4-mini")).toBe(525);
  });

  it("actualCredits for gpt-5.5: 1000 input + 1000 output = ceil(1000*0.5 + 1000*3.0) = 3500", () => {
    expect(actualCredits(1000, 1000, "gpt-5.5")).toBe(3500);
  });

  it("cache-read billed at cacheRead rate: actualCredits(0, 0, 'gpt-5.4', 0, 1000) = ceil(1000*0.025) = 25", () => {
    expect(actualCredits(0, 0, "gpt-5.4", 0, 1000)).toBe(25);
  });

  it("OpenAI models have no cache-write premium: cacheWrite5m = cacheWrite1h = input", () => {
    const openaiModels = ["gpt-5.4", "gpt-5.4-mini", "gpt-5.5"];
    for (const model of openaiModels) {
      const rates = RATES[model];
      expect(rates.cacheWrite5m).toBe(rates.input);
      expect(rates.cacheWrite1h).toBe(rates.input);
    }
  });

  it("estimateCredits for gpt-5.4: ceil(4000/4*0.25) + ceil(1000*1.5) = 250 + 1500 = 1750", () => {
    expect(estimateCredits(4000, 1000, "gpt-5.4")).toBe(1750);
  });
});

// ── W54 GLM cache-branch guard (billing correctness) ──────────────────────────
//
// Defect: estimateCredits called shouldAttachCache without a cacheWrite1h>0 guard.
// For z-ai/glm-5.2 (cacheWrite1h=0), shouldAttachCache defaults to the 4096-token
// Haiku floor → returns true for any system >~16k chars → system reserved at $0 →
// actualCredits charges at rates.input → operator absorbs the shortfall.
//
// The fix adds `&& rates.cacheWrite1h > 0` to the branch condition.
// These tests assert the fix holds and that Anthropic estimates are unchanged.

const GLM = "z-ai/glm-5.2";
const SONNET = "claude-sonnet-4-6";

describe("W54 GLM large-system estimate does not under-reserve (cacheWrite1h guard)", () => {
  // systemLength = 20000 chars → systemTokens = 5000 (> 4096 Haiku floor → shouldAttachCache true)
  // Without guard: inputEst = ceil(5000*0 + 250*0.095) = ceil(23.75) = 24 → WRONG (under-reserve)
  // With guard: cacheWrite1h = 0 → skip cache branch → ceil((21000/4)*0.095) = ceil(498.75) = 499
  // outputReserve = ceil(1000 * 0.3) = 300; total = 799
  const systemLength = 20_000; // chars → 5000 tokens, well above the 4096 default floor
  const charCount = 21_000;    // total chars (system + messages)
  const maxTokens = 1_000;

  it("estimate uses input rate for system tokens (not the zero cacheWrite1h rate)", () => {
    const est = estimateCredits(charCount, maxTokens, GLM, systemLength);
    // Must equal the plain-input-rate formula, not the zero-rate cache path
    const expected =
      Math.ceil((charCount / 4) * RATES[GLM].input) +
      Math.ceil(maxTokens * RATES[GLM].output);
    expect(est).toBe(expected); // 499 + 300 = 799
  });

  it("estimate covers actualCredits for a realistic GLM response (no operator under-bill)", () => {
    const est = estimateCredits(charCount, maxTokens, GLM, systemLength);
    // Realistic usage: 5000 input + 500 output → actual = ceil(5000*0.095 + 500*0.3) = ceil(625) = 625
    const actual = actualCredits(5_000, 500, GLM);
    expect(actual).toBeLessThanOrEqual(est);
  });
});

describe("W54 Anthropic cache estimate is unchanged by the cacheWrite1h guard", () => {
  // Sonnet cacheWrite1h = 0.6 > 0 → guard passes → same branch as before.
  // systemLength = 5000 chars → systemTokens = 1250 (>= 1024 Sonnet floor → shouldAttachCache true)
  // inputEst = ceil(1250*0.6 + 250*0.3) = ceil(750+75) = 825
  // outputReserve = ceil(500*1.5) = 750; total = 1575
  it("Sonnet large-system estimate still uses cacheWrite1h rate for system tokens", () => {
    const systemLength = 5_000;
    const charCount = 6_000;
    const maxTokens = 500;
    const est = estimateCredits(charCount, maxTokens, SONNET, systemLength);
    const systemTokens = Math.ceil(systemLength / 4); // 1250
    const messageTokens = Math.ceil((charCount - systemLength) / 4); // 250
    const expected =
      Math.ceil(systemTokens * RATES[SONNET].cacheWrite1h + messageTokens * RATES[SONNET].input) +
      Math.ceil(maxTokens * RATES[SONNET].output);
    expect(est).toBe(expected); // 825 + 750 = 1575
  });
});
