/**
 * Seam tests for GET /api/ai/portal.
 *
 * Contract under test:
 *   - Missing Authorization header → 401.
 *   - Invalid Bearer token → 401.
 *   - Valid token but no subscription row → 401.
 *   - Valid token + row with null ls_subscription_id → 404.
 *   - Valid token + row with ls_subscription_id + LS non-2xx → 502.
 *   - Valid token + row + LS 200 but missing customer_portal field → 502.
 *   - Valid token + row + LS 200 with customer_portal → 200 { url }.
 *
 * Boundaries: @supabase/supabase-js is mocked; global fetch is mocked for LS calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildToken } from "../../_lib/ai-token";
import { onRequestGet } from "./portal";

// ── Supabase mock ─────────────────────────────────────────────────────────────

interface SubRow {
  ls_subscription_id: string | null;
}

let subRow: SubRow = { ls_subscription_id: "sub-abc-123" };
let subFound = true;
let subError = false;
let subPgrst116 = false;

function makeMockClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => {
            if (subError) return Promise.resolve({ data: null, error: { message: "db transport error" } });
            if (subPgrst116) return Promise.resolve({ data: null, error: { code: "PGRST116", message: "no rows" } });
            if (!subFound) return Promise.resolve({ data: null, error: null });
            return Promise.resolve({ data: subRow, error: null });
          },
        }),
      }),
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => makeMockClient() }));

// ── fetch mock ────────────────────────────────────────────────────────────────

let lsFetchOk = true;
let lsFetchBody: unknown = {
  data: { attributes: { urls: { customer_portal: "https://app.lemonsqueezy.com/my-orders/portal-token-abc" } } },
};

const originalFetch = globalThis.fetch;

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-proxy-secret-portal-xyz";
const TEST_LICENSE = "TEST-LICENSE-PORTAL-001";

async function makeValidToken() {
  return (await buildToken(TEST_LICENSE, TEST_SECRET)).token;
}

function fakeContext(authHeader: string | null) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["Authorization"] = authHeader;
  return {
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
      SUPABASE_ANON_KEY: "placeholder-anon",
      PROXY_SESSION_SECRET: TEST_SECRET,
      LS_API_KEY: "placeholder-ls-key",
    },
    request: new Request("https://writersnook.app/api/ai/portal", {
      method: "GET",
      headers,
    }),
  } as unknown as Parameters<typeof onRequestGet>[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/ai/portal contract", () => {
  beforeEach(() => {
    subRow = { ls_subscription_id: "sub-abc-123" };
    subFound = true;
    subError = false;
    subPgrst116 = false;
    lsFetchOk = true;
    lsFetchBody = {
      data: { attributes: { urls: { customer_portal: "https://app.lemonsqueezy.com/my-orders/portal-token-abc" } } },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: lsFetchOk,
      json: () => Promise.resolve(lsFetchBody),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const ctx = fakeContext(null);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Bearer token has an invalid signature", async () => {
    const ctx = fakeContext("Bearer invalid.badsig");
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 401 when no subscription row exists for the license key", async () => {
    subFound = false;
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 401 when Supabase returns PGRST116 (no rows)", async () => {
    subPgrst116 = true;
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when row exists but ls_subscription_id is null", async () => {
    subRow = { ls_subscription_id: null };
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(404);
  });

  it("returns 502 when Lemon Squeezy returns a non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({}) });
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(502);
  });

  it("returns 502 when LS response is missing the customer_portal field", async () => {
    lsFetchBody = { data: { attributes: { urls: {} } } };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(lsFetchBody) });
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(502);
  });

  it("returns 200 with { url } containing the customer_portal URL when all conditions are met", async () => {
    const expectedUrl = "https://app.lemonsqueezy.com/my-orders/portal-token-abc";
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["url"]).toBe(expectedUrl);
  });
});
