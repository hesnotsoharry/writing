/**
 * Seam tests for GET /api/ai/house-style (W42).
 *
 * Contract under test:
 *   - GET → 200, Content-Type application/json, Cache-Control no-store,
 *     CORS header present for allowlisted origin, body has correct shape.
 *   - OPTIONS with allowlisted origin → 204 with ACAO + GET in Allow-Methods.
 *   - OPTIONS with no origin → 204, no CORS headers.
 */
import { describe, expect, it } from "vitest";

import { onRequestGet, onRequestOptions } from "./house-style";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fakeGetContext(origin?: string) {
  const headers: Record<string, string> = {};
  if (origin) headers["Origin"] = origin;
  return {
    env: {},
    request: new Request("https://writersnook.app/api/ai/house-style", {
      method: "GET",
      headers,
    }),
  } as unknown as Parameters<typeof onRequestGet>[0];
}

function fakeOptionsContext(origin?: string) {
  const headers: Record<string, string> = {};
  if (origin) headers["Origin"] = origin;
  return {
    env: {},
    request: new Request("https://writersnook.app/api/ai/house-style", {
      method: "OPTIONS",
      headers,
    }),
  } as unknown as Parameters<typeof onRequestOptions>[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/ai/house-style", () => {
  it("returns 200 with correct shape for allowlisted origin", async () => {
    const res = await onRequestGet(fakeGetContext("http://localhost:1420"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:1420");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body["version"]).toBe(1);
    expect(body["enabled"]).toBe(true);
    expect(typeof body["block"]).toBe("string");
    expect((body["block"] as string).length).toBeGreaterThan(0);
    expect(body["block"]).toContain("<house-style>");
    expect(body["perModelAddenda"]).toEqual({});

    // Drift tripwire (W42 review fix): the endpoint BLOCK must stay byte-in-sync
    // with the client's HOUSE_STYLE_BLOCK (src/features/ai/prompts/shared.ts) — the
    // two live in separate packages and cannot import each other. These sentinels
    // are the load-bearing v1 ban-list tokens; editing the list on one side without
    // the other fails this test, forcing intentional sync. W46 rewrites both copies.
    const block = body["block"] as string;
    for (const sentinel of [
      "Elara",
      "Silas",
      "Marcus",
      "Voss",
      "Blackwood",
      "It wasn't anger. It was grief.",
      "smelled of dust and old paper",
      "the silence was a",
      "show, don't tell",
    ]) {
      expect(block).toContain(sentinel);
    }
  });

  it("returns 200 with Content-Type json and Cache-Control no-store for unknown origin", async () => {
    const res = await onRequestGet(fakeGetContext());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("OPTIONS /api/ai/house-style (CORS preflight)", () => {
  it("returns 204 with GET in Allow-Methods for allowlisted origin", async () => {
    const res = await onRequestOptions(fakeOptionsContext("http://localhost:1420"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:1420");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("returns 204 without CORS headers for absent origin", async () => {
    const res = await onRequestOptions(fakeOptionsContext());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
