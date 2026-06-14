/**
 * Tests for fetchAndStoreHouseStyleConfig — the fail-open remote-config fetch.
 *
 * Contracts verified (each guard in the fail-open chain):
 * - guard 0: fetch rejects (network error) → _active stays null
 * - guard 1: res.ok false (HTTP 500) → _active stays null; json() not called
 * - guard 2: res.ok true but json() rejects (non-JSON body) → _active stays null
 * - guard 3: valid HTTP + JSON but type-guard fails (missing enabled) → null
 * - guard 3b: perModelAddenda is an array → null (type-guard rejects arrays)
 * - guard 4: block.length > MAX_HOUSE_STYLE_BLOCK → null
 * - happy path: fully valid config → getActiveHouseStyleConfig() returns it
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetHouseStyleConfigForTests,
  fetchAndStoreHouseStyleConfig,
  getActiveHouseStyleConfig,
} from "../features/ai/ai.house-style";
import { MAX_HOUSE_STYLE_BLOCK } from "../features/ai/prompts/shared";

// ── Helpers ───────────────────────────────────────────────────────────────────

function validConfig() {
  return {
    version: 1,
    enabled: true,
    block: "<house-style>Do not use AI-isms.</house-style>",
    perModelAddenda: {},
  };
}

function makeResponse(ok: boolean, body: unknown, jsonRejects = false) {
  const jsonFn = jsonRejects
    ? vi.fn(() => Promise.reject(new SyntaxError("bad json")))
    : vi.fn(() => Promise.resolve(body));
  return { ok, json: jsonFn };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("fetchAndStoreHouseStyleConfig fail-open guard chain", () => {
  beforeEach(() => {
    __resetHouseStyleConfigForTests();
    vi.restoreAllMocks();
  });

  it("guard 0: fetch rejects → _active stays null", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network error"))));
    await fetchAndStoreHouseStyleConfig();
    expect(getActiveHouseStyleConfig()).toBeNull();
  });

  it("guard 1: res.ok false (500) → _active stays null and json() is not called", async () => {
    const fakeRes = makeResponse(false, null);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fakeRes)));
    await fetchAndStoreHouseStyleConfig();
    expect(getActiveHouseStyleConfig()).toBeNull();
    expect(fakeRes.json).not.toHaveBeenCalled();
  });

  it("guard 2: res.ok true but json() rejects → _active stays null", async () => {
    const fakeRes = makeResponse(true, null, true);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fakeRes)));
    await fetchAndStoreHouseStyleConfig();
    expect(getActiveHouseStyleConfig()).toBeNull();
  });

  it("guard 3: valid JSON but missing 'enabled' field → _active stays null", async () => {
    const bad = { version: 1, block: "x", perModelAddenda: {} }; // no 'enabled'
    const fakeRes = makeResponse(true, bad);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fakeRes)));
    await fetchAndStoreHouseStyleConfig();
    expect(getActiveHouseStyleConfig()).toBeNull();
  });

  it("guard 3b: perModelAddenda is an array → _active stays null", async () => {
    const bad = { version: 1, enabled: true, block: "x", perModelAddenda: [] };
    const fakeRes = makeResponse(true, bad);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fakeRes)));
    await fetchAndStoreHouseStyleConfig();
    expect(getActiveHouseStyleConfig()).toBeNull();
  });

  it("guard 4: block.length > MAX_HOUSE_STYLE_BLOCK → _active stays null", async () => {
    const oversized = {
      ...validConfig(),
      block: "x".repeat(MAX_HOUSE_STYLE_BLOCK + 1),
    };
    const fakeRes = makeResponse(true, oversized);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fakeRes)));
    await fetchAndStoreHouseStyleConfig();
    expect(getActiveHouseStyleConfig()).toBeNull();
  });

  it("happy path: fully valid config → getActiveHouseStyleConfig() returns it", async () => {
    const cfg = validConfig();
    const fakeRes = makeResponse(true, cfg);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fakeRes)));
    await fetchAndStoreHouseStyleConfig();
    expect(getActiveHouseStyleConfig()).toEqual(cfg);
  });
});
