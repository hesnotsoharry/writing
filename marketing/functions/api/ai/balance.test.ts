/**
 * Seam tests for GET /api/ai/balance (Wave 35 Phase G).
 *
 * Contract under test:
 *   - Missing Authorization header → 401.
 *   - Invalid / expired session token → 401.
 *   - Valid token + active subscription →
 *       200 with { creditsBalance, monthlyAllowance, resetAt, status: 'active' }.
 *   - Valid token + reset_at null → resetAt: '' (not null, not 'null').
 *   - Valid token + expired subscription → status: 'expired'.
 *
 * Boundary: @supabase/supabase-js is mocked; no live calls.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildToken } from "../../_lib/ai-token";
import { MONTHLY_ALLOWANCE } from "../../_lib/credits";
import { onRequestGet, onRequestOptions } from "./balance";

// ── Supabase mock ─────────────────────────────────────────────────────────────

interface SubRow {
  status: string;
  credits_balance: number;
  reset_at: string | null;
}

let subRow: SubRow = { status: "active", credits_balance: 600_000, reset_at: "2026-07-01T00:00:00Z" };
let subFound = true;
let subError = false;

function makeMockClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => {
            if (subError) return Promise.resolve({ data: null, error: { message: "db transport error" } });
            if (!subFound) return Promise.resolve({ data: null, error: null });
            return Promise.resolve({ data: subRow, error: null });
          },
        }),
      }),
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => makeMockClient() }));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-proxy-secret-balance-xyz";
const TEST_LICENSE = "TEST-LICENSE-BALANCE-001";

async function makeValidToken() {
  return (await buildToken(TEST_LICENSE, TEST_SECRET)).token;
}

function fakeContext(authHeader: string | null, origin?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["Authorization"] = authHeader;
  if (origin) headers["Origin"] = origin;
  return {
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
      SUPABASE_ANON_KEY: "placeholder-anon",
      PROXY_SESSION_SECRET: TEST_SECRET,
    },
    request: new Request("https://writersnook.app/api/ai/balance", {
      method: "GET",
      headers,
    }),
  } as unknown as Parameters<typeof onRequestGet>[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/ai/balance contract", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 600_000, reset_at: "2026-07-01T00:00:00Z" };
    subFound = true;
    subError = false;
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

  it("returns 401 for an expired token (TTL past)", async () => {
    const pastNow = Date.now() - 5 * 60 * 60 * 1000;
    const { token } = await buildToken(TEST_LICENSE, TEST_SECRET, pastNow);
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct shape for valid token + active sub", async () => {
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["creditsBalance"]).toBe(600_000);
    expect(body["monthlyAllowance"]).toBe(MONTHLY_ALLOWANCE);
    expect(body["resetAt"]).toBe("2026-07-01T00:00:00Z");
    expect(body["status"]).toBe("active");
  });

  it("returns resetAt: '' (empty string) when reset_at is null — never returns null or 'null'", async () => {
    subRow = { status: "active", credits_balance: 600_000, reset_at: null };
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["resetAt"]).toBe("");
    expect(body["resetAt"]).not.toBeNull();
  });

  it("returns status: 'expired' when subscription status is not active", async () => {
    subRow = { status: "expired", credits_balance: 0, reset_at: null };
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["status"]).toBe("expired");
  });

  it("returns 401 when no subscription row is found (key not registered)", async () => {
    subFound = false;
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 500 when the DB query returns a transport/query error", async () => {
    subError = true;
    const token = await makeValidToken();
    const ctx = fakeContext(`Bearer ${token}`);
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(500);
  });
});

describe("OPTIONS /api/ai/balance (CORS preflight)", () => {
  function fakeOptionsContext(origin?: string) {
    const headers: Record<string, string> = {};
    if (origin) headers["Origin"] = origin;
    return {
      env: {},
      request: new Request("https://writersnook.app/api/ai/balance", {
        method: "OPTIONS",
        headers,
      }),
    } as unknown as Parameters<typeof onRequestOptions>[0];
  }

  it("OPTIONS with an allowlisted origin returns 204 with GET in Allow-Methods", async () => {
    const res = await onRequestOptions(fakeOptionsContext("http://localhost:1420"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:1420");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("OPTIONS with no origin returns 204 without ACAO header", async () => {
    const res = await onRequestOptions(fakeOptionsContext());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
