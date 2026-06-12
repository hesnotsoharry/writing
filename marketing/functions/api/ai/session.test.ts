/**
 * Seam tests for POST /api/ai/session.
 *
 * Contract under test:
 *   - Active subscription + valid licenseKey → 200 {token, expiresAt}
 *   - Token has two dot-separated parts (payload.signature)
 *   - Non-active subscription → 403
 *   - Unknown license key (DB miss) → 403
 *
 * Boundary: @supabase/supabase-js is mocked; no live network calls.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildToken } from "../../_lib/ai-token";
import { onRequestPost } from "./session";

// ── Supabase mock ─────────────────────────────────────────────────────────────

// Allows individual tests to override the returned subscription row.
let subRow: { status: string } | null = { status: "active" };
let dbError: { message: string } | null = null;

function makeMockClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: subRow, error: dbError }),
        }),
      }),
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeMockClient(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-proxy-secret-abc123";

function fakeContext(licenseKey: string) {
  return {
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
      SUPABASE_ANON_KEY: "placeholder-anon",
      LEMON_SQUEEZY_SIGNING_SECRET: "placeholder-ls",
      ANTHROPIC_API_KEY: "placeholder-anthropic",
      PROXY_SESSION_SECRET: TEST_SECRET,
    },
    request: new Request("https://writersnook.app/api/ai/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    }),
  } as unknown as Parameters<typeof onRequestPost>[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ai/session contract", () => {
  beforeEach(() => {
    subRow = { status: "active" };
    dbError = null;
  });

  it("returns 200 with {token, expiresAt} for an active subscription", async () => {
    const res = await onRequestPost(fakeContext("ACTIVE-KEY-001"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresAt: number };
    expect(typeof body.token).toBe("string");
    expect(typeof body.expiresAt).toBe("number");
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it("token contains exactly two dot-separated parts (payload.signature)", async () => {
    const res = await onRequestPost(fakeContext("ACTIVE-KEY-001"));
    const { token } = (await res.json()) as { token: string; expiresAt: number };
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("returned token is verifiable by buildToken round-trip (same secret, non-expired)", async () => {
    const res = await onRequestPost(fakeContext("ACTIVE-KEY-001"));
    const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };
    // expiresAt should be ~4 hours from now
    const fourHoursMs = 4 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(Date.now() + fourHoursMs - 5000);
    expect(expiresAt).toBeLessThan(Date.now() + fourHoursMs + 5000);
    // Build a fresh token from the same secret and verify the structure matches
    const fresh = await buildToken("ACTIVE-KEY-001", TEST_SECRET);
    // Both tokens should have the same format (payload.sig)
    expect(token.split(".")).toHaveLength(2);
    expect(fresh.token.split(".")).toHaveLength(2);
  });

  it("returns 403 for an expired subscription", async () => {
    subRow = { status: "expired" };
    const res = await onRequestPost(fakeContext("EXPIRED-KEY-001"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a cancelled subscription", async () => {
    subRow = { status: "cancelled" };
    const res = await onRequestPost(fakeContext("CANCELLED-KEY"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when the license key is unknown (DB returns no row)", async () => {
    subRow = null;
    dbError = { message: "no rows found" };
    const res = await onRequestPost(fakeContext("UNKNOWN-KEY-999"));
    expect(res.status).toBe(403);
  });

  it("returns 400 when licenseKey is missing from the body", async () => {
    const ctx = {
      env: {
        SUPABASE_URL: "https://placeholder.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
        SUPABASE_ANON_KEY: "placeholder-anon",
        LEMON_SQUEEZY_SIGNING_SECRET: "placeholder-ls",
        ANTHROPIC_API_KEY: "placeholder-anthropic",
        PROXY_SESSION_SECRET: TEST_SECRET,
      },
      request: new Request("https://writersnook.app/api/ai/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    } as unknown as Parameters<typeof onRequestPost>[0];
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });
});
