/**
 * W48 P3 acceptance test (orchestrator-authored) — 1-hour cache-TTL billing.
 * Implementer must satisfy this file WITHOUT modifying it.
 *
 * Two locked properties:
 *  (1) actualCredits with cacheWriteTtl '1h' bills cache-creation tokens at the
 *      cacheWrite1h rate (2x base input) for every Anthropic model, and 1h costs
 *      strictly more than 5m for the same write.
 *  (2) Reserve invariant restored under 1h (the precise-cache-write-reserve fix):
 *      when the stable system prefix clears the model's cache floor, passing
 *      systemLength to estimateCredits makes it reserve the system tokens at the
 *      1h cache-write rate, so reserve >= actual on a COLD cache-creation turn —
 *      the turn the 5m->1h flip makes ~4x more expensive. The pre-existing 3-arg
 *      estimateCredits behavior is unchanged (covered by credits.test.ts).
 */
import { describe, expect, it } from "vitest";

import { actualCredits, estimateCredits, RATES } from "./credits";

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";
const OPUS = "claude-opus-4-8";
const ANTHROPIC_MODELS = [HAIKU, SONNET, OPUS];

describe("W48 P3 — actualCredits bills cache-creation at the 1h write rate", () => {
  for (const model of ANTHROPIC_MODELS) {
    it(`${model}: 1000 cache-creation tokens billed at cacheWrite1h`, () => {
      const r = RATES[model];
      expect(actualCredits(0, 0, model, 1000, 0, "1h")).toBe(Math.ceil(1000 * r.cacheWrite1h));
      // 1h write is strictly more expensive than 5m for the same creation count.
      expect(actualCredits(0, 0, model, 1000, 0, "1h")).toBeGreaterThan(
        actualCredits(0, 0, model, 1000, 0, "5m"),
      );
    });
  }
});

describe("W48 P3 — reserve invariant holds on a cold cache-write turn (1h)", () => {
  for (const model of ANTHROPIC_MODELS) {
    it(`${model}: estimateCredits(systemLength) >= actualCredits on cold cache-creation`, () => {
      // A stable prefix that clears the cache floor: Haiku 4096 tok (=16384 chars),
      // Sonnet/Opus 1024 tok (=4096 chars).
      const systemLength = model === HAIKU ? 20000 : 6000;
      const messageChars = 2000; // the volatile scene + ask now riding in the user turn
      const charCount = systemLength + messageChars;
      const maxTokens = 1024;

      // Cold turn: the whole system prefix is a cache WRITE; messages are plain input.
      // (Anthropic reports cache_creation_input_tokens and input_tokens separately.)
      const systemTokens = Math.ceil(systemLength / 4);
      const messageTokens = Math.ceil(messageChars / 4);
      const outputTokens = 200; // <= maxTokens, so output reserve covers it

      const reserve = estimateCredits(charCount, maxTokens, model, systemLength);
      const actual = actualCredits(messageTokens, outputTokens, model, systemTokens, 0, "1h");
      expect(reserve).toBeGreaterThanOrEqual(actual);
    });
  }
});
