// ============================================================================
// Turnstile coverage for POST /api/newsletter. Not orchestrator-owned —
// implementer-authored, alongside the pinned contract in newsletter.test.ts
// (which this file does not modify). Enforced only when TURNSTILE_SECRET_KEY
// is set (deploys in lockstep with the form's widget) — unset behaves exactly
// as today, proven by the unmodified newsletter.test.ts continuing to pass.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./newsletter";
import { verifyTurnstileToken } from "../_lib/turnstile";

let upsertCalls: Array<{ table: string; row: unknown }> = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      upsert: (row: unknown) => {
        upsertCalls.push({ table, row });
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));
vi.mock("../_lib/turnstile", () => ({ verifyTurnstileToken: vi.fn() }));

function ctx(body: unknown, envOverride: Record<string, string> = {}) {
  return {
    request: new Request("https://writersnook.app/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role",
      SUPABASE_ANON_KEY: "placeholder-anon",
      ...envOverride,
    },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe("POST /api/newsletter — Turnstile", () => {
  beforeEach(() => {
    upsertCalls = [];
    vi.mocked(verifyTurnstileToken).mockReset();
  });

  it("secret set + missing token -> 400, no write, no verify call", async () => {
    const res = await onRequestPost(
      ctx({ email: "nina@writer.com" }, { TURNSTILE_SECRET_KEY: "test-secret" }),
    );
    expect(res.status).toBe(400);
    expect(upsertCalls).toHaveLength(0);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("secret set + invalid token -> 403, no write", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: false });
    const res = await onRequestPost(
      ctx(
        { email: "nina@writer.com", turnstileToken: "bad" },
        { TURNSTILE_SECRET_KEY: "test-secret" },
      ),
    );
    expect(res.status).toBe(403);
    expect(upsertCalls).toHaveLength(0);
  });

  it("secret set + valid token -> 200, upserts", async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: true });
    const res = await onRequestPost(
      ctx(
        { email: "nina@writer.com", turnstileToken: "good" },
        { TURNSTILE_SECRET_KEY: "test-secret" },
      ),
    );
    expect(res.status).toBe(200);
    expect(upsertCalls).toHaveLength(1);
  });

  it("secret unset -> passes as today even with no token, and never calls verify", async () => {
    const res = await onRequestPost(ctx({ email: "nina@writer.com" }));
    expect(res.status).toBe(200);
    expect(upsertCalls).toHaveLength(1);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });
});
