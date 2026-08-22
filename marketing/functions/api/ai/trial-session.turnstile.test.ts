// ============================================================================
// Turnstile Phase 1 (permissive rollout) coverage for POST /api/ai/trial-session.
// Not orchestrator-owned — implementer-authored, alongside the pinned contract
// in trial-session.acceptance.test.ts (which this file does not modify).
//
// Contract under test (FIRST GRANT path only — re-exchange never checks Turnstile):
//   - TURNSTILE_SECRET_KEY unset                         -> today's behavior, grant.
//   - secret set, valid token                            -> 200, grant proceeds.
//   - secret set, invalid token                          -> 403 {error:'turnstile_failed'}.
//   - secret set, no token, TURNSTILE_ENFORCED='true'     -> 403 {error:'update_required'}.
//   - secret set, no token, TURNSTILE_ENFORCED!=='true'   -> 200, grant proceeds (permissive).
//   - re-exchange (trialKey present) never calls verifyTurnstileToken.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstileToken } from "../../_lib/turnstile";
import { onRequestPost } from "./trial-session";

let subRow: { status: string } | null = { status: "trial" };
let grantResult: string | null = "trial_generated_key_001";

function makeMockClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: subRow, error: null }),
        }),
      }),
    }),
    rpc: (fn: string) => {
      if (fn === "grant_trial") return Promise.resolve({ data: grantResult, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => makeMockClient() }));
vi.mock("../../_lib/turnstile", () => ({ verifyTurnstileToken: vi.fn() }));

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

describe("POST /api/ai/trial-session — Turnstile Phase 1", () => {
  beforeEach(() => {
    subRow = { status: "trial" };
    grantResult = "trial_generated_key_001";
    vi.mocked(verifyTurnstileToken).mockReset();
  });

  it("secret unset -> grants without ever calling verifyTurnstileToken", async () => {
    const res = await onRequestPost(ctx({}));
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("secret set + valid token -> 200, verifies against the secret and IP", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: true });
    const res = await onRequestPost(
      ctx({ turnstileToken: "good-tok" }, { TURNSTILE_SECRET_KEY: "test-secret" }),
    );
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).toHaveBeenCalledWith("good-tok", "test-secret", "203.0.113.7");
  });

  it("secret set + invalid token -> 403 {error:'turnstile_failed'}; no grant", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: false, errorCodes: ["invalid"] });
    const res = await onRequestPost(
      ctx({ turnstileToken: "bad-tok" }, { TURNSTILE_SECRET_KEY: "test-secret" }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("turnstile_failed");
  });

  it("secret set + no token + TURNSTILE_ENFORCED=true -> 403 update_required", async () => {
    const res = await onRequestPost(
      ctx({}, { TURNSTILE_SECRET_KEY: "test-secret", TURNSTILE_ENFORCED: "true" }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("update_required");
    expect(body.message).toContain("update WritersNook");
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("secret set + no token + TURNSTILE_ENFORCED not 'true' -> 200, permissive grant", async () => {
    const res = await onRequestPost(ctx({}, { TURNSTILE_SECRET_KEY: "test-secret" }));
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("re-exchange (trialKey present) never checks Turnstile, even with the secret + enforced set", async () => {
    const res = await onRequestPost(
      ctx(
        { trialKey: "trial_existing_key" },
        { TURNSTILE_SECRET_KEY: "test-secret", TURNSTILE_ENFORCED: "true" },
      ),
    );
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });
});
