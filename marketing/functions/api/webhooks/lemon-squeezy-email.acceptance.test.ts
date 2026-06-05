// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — webhook -> Resend email gating (m4 Phase 2).
// The implementer MUST make this pass and MUST NOT modify it. Contract:
//   - The confirmation email fires on the FIRST-TIME `license_key_created` ledger
//     insert (that event carries the real license key — D1), exactly once.
//   - It is gated on the ledger (D4/D5): a replayed license_key_created does NOT
//     re-send (the ledger's 23505 dedups the exactly-once effect).
//   - order_created / order_refunded do NOT send the confirmation email.
//   - The email payload carries the buyer's address and the license key.
// Both Supabase and the Resend helper are mocked at the boundary.
// ============================================================================
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./lemon-squeezy";
import { sendEmail } from "../../_lib/resend";

const TEST_SECRET = "test-signing-secret-abc123";

let ledger: Set<string>;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: { event_name: string; order_id: string }) => {
        const key = `${row.order_id}::${row.event_name}`;
        const dup = ledger.has(key);
        if (!dup) ledger.add(key);
        const result = dup
          ? { data: null, error: { code: "23505", message: "duplicate" } }
          : { data: { id: 1 }, error: null };
        return { select: () => ({ single: () => Promise.resolve(result) }), then: (r: (v: unknown) => unknown) => r(result) };
      },
      upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 1 }, error: null }) }) }),
    }),
  }),
}));

vi.mock("../../_lib/resend", () => ({ sendEmail: vi.fn(async () => ({ id: "email-1" })) }));

function licenseKeyCreatedBody(orderId = 9999, key = "WNOOK-REAL-KEY-7Q4M") {
  return JSON.stringify({
    meta: { event_name: "license_key_created" },
    data: {
      type: "license-keys",
      id: "1",
      attributes: { order_id: orderId, user_email: "buyer@example.com", user_name: "Test Buyer", key },
    },
  });
}

function orderCreatedBody(orderId = "9999") {
  return JSON.stringify({
    meta: { event_name: "order_created" },
    data: { type: "orders", id: orderId, attributes: { user_email: "buyer@example.com", user_name: "Buyer", total: "2900", status: "paid" } },
  });
}

function orderRefundedBody(orderId = "9999") {
  return JSON.stringify({
    meta: { event_name: "order_refunded" },
    data: { type: "orders", id: orderId, attributes: { user_email: "buyer@example.com", user_name: "Buyer", total: "2900", refunded_at: "2026-06-05T09:30:00.000000Z" } },
  });
}

function ctx(body: string, eventName: string) {
  const sig = createHmac("sha256", TEST_SECRET).update(body).digest("hex");
  const request = new Request("https://writersnook.app/api/webhooks/lemon-squeezy", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Event-Name": eventName, "X-Signature": sig },
    body,
  });
  return {
    request,
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder",
      SUPABASE_ANON_KEY: "placeholder",
      LEMON_SQUEEZY_SIGNING_SECRET: TEST_SECRET,
      RESEND_API_KEY: "re_test_realkey",
      RESEND_FROM: "Writers Nook <noreply@writersnook.app>",
    },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe("webhook -> Resend confirmation email gating (m4 Phase 2)", () => {
  beforeEach(() => {
    ledger = new Set();
    vi.mocked(sendEmail).mockClear();
  });

  it("sends the confirmation email once on the first license_key_created, with the key + buyer email", async () => {
    const res = await onRequestPost(ctx(licenseKeyCreatedBody(9999, "WNOOK-REAL-KEY-7Q4M"), "license_key_created"));
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const [, payload] = vi.mocked(sendEmail).mock.calls[0];
    const flat = JSON.stringify(payload);
    expect(flat).toContain("buyer@example.com");
    expect(flat).toContain("WNOOK-REAL-KEY-7Q4M");
  });

  it("does NOT re-send on a replayed license_key_created (ledger dedup gates the email)", async () => {
    await onRequestPost(ctx(licenseKeyCreatedBody(9999), "license_key_created"));
    await onRequestPost(ctx(licenseKeyCreatedBody(9999), "license_key_created")); // replay
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does NOT send the confirmation email on order_created", async () => {
    await onRequestPost(ctx(orderCreatedBody(), "order_created"));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does NOT send the confirmation email on order_refunded", async () => {
    await onRequestPost(ctx(orderRefundedBody(), "order_refunded"));
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
