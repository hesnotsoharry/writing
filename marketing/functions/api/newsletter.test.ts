// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — newsletter endpoint (m4 Phase 5).
// The implementer MUST make this pass and MUST NOT modify it.
//   POST /api/newsletter { email }:
//     - valid    -> upsert into `newsletter_subscribers` (onConflict email so a
//                   re-subscribe is a benign success), returns 200 {ok:true}.
//     - invalid/missing email -> 400, no write.
// Supabase is mocked at the boundary; the live UNIQUE(email) + RLS are exercised
// once provisioned. The endpoint uses the service-role client.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./newsletter";

let upsertCalls: Array<{ table: string; row: unknown; options: unknown }> = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      upsert: (row: unknown, options: unknown) => {
        upsertCalls.push({ table, row, options });
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));

function ctx(body: unknown) {
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
    },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe("POST /api/newsletter", () => {
  beforeEach(() => {
    upsertCalls = [];
  });

  it("subscribes a valid email and returns ok", async () => {
    const res = await onRequestPost(ctx({ email: "nina@writer.com" }));
    expect(res.status).toBe(200);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].table).toBe("newsletter_subscribers");
    expect(upsertCalls[0].row).toMatchObject({ email: "nina@writer.com" });
  });

  it("treats a re-subscribe as a benign success (upsert keyed on the email conflict)", async () => {
    const res = await onRequestPost(ctx({ email: "dup@writer.com" }));
    expect(res.status).toBe(200);
    expect(JSON.stringify(upsertCalls[0].options)).toContain("email"); // onConflict target
  });

  it("rejects an invalid or missing email with 400 and writes nothing", async () => {
    expect((await onRequestPost(ctx({ email: "nope" }))).status).toBe(400);
    expect((await onRequestPost(ctx({}))).status).toBe(400);
    expect((await onRequestPost(ctx({ email: "user@host..com" }))).status).toBe(400); // consecutive-dot domain
    expect(upsertCalls).toHaveLength(0);
  });
});
