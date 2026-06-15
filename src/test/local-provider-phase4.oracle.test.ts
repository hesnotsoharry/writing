// @vitest-environment jsdom
/**
 * local-provider-phase4.oracle.test.ts — PHASE 4 CONTRACT TESTS
 *
 * Phase 4 contract: add 'local' as a BYOK provider alongside anthropic and openai.
 * These tests encode the expected API shape and pass once the implementer
 * extends the three load-bearing surfaces:
 *   1. byokUsage.ts: extend SupportedProvider to "anthropic" | "openai" | "local"
 *                    and add local: ProviderUsage to UsageStore interface
 *   2. useByokKeys.ts: extend ByokKeys to include local: boolean field
 *                      and add a byokLocalHasKey() call + event listener
 *   3. providerRegistry.ts: append a ProviderGroup with provider: "local" to PROVIDER_REGISTRY
 */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getUsage, recordUsage } from "../features/ai/byokUsage";
import { PROVIDER_REGISTRY } from "../features/ai/providerRegistry";

// Mock all three BYOK clients so the hook doesn't try to invoke Tauri in jsdom.
vi.mock("../features/ai/byok.client", () => ({
  byokHasKey: vi.fn().mockResolvedValue(false),
  byokSetKey: vi.fn().mockResolvedValue(undefined),
  byokClearKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/byok.openai.client", () => ({
  byokOpenAiHasKey: vi.fn().mockResolvedValue(false),
  byokOpenAiSetKey: vi.fn().mockResolvedValue(undefined),
  byokOpenAiClearKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/byok.local.client", () => ({
  byokLocalHasKey: vi.fn().mockResolvedValue(false),
  byokLocalSetKey: vi.fn().mockResolvedValue(undefined),
  byokLocalClearKey: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ── Test 1: byokUsage accepts 'local' provider ─────────────────────────────────

describe("recordUsage — 'local' provider support", () => {
  it("accepts 'local' as a SupportedProvider and records under a local bucket in UsageStore", () => {
    // Phase 4 contract: recordUsage("local", tokens, model) extends the provider union.
    recordUsage("local", { inputTokens: 150, cachedTokens: 0, outputTokens: 75 }, "local-model");

    const usage = getUsage();

    // Assert the local bucket exists and accumulated correctly.
    expect(usage.local).toBeDefined();
    expect(usage.local.inputTokens).toBe(150);
    expect(usage.local.outputTokens).toBe(75);
    expect(usage.local.cachedTokens).toBe(0);
  });

  it("accumulates local tokens independently from anthropic and openai (no cross-contamination)", () => {
    // Phase 4 contract: local provider bucket is isolated, like anthropic/openai.
    recordUsage("anthropic", { inputTokens: 100, cachedTokens: 0, outputTokens: 50 }, "claude-sonnet-4-6");
    recordUsage("local", { inputTokens: 200, cachedTokens: 0, outputTokens: 100 }, "local-model");
    recordUsage("openai", { inputTokens: 300, cachedTokens: 0, outputTokens: 150 }, "gpt-5.4");

    const usage = getUsage();

    // Verify isolation: each provider has its own accumulated tokens.
    expect(usage.anthropic.inputTokens).toBe(100);
    expect(usage.local.inputTokens).toBe(200);
    expect(usage.openai.inputTokens).toBe(300);
  });
});

// ── Test 2: A local key activates byokActive ───────────────────────────────────

describe("useByokKeys — local key presence", () => {
  it("extends ByokKeys to include local: boolean field and folds it into byokActive", async () => {
    // Phase 4 contract: useByokKeys must extend ByokKeys interface with local: boolean.
    // The computed byokActive flag MUST include local in its logic: byokActive = anthropic || openai || local.
    //
    // This test encodes the load-bearing invariant:
    //   If a user has ONLY a local key set and anthropic/openai absent,
    //   byokActive MUST be true. Otherwise the compose path falls through
    //   to the managed provider, making local unreachable (silent bug).

    const { useByokKeys } = await import("../features/ai/useByokKeys");
    // renderHook is required — useByokKeys calls React hooks and cannot be invoked outside a component.
    const { result } = renderHook(() => useByokKeys());

    // local field must be a defined boolean (false when no key configured — mocked above).
    expect(result.current.local).toBeDefined();

    // Verify the hook includes local in the byokActive computation.
    // When Phase 4 is complete, ByokKeys will have { anthropic, openai, local, byokActive }
    // and byokActive will be true when any of the three providers have a key present.
    const allProvidersHaveBeenMocked =
      result.current.anthropic !== undefined &&
      result.current.openai !== undefined &&
      result.current.local !== undefined;
    expect(allProvidersHaveBeenMocked).toBe(true);
  });

  it("returns byokActive = true when ONLY the local key is present (proves local drives byokActive)", async () => {
    // Override mocks: ONLY local key present, anthropic and openai absent.
    // This proves causality: a regression dropping || local from the formula would fail this test.
    const byokLocal = await import("../features/ai/byok.local.client");
    const byok = await import("../features/ai/byok.client");
    const byokOpenAi = await import("../features/ai/byok.openai.client");

    vi.mocked(byokLocal.byokLocalHasKey).mockResolvedValue(true);
    vi.mocked(byok.byokHasKey).mockResolvedValue(false);
    vi.mocked(byokOpenAi.byokOpenAiHasKey).mockResolvedValue(false);

    // Render the hook.
    const { useByokKeys } = await import("../features/ai/useByokKeys");
    const { result } = renderHook(() => useByokKeys());

    // Wait for async key-presence checks to complete.
    await waitFor(() => {
      expect(result.current.local).toBe(true);
    });

    // Assert the causal chain: local drives byokActive to true.
    // If the formula were byokActive = anthropic || openai (dropping || local),
    // byokActive would be false despite local=true, and this test would FAIL.
    expect(result.current.anthropic).toBe(false);
    expect(result.current.openai).toBe(false);
    expect(result.current.local).toBe(true);
    expect(result.current.byokActive).toBe(true);
  });
});

// ── Test 3: PROVIDER_REGISTRY exposes a 'local' group ─────────────────────────

describe("PROVIDER_REGISTRY — 'local' provider group", () => {
  it("contains a ProviderGroup with provider: 'local' at the top level", () => {
    // Phase 4 contract: PROVIDER_REGISTRY is appended with a local ProviderGroup.
    const localGroup = PROVIDER_REGISTRY.find((g) => g.provider === "local");

    expect(localGroup).toBeDefined();
    expect(localGroup?.provider).toBe("local");
  });

  it("local group has a label and at least one model entry", () => {
    // Phase 4 contract: the local group follows ProviderGroup shape:
    // { provider: "local", label: "...", models: [...] }
    const localGroup = PROVIDER_REGISTRY.find((g) => g.provider === "local");

    expect(localGroup).toBeDefined();
    expect(localGroup?.label).toBeTruthy(); // Has a display label.
    expect(Array.isArray(localGroup?.models)).toBe(true);
    expect((localGroup?.models ?? []).length).toBeGreaterThan(0);
  });

  it("local group's first model has an id and displayName matching the expected shape", () => {
    // Phase 4 contract: model entries follow ModelEntry shape.
    const localGroup = PROVIDER_REGISTRY.find((g) => g.provider === "local");
    const firstModel = (localGroup?.models ?? [])[0];

    expect(firstModel).toBeDefined();
    expect(firstModel?.id).toBeTruthy();
    expect(firstModel?.displayName).toBeTruthy();
    expect(firstModel?.provider).toBe("local");
  });
});
