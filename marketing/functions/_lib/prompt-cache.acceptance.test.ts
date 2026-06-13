/**
 * Acceptance test for prompt-cache gating contract.
 *
 * Contract under test:
 *   - MIN_CACHEABLE_TOKENS: Record<string, number> mapping model IDs to minimum cacheable prefix tokens
 *   - shouldAttachCache(estimatedPrefixTokens, model): boolean
 *     Returns true iff estimatedPrefixTokens >= MIN_CACHEABLE_TOKENS[model].
 *     Unknown models default to 4096 (most conservative floor) — caching only attaches on payoff.
 */
import { describe, expect, it } from "vitest";

import {
  MIN_CACHEABLE_TOKENS,
  shouldAttachCache,
} from "./prompt-cache";

describe("MIN_CACHEABLE_TOKENS", () => {
  it("defines Haiku minimum as 4096", () => {
    expect(MIN_CACHEABLE_TOKENS["claude-haiku-4-5-20251001"]).toBe(4096);
  });

  it("defines Sonnet minimum as 1024", () => {
    expect(MIN_CACHEABLE_TOKENS["claude-sonnet-4-6"]).toBe(1024);
  });

  it("defines Opus minimum as 1024", () => {
    expect(MIN_CACHEABLE_TOKENS["claude-opus-4-8"]).toBe(1024);
  });
});

describe("shouldAttachCache — gating decision", () => {
  describe("Haiku (4096 threshold)", () => {
    it("returns false below threshold (4095 tokens)", () => {
      expect(shouldAttachCache(4095, "claude-haiku-4-5-20251001")).toBe(false);
    });

    it("returns true at threshold (4096 tokens)", () => {
      expect(shouldAttachCache(4096, "claude-haiku-4-5-20251001")).toBe(true);
    });

    it("returns true well above threshold (8000 tokens)", () => {
      expect(shouldAttachCache(8000, "claude-haiku-4-5-20251001")).toBe(true);
    });
  });

  describe("Sonnet (1024 threshold)", () => {
    it("returns false below threshold (1023 tokens)", () => {
      expect(shouldAttachCache(1023, "claude-sonnet-4-6")).toBe(false);
    });

    it("returns true at threshold (1024 tokens)", () => {
      expect(shouldAttachCache(1024, "claude-sonnet-4-6")).toBe(true);
    });
  });

  describe("Opus (1024 threshold)", () => {
    it("returns true at threshold (1024 tokens)", () => {
      expect(shouldAttachCache(1024, "claude-opus-4-8")).toBe(true);
    });
  });

  describe("unknown model (conservative 4096 default)", () => {
    it("returns false below conservative default (5000 tokens)", () => {
      expect(shouldAttachCache(4095, "some-unknown-model")).toBe(false);
    });

    it("returns true at conservative default (4096 tokens)", () => {
      expect(shouldAttachCache(4096, "some-unknown-model")).toBe(true);
    });

    it("returns true well above conservative default (5000 tokens)", () => {
      expect(shouldAttachCache(5000, "some-unknown-model")).toBe(true);
    });
  });
});
