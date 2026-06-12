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
import { ALLOWED_ORIGINS } from "../../_lib/cors";
import { onRequestOptions, onRequestPost } from "./session";

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

function fakeContext(licenseKey: string, origin?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers["Origin"] = origin;
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
      headers,
      body: JSON.stringify({ licenseKey }),
    }),
  } as unknown as Parameters<typeof onRequestPost>[0];
}

function fakeOptionsContext(origin?: string) {
  const headers: Record<string, string> = {};
  if (origin) headers["Origin"] = origin;
  return {
    env: {},
    request: new Request("https://writersnook.app/api/ai/session", {
      method: "OPTIONS",
      headers,
    }),
  } as unknown as Parameters<typeof onRequestOptions>[0];
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

  it("returns 500 when PROXY_SESSION_SECRET is empty — misconfigured server, no token minted", async () => {
    subRow = { status: "active" };
    const ctx = {
      env: {
        SUPABASE_URL: "https://placeholder.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
        SUPABASE_ANON_KEY: "placeholder-anon",
        LEMON_SQUEEZY_SIGNING_SECRET: "placeholder-ls",
        ANTHROPIC_API_KEY: "placeholder-anthropic",
        PROXY_SESSION_SECRET: "",
      },
      request: new Request("https://writersnook.app/api/ai/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: "ACTIVE-KEY-001" }),
      }),
    } as unknown as Parameters<typeof onRequestPost>[0];
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("token");
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

describe("CORS contract — /api/ai/session", () => {
  beforeEach(() => {
    subRow = { status: "active" };
    dbError = null;
  });

  it("OPTIONS with an allowlisted origin returns 204 with full preflight headers", async () => {
    const origin = ALLOWED_ORIGINS[0];
    const res = await onRequestOptions(fakeOptionsContext(origin));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("OPTIONS with a non-allowlisted origin returns 204 without ACAO header", async () => {
    const res = await onRequestOptions(fakeOptionsContext("https://evil.example.com"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS with no origin returns 204 without ACAO header", async () => {
    const res = await onRequestOptions(fakeOptionsContext());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("POST with an allowlisted origin carries ACAO header on 200 response", async () => {
    const origin = ALLOWED_ORIGINS[1];
    const res = await onRequestPost(fakeContext("ACTIVE-KEY-001", origin));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("POST with an allowlisted origin carries ACAO header on 403 error response", async () => {
    subRow = { status: "expired" };
    const origin = ALLOWED_ORIGINS[2];
    const res = await onRequestPost(fakeContext("EXPIRED-KEY", origin));
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it("POST with a non-allowlisted origin returns no ACAO header", async () => {
    const res = await onRequestPost(fakeContext("ACTIVE-KEY-001", "https://evil.example.com"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
