// @vitest-environment jsdom
/**
 * local-provider-phase5-gating.oracle.test.ts
 *
 * Orchestrator-owned honeycomb seam tests for Phase 5 D1 (gating bypass) + D3
 * (model resolution). Authored BEFORE the implementer slice; must be RED against
 * the pre-Phase-5 code and GREEN after the slice lands. The implementer may NOT
 * edit this file.
 *
 * D1 contract: byokLocalHasKey() returns true when a default endpoint is
 * configured, regardless of keychain state. This drives byokActive and bypasses
 * the managed credit gate for keyless local servers.
 *
 * D3 contract: streamByokLocalChat uses endpoint.model from the settings store
 * when available, so manually-entered model names compose correctly even when
 * discovery failed and the panel picker shows only the seed "local" entry.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { byokLocalHasKey } from "../features/ai/byok.local.client";

// Mock Tauri invoke — byokLocalHasKey should NOT need it after Phase 5 (pure
// localStorage check); the D3 tests assert against the invoke args.
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), Channel: vi.fn() }));

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const ENDPOINTS_KEY = "writing.customEndpoints";

describe("byokLocalHasKey — endpoint-configured semantics (Phase 5 D1)", () => {
  it("returns false when no endpoint is configured", async () => {
    expect(await byokLocalHasKey()).toBe(false);
  });

  it("returns true when an endpoint is configured WITHOUT a key (keyless server)", async () => {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({
      endpoints: [{ id: "ep1", name: "Ollama", url: "http://localhost:11434", model: "llama3.2", hasKey: false }],
      defaultId: "ep1",
    }));
    expect(await byokLocalHasKey()).toBe(true);
  });

  it("returns true when an endpoint is configured WITH a key", async () => {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({
      endpoints: [{ id: "ep2", name: "LM Studio", url: "http://localhost:1234", model: null, hasKey: true }],
      defaultId: "ep2",
    }));
    expect(await byokLocalHasKey()).toBe(true);
  });

  it("returns false when endpoints list is non-empty but defaultId is null", async () => {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({
      endpoints: [{ id: "ep3", name: "Unused", url: "http://localhost:11434", model: null, hasKey: false }],
      defaultId: null,
    }));
    expect(await byokLocalHasKey()).toBe(false);
  });
});

describe("streamByokLocalChat — model resolution from endpoint settings (Phase 5 D3)", () => {
  it("uses endpoint.model when the option model is the seed 'local' ID", async () => {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({
      endpoints: [{ id: "ep1", name: "Ollama", url: "http://localhost:11434", model: "llama3.2", hasKey: false }],
      defaultId: "ep1",
    }));
    const { invoke } = await import("@tauri-apps/api/core");
    const invokeMock = vi.mocked(invoke).mockResolvedValue(undefined);

    const { streamByokLocalChat } = await import("../features/ai/byok.local.client");
    await streamByokLocalChat("stream-1", [], vi.fn(), { model: "local" }).catch(() => {});

    expect(invokeMock).toHaveBeenCalled();
    const args = invokeMock.mock.calls[0][1] as Record<string, unknown>;
    // D3: endpoint.model ("llama3.2") overrides the option ("local")
    expect(args["model"]).toBe("llama3.2");
  });

  it("falls back to the passed model option when endpoint.model is null", async () => {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({
      endpoints: [{ id: "ep1", name: "Ollama", url: "http://localhost:11434", model: null, hasKey: false }],
      defaultId: "ep1",
    }));
    const { invoke } = await import("@tauri-apps/api/core");
    const invokeMock = vi.mocked(invoke).mockResolvedValue(undefined);

    const { streamByokLocalChat } = await import("../features/ai/byok.local.client");
    await streamByokLocalChat("stream-2", [], vi.fn(), { model: "custom-model" }).catch(() => {});

    const args = invokeMock.mock.calls[0][1] as Record<string, unknown>;
    expect(args["model"]).toBe("custom-model");
  });
});
