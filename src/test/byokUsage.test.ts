// @vitest-environment jsdom
/**
 * byokUsage.test.ts — Wave 49 Phase 5.
 *
 * Tests the usage store contract:
 *   - token accumulation across multiple turns (same provider, different providers)
 *   - estUsd math using the real rateUsd from providerRegistry (no mock-the-subject)
 *   - cached tokens billed at rate.cached (not rate.input)
 *   - clearUsage resets all totals
 *   - getUsage returns zeros from empty storage
 *   - localStorage.setItem throws → recordUsage is a no-op (does not crash)
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { clearUsage, getUsage, recordUsage } from "../features/ai/byokUsage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ── getUsage with empty storage ───────────────────────────────────────────────

describe("getUsage — empty storage", () => {
  it("returns zero totals for both providers when localStorage has no entry", () => {
    const u = getUsage();
    expect(u.anthropic.inputTokens).toBe(0);
    expect(u.anthropic.cachedTokens).toBe(0);
    expect(u.anthropic.outputTokens).toBe(0);
    expect(u.anthropic.estUsd).toBe(0);
    expect(u.openai.inputTokens).toBe(0);
    expect(u.openai.estUsd).toBe(0);
  });
});

// ── recordUsage — accumulation ────────────────────────────────────────────────

describe("recordUsage — token accumulation", () => {
  it("accumulates inputTokens, cachedTokens, outputTokens across two turns for Anthropic", () => {
    recordUsage("anthropic", { inputTokens: 100, cachedTokens: 0, outputTokens: 50 }, "claude-sonnet-4-6");
    recordUsage("anthropic", { inputTokens: 200, cachedTokens: 80, outputTokens: 30 }, "claude-sonnet-4-6");
    const u = getUsage();
    expect(u.anthropic.inputTokens).toBe(300);
    expect(u.anthropic.cachedTokens).toBe(80);
    expect(u.anthropic.outputTokens).toBe(80);
  });

  it("accumulates independently for anthropic and openai providers without cross-contamination", () => {
    recordUsage("anthropic", { inputTokens: 500, cachedTokens: 0, outputTokens: 100 }, "claude-sonnet-4-6");
    recordUsage("openai", { inputTokens: 300, cachedTokens: 200, outputTokens: 60 }, "gpt-5.4");
    const u = getUsage();
    expect(u.anthropic.inputTokens).toBe(500);
    expect(u.openai.inputTokens).toBe(300);
    expect(u.anthropic.outputTokens).toBe(100);
    expect(u.openai.outputTokens).toBe(60);
  });

  it("persists across a re-read of getUsage (simulating an app restart)", () => {
    recordUsage("anthropic", { inputTokens: 1000, cachedTokens: 0, outputTokens: 200 }, "claude-haiku-4-5-20251001");
    // Simulate a new read without clearing — mirrors what happens across page load.
    const fresh = getUsage();
    expect(fresh.anthropic.inputTokens).toBe(1000);
    expect(fresh.anthropic.outputTokens).toBe(200);
  });
});

// ── recordUsage — estUsd math ─────────────────────────────────────────────────

describe("recordUsage — estUsd calculation", () => {
  it("computes estUsd for Anthropic Sonnet at the correct $/MTok rates (input=3.0, cached=0.30, output=15.0)", () => {
    // 1000 input + 500 cached + 200 output at Sonnet rates:
    // estUsd = (1000×3.0 + 500×0.30 + 200×15.0) / 1e6
    //        = (3000 + 150 + 3000) / 1e6 = 6150 / 1e6 = 0.00615
    recordUsage("anthropic", { inputTokens: 1000, cachedTokens: 500, outputTokens: 200 }, "claude-sonnet-4-6");
    const u = getUsage();
    expect(u.anthropic.estUsd).toBeCloseTo(0.00615, 8);
  });

  it("bills cachedTokens at the cheaper cache-read rate (0.30), NOT the full input rate (3.0) for Sonnet", () => {
    // Two turns: first with 0 cached, second with same tokens but all as cached.
    // If cached were billed at input rate, estUsd would be the same — it must be different.
    recordUsage("anthropic", { inputTokens: 1000, cachedTokens: 0, outputTokens: 0 }, "claude-sonnet-4-6");
    const afterInput = getUsage().anthropic.estUsd; // 1000×3.0/1e6 = 0.003

    clearUsage();
    recordUsage("anthropic", { inputTokens: 0, cachedTokens: 1000, outputTokens: 0 }, "claude-sonnet-4-6");
    const afterCached = getUsage().anthropic.estUsd; // 1000×0.30/1e6 = 0.0003

    expect(afterCached).toBeLessThan(afterInput);
    expect(afterInput).toBeCloseTo(0.003, 8);
    expect(afterCached).toBeCloseTo(0.0003, 8);
  });

  it("computes estUsd for OpenAI GPT-5.4 at the correct rates (input=2.50, cached=0.25, output=15.0)", () => {
    // 800 input + 200 cached + 150 output:
    // estUsd = (800×2.50 + 200×0.25 + 150×15.0) / 1e6
    //        = (2000 + 50 + 2250) / 1e6 = 4300 / 1e6 = 0.0043
    recordUsage("openai", { inputTokens: 800, cachedTokens: 200, outputTokens: 150 }, "gpt-5.4");
    expect(getUsage().openai.estUsd).toBeCloseTo(0.0043, 8);
  });

  it("accumulates estUsd across multiple turns (not overwritten)", () => {
    recordUsage("anthropic", { inputTokens: 100, cachedTokens: 0, outputTokens: 0 }, "claude-sonnet-4-6");
    recordUsage("anthropic", { inputTokens: 100, cachedTokens: 0, outputTokens: 0 }, "claude-sonnet-4-6");
    // 2 turns × (100×3.0)/1e6 = 0.0006
    expect(getUsage().anthropic.estUsd).toBeCloseTo(0.0006, 8);
  });

  it("leaves estUsd unchanged when model has no rateUsd in registry", () => {
    // An unknown model ID has no rateUsd — tokens accumulate but cost stays 0.
    recordUsage("anthropic", { inputTokens: 5000, cachedTokens: 0, outputTokens: 1000 }, "claude-unknown-model-xyz");
    const u = getUsage();
    expect(u.anthropic.inputTokens).toBe(5000);
    expect(u.anthropic.estUsd).toBe(0);
  });
});

// ── clearUsage ────────────────────────────────────────────────────────────────

describe("clearUsage", () => {
  it("resets all provider totals to zero and getUsage returns empty state", () => {
    recordUsage("anthropic", { inputTokens: 500, cachedTokens: 100, outputTokens: 200 }, "claude-sonnet-4-6");
    recordUsage("openai", { inputTokens: 300, cachedTokens: 0, outputTokens: 50 }, "gpt-5.4");

    clearUsage();

    const u = getUsage();
    expect(u.anthropic.inputTokens).toBe(0);
    expect(u.anthropic.estUsd).toBe(0);
    expect(u.openai.inputTokens).toBe(0);
    expect(u.openai.estUsd).toBe(0);
  });
});

// ── localStorage unavailable ──────────────────────────────────────────────────

describe("localStorage unavailable — no-op guard", () => {
  it("recordUsage does not throw when localStorage.setItem throws (write guard)", () => {
    // Simulates quota-exceeded or a locked storage environment.
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => {
      recordUsage("anthropic", { inputTokens: 100, cachedTokens: 0, outputTokens: 50 }, "claude-sonnet-4-6");
    }).not.toThrow();
  });

  it("getUsage returns empty UsageStore when localStorage.getItem throws (read guard)", () => {
    // Simulates a SecurityError from a sandboxed context where storage is inaccessible.
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: access denied");
    });
    const u = getUsage();
    expect(u.anthropic.inputTokens).toBe(0);
    expect(u.anthropic.estUsd).toBe(0);
    expect(u.openai.inputTokens).toBe(0);
    expect(u.openai.estUsd).toBe(0);
  });
});

// ── byok:usage-updated event dispatch ─────────────────────────────────────────

describe("recordUsage — byok:usage-updated event dispatch", () => {
  it("dispatches 'byok:usage-updated' event on window after recording usage", () => {
    const listener = vi.fn();
    window.addEventListener("byok:usage-updated", listener);

    recordUsage("anthropic", { inputTokens: 100, cachedTokens: 0, outputTokens: 50 }, "claude-sonnet-4-6");

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener("byok:usage-updated", listener);
  });
});

describe("clearUsage — byok:usage-updated event dispatch", () => {
  it("dispatches 'byok:usage-updated' event on window after clearing usage", () => {
    recordUsage("anthropic", { inputTokens: 100, cachedTokens: 0, outputTokens: 50 }, "claude-sonnet-4-6");

    const listener = vi.fn();
    window.addEventListener("byok:usage-updated", listener);

    clearUsage();

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener("byok:usage-updated", listener);
  });
});
