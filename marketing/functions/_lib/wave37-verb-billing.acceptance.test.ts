/**
 * Wave 37 Phase F Acceptance Test — Billing + Verb Config Contract
 *
 * Pre-impl oracle: this test fails now (missing verb-config.ts module + updated function signatures)
 * and will pass once Phase 4 lands.
 *
 * Tests the VERB_CONFIG structure, FALLBACK_VERB_CONFIG, and the model-parameterized
 * billing matrix (estimateCredits, actualCredits) across all three models and cache types.
 */

import { describe, it, expect } from "vitest";

// ── Imports that will exist after Phase 4 ──────────────────────────────────────

// These imports will fail now because verb-config.ts does not exist yet.
// The test is structured to pass once the module is created.
import { FALLBACK_VERB_CONFIG, VERB_CONFIG } from "./verb-config";

// These will fail because the current function signatures don't accept a model parameter.
import { actualCredits, estimateCredits } from "./credits";

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe("Wave 37 Phase F: Billing + Verb Config Contract", () => {
  // ── A. VERB_CONFIG Structure ──────────────────────────────────────────────

  describe("VERB_CONFIG", () => {
    it("defines brainstorm with correct model, temperature, and maxTokens", () => {
      expect(VERB_CONFIG["brainstorm"].model).toBe("claude-haiku-4-5-20251001");
      expect(VERB_CONFIG["brainstorm"].temperature).toBe(1.0);
      expect(VERB_CONFIG["brainstorm"].maxTokens).toBe(2048);
    });

    it("defines critique with correct model, temperature, and maxTokens", () => {
      expect(VERB_CONFIG["critique"].model).toBe("claude-haiku-4-5-20251001");
      expect(VERB_CONFIG["critique"].temperature).toBe(1.0);
      expect(VERB_CONFIG["critique"].maxTokens).toBe(2048);
    });

    it("defines betaread with correct model, temperature, and maxTokens", () => {
      expect(VERB_CONFIG["betaread"].model).toBe("claude-haiku-4-5-20251001");
      expect(VERB_CONFIG["betaread"].temperature).toBe(0.7);
      expect(VERB_CONFIG["betaread"].maxTokens).toBe(2048);
    });

    it("defines proofread with correct model, temperature, and maxTokens", () => {
      expect(VERB_CONFIG["proofread"].model).toBe("claude-haiku-4-5-20251001");
      expect(VERB_CONFIG["proofread"].temperature).toBe(0.1);
      expect(VERB_CONFIG["proofread"].maxTokens).toBe(4096);
    });

    it("all verbs use exactly claude-haiku-4-5-20251001 model", () => {
      Object.values(VERB_CONFIG).forEach((config) => {
        expect(config.model).toBe("claude-haiku-4-5-20251001");
      });
    });

    it("no verb config has both thinking and temperature defined", () => {
      Object.values(VERB_CONFIG).forEach((config) => {
        if (config.thinking !== undefined && config.temperature !== undefined) {
          throw new Error("VerbConfig has both thinking and temperature defined");
        }
        expect(
          !(config.thinking !== undefined && config.temperature !== undefined),
        ).toBe(true);
      });
    });
  });

  // ── B. FALLBACK_VERB_CONFIG ───────────────────────────────────────────────

  describe("FALLBACK_VERB_CONFIG", () => {
    it("uses claude-haiku-4-5-20251001 model", () => {
      expect(FALLBACK_VERB_CONFIG.model).toBe("claude-haiku-4-5-20251001");
    });

    it("has maxTokens of 1536 (proofread-regression fix)", () => {
      expect(FALLBACK_VERB_CONFIG.maxTokens).toBe(1536);
    });

    it("does not define temperature (undefined)", () => {
      expect(FALLBACK_VERB_CONFIG.temperature).toBeUndefined();
    });

    it("does not define thinking", () => {
      expect(FALLBACK_VERB_CONFIG.thinking).toBeUndefined();
    });
  });

  // ── C. Billing Matrix: actualCredits ──────────────────────────────────────

  describe("actualCredits(inputTokens, outputTokens, model, cacheCreationTokens?, cacheReadTokens?, cacheWriteTtl?)", () => {
    describe("claude-haiku-4-5-20251001 (rates: in=0.1, out=0.5, write5m=0.125, write1h=0.2, read=0.01)", () => {
      it("no-cache: actualCredits(1000, 100, 'claude-haiku-4-5-20251001') → 150", () => {
        // ceil(1000*0.1 + 100*0.5) = ceil(100 + 50) = 150
        expect(
          actualCredits(1000, 100, "claude-haiku-4-5-20251001"),
        ).toBe(150);
      });

      it("cache-write-5m: actualCredits(1000, 100, 'claude-haiku-4-5-20251001', 500, 0, '5m') → 213", () => {
        // ceil(1000*0.1 + 100*0.5 + 500*0.125) = ceil(100 + 50 + 62.5) = ceil(212.5) = 213
        expect(
          actualCredits(1000, 100, "claude-haiku-4-5-20251001", 500, 0, "5m"),
        ).toBe(213);
      });

      it("cache-read: actualCredits(1000, 100, 'claude-haiku-4-5-20251001', 0, 800) → 158", () => {
        // ceil(1000*0.1 + 100*0.5 + 800*0.01) = ceil(100 + 50 + 8) = 158
        expect(
          actualCredits(1000, 100, "claude-haiku-4-5-20251001", 0, 800),
        ).toBe(158);
      });
    });

    describe("claude-sonnet-4-6 (rates: in=0.3, out=1.5, write5m=0.375, write1h=0.6, read=0.03)", () => {
      it("no-cache: actualCredits(1000, 100, 'claude-sonnet-4-6') → 450", () => {
        // ceil(1000*0.3 + 100*1.5) = ceil(300 + 150) = 450
        expect(
          actualCredits(1000, 100, "claude-sonnet-4-6"),
        ).toBe(450);
      });

      it("cache-write-5m: actualCredits(1000, 100, 'claude-sonnet-4-6', 500, 0, '5m') → 638", () => {
        // ceil(1000*0.3 + 100*1.5 + 500*0.375) = ceil(300 + 150 + 187.5) = ceil(637.5) = 638
        expect(
          actualCredits(1000, 100, "claude-sonnet-4-6", 500, 0, "5m"),
        ).toBe(638);
      });

      it("cache-read: actualCredits(1000, 100, 'claude-sonnet-4-6', 0, 800) → 474", () => {
        // ceil(1000*0.3 + 100*1.5 + 800*0.03) = ceil(300 + 150 + 24) = 474
        expect(
          actualCredits(1000, 100, "claude-sonnet-4-6", 0, 800),
        ).toBe(474);
      });
    });

    describe("claude-opus-4-8 (rates: in=0.5, out=2.5, write5m=0.625, write1h=1.0, read=0.05)", () => {
      it("no-cache: actualCredits(1000, 100, 'claude-opus-4-8') → 750", () => {
        // ceil(1000*0.5 + 100*2.5) = ceil(500 + 250) = 750
        expect(
          actualCredits(1000, 100, "claude-opus-4-8"),
        ).toBe(750);
      });

      it("cache-write-5m: actualCredits(1000, 100, 'claude-opus-4-8', 500, 0, '5m') → 1063", () => {
        // ceil(1000*0.5 + 100*2.5 + 500*0.625) = ceil(500 + 250 + 312.5) = ceil(1062.5) = 1063
        expect(
          actualCredits(1000, 100, "claude-opus-4-8", 500, 0, "5m"),
        ).toBe(1063);
      });

      it("cache-read: actualCredits(1000, 100, 'claude-opus-4-8', 0, 800) → 790", () => {
        // ceil(1000*0.5 + 100*2.5 + 800*0.05) = ceil(500 + 250 + 40) = 790
        expect(
          actualCredits(1000, 100, "claude-opus-4-8", 0, 800),
        ).toBe(790);
      });
    });
  });

  // ── D. Billing Matrix: estimateCredits ────────────────────────────────────

  describe("estimateCredits(charCount, maxTokens, model)", () => {
    describe("claude-haiku-4-5-20251001", () => {
      it("estimateCredits(4000, 2048, 'claude-haiku-4-5-20251001') → 1124", () => {
        // inputEst = ceil((4000 / 4) * 0.1) = ceil(1000 * 0.1) = ceil(100) = 100
        // outputReserve = ceil(2048 * 0.5) = ceil(1024) = 1024
        // total = 1124
        expect(
          estimateCredits(4000, 2048, "claude-haiku-4-5-20251001"),
        ).toBe(1124);
      });
    });

    describe("claude-sonnet-4-6", () => {
      it("estimateCredits(4000, 2048, 'claude-sonnet-4-6') → 3372", () => {
        // inputEst = ceil((4000 / 4) * 0.3) = ceil(1000 * 0.3) = ceil(300) = 300
        // outputReserve = ceil(2048 * 1.5) = ceil(3072) = 3072
        // total = 3372
        expect(
          estimateCredits(4000, 2048, "claude-sonnet-4-6"),
        ).toBe(3372);
      });
    });

    describe("claude-opus-4-8", () => {
      it("estimateCredits(4000, 2048, 'claude-opus-4-8') → 5620", () => {
        // inputEst = ceil((4000 / 4) * 0.5) = ceil(1000 * 0.5) = ceil(500) = 500
        // outputReserve = ceil(2048 * 2.5) = ceil(5120) = 5120
        // total = 5620
        expect(
          estimateCredits(4000, 2048, "claude-opus-4-8"),
        ).toBe(5620);
      });
    });
  });
});
