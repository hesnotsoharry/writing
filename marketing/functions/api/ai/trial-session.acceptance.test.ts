/**
 * Orchestrator-owned acceptance test — Wave 39 Phase 2: POST /api/ai/trial-session.
 *
 * The implementer may NOT modify this file. It pins the boundary contract the app
 * (Phase 3) consumes. Mirrors the mock pattern in session.test.ts, extended with a
 * tracked .rpc() so we can assert grant_trial is (or is not) called.
 *
 * Contract under test:
 *   - First grant   (no trialKey, TRIAL_AI_ENABLED='true', grant_trial → key):
 *       200 { trialKey, token, expiresAt, allowance: 150000 }; token = payload.sig;
 *       grant_trial called with p_allowance=150000, p_ip_cap=3.
 *   - Re-exchange    (trialKey present → status='trial' row):
 *       200 { token, expiresAt }; grant_trial NOT called (re-exchange spends no new budget).
 *   - Kill-switch off (TRIAL_AI_ENABLED!=='true', first grant):
 *       403 { error: 'trial_disabled' }; grant_trial NOT called.
 *   - Per-IP cap hit (grant_trial → null):
 *       429 { error: 'trial_ip_capped' }.
 *   - Re-exchange of an unknown / non-trial key:
 *       401 (client clears the stale key, re-runs first-use).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./trial-session";

// ── Supabase mock ─────────────────────────────────────────────────────────────
let subRow: { status: string } | null = { status: "trial" };
let subErr: { code?: string; message: string } | null = null;
let grantResult: string | null = "trial_generated_key_001";
let rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

function makeMockClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: subRow, error: subErr }),
        }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "grant_trial") return Promise.resolve({ data: grantResult, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => makeMockClient() }));

const TEST_SECRET = "test-proxy-secret-abc123";

function ctx(body: unknown, envOverride: Record<string, string> = {}) {
  return {
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
      SUPABASE_ANON_KEY: "placeholder-anon",
      LEMON_SQUEEZY_SIGNING_SECRET: "placeholder-ls",
      ANTHROPIC_API_KEY: "placeholder-anthropic",
      PROXY_SESSION_SECRET: TEST_SECRET,
      IP_HASH_SECRET: "test-ip-hash-secret",
      TRIAL_AI_ENABLED: "true",
      ...envOverride,
    },
    request: new Request("https://writersnook.app/api/ai/trial-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe("POST /api/ai/trial-session contract", () => {
  beforeEach(() => {
    subRow = { status: "trial" };
    subErr = null;
    grantResult = "trial_generated_key_001";
    rpcCalls = [];
  });

  it("first grant → 200 {trialKey, token, expiresAt, allowance:150000}; grant_trial gets the right caps", async () => {
    const res = await onRequestPost(ctx({}));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      trialKey: string;
      token: string;
      expiresAt: number;
      allowance: number;
    };
    expect(typeof body.trialKey).toBe("string");
    expect(body.trialKey.length).toBeGreaterThan(0);
    expect(body.token.split(".")).toHaveLength(2);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(body.allowance).toBe(150_000);

    const grant = rpcCalls.find((c) => c.fn === "grant_trial");
    expect(grant).toBeDefined();
    expect(grant?.args.p_allowance).toBe(150_000);
    expect(grant?.args.p_ip_cap).toBe(3);
  });

  it("re-exchange of a valid trial key → 200 {token}; grant_trial NOT called", async () => {
    subRow = { status: "trial" };
    const res = await onRequestPost(ctx({ trialKey: "trial_existing_key" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresAt: number };
    expect(body.token.split(".")).toHaveLength(2);
    expect(rpcCalls.find((c) => c.fn === "grant_trial")).toBeUndefined();
  });

  it("kill-switch off → 403 {error:'trial_disabled'}; grant_trial NOT called", async () => {
    const res = await onRequestPost(ctx({}, { TRIAL_AI_ENABLED: "false" }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("trial_disabled");
    expect(rpcCalls.find((c) => c.fn === "grant_trial")).toBeUndefined();
  });

  it("per-IP cap hit (grant_trial → null) → 429 {error:'trial_ip_capped'}", async () => {
    grantResult = null;
    const res = await onRequestPost(ctx({}));
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("trial_ip_capped");
  });

  it("re-exchange of an unknown / non-trial key → 401", async () => {
    subRow = null;
    subErr = { code: "PGRST116", message: "no rows" };
    const res = await onRequestPost(ctx({ trialKey: "trial_bogus" }));
    expect(res.status).toBe(401);
  });
});
