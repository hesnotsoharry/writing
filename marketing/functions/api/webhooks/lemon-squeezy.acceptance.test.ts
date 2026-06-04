// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — Phase 2 webhook contract.
// The implementer MUST make this pass and MUST NOT modify it. It expresses the
// Lemon Squeezy `order_created` webhook contract from the consumer's side:
//   - valid X-Signature (HMAC-SHA256 of the RAW body) -> 200 + purchases upsert
//   - invalid/absent signature                        -> 401 + NO db write
//   - upsert is keyed on order_id (the durable idempotency guarantee)
// Supabase is mocked at the boundary; the live "exactly one row" guarantee is
// the DB unique constraint on order_id, verified live once provisioned.
// ============================================================================
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./lemon-squeezy";

const TEST_SECRET = "test-signing-secret-abc123";

// Captures the most recent upsert payload so tests can assert on it.
let upsertCalls: Array<{ table: string; row: unknown; options: unknown }> = [];

function makeMockClient() {
  return {
    from: (table: string) => ({
      upsert: (row: unknown, options: unknown) => {
        upsertCalls.push({ table, row, options });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 1 }, error: null }),
          }),
        };
      },
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeMockClient(),
}));

// Minimal order_created payload per LS JSON:API shape (research §3).
function orderCreatedBody(orderId = "9999") {
  return JSON.stringify({
    meta: { event_name: "order_created" },
    data: {
      type: "orders",
      id: orderId,
      attributes: {
        user_email: "buyer@example.com",
        user_name: "Test Buyer",
        total: "4900",
        first_order_item: {
          product_name: "Writers Nook",
          license_key: "WNOOK-TEST-KEY-0001",
        },
        created_at: "2026-06-04T12:00:00.000000Z",
      },
    },
  });
}

function sign(body: string, secret = TEST_SECRET) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function postRequest(body: string, signature: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Event-Name": "order_created",
  };
  if (signature !== null) headers["X-Signature"] = signature;
  return new Request("https://writersnook.app/api/webhooks/lemon-squeezy", {
    method: "POST",
    headers,
    body,
  });
}

function ctx(request: Request) {
  return {
    request,
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role",
      SUPABASE_ANON_KEY: "placeholder-anon",
      LEMON_SQUEEZY_SIGNING_SECRET: TEST_SECRET,
    },
  } as unknown as Parameters<typeof onRequestPost>[0];
}

describe("Lemon Squeezy order_created webhook contract", () => {
  beforeEach(() => {
    upsertCalls = [];
  });

  it("accepts a correctly-signed order_created and upserts a purchase", async () => {
    const body = orderCreatedBody();
    const res = await onRequestPost(ctx(postRequest(body, sign(body))));

    expect(res.status).toBe(200);
    expect(upsertCalls).toHaveLength(1);

    const { table, row, options } = upsertCalls[0];
    expect(table).toBe("purchases");
    // The row carries the buyer's identity + license from the payload.
    expect(row).toMatchObject({
      email: "buyer@example.com",
      order_id: "9999",
      license_key: "WNOOK-TEST-KEY-0001",
    });
    // Idempotency: upsert conflict target is order_id.
    expect(JSON.stringify(options)).toContain("order_id");
  });

  it("rejects an invalid signature with 401 and writes nothing", async () => {
    const body = orderCreatedBody();
    const res = await onRequestPost(ctx(postRequest(body, "deadbeef")));

    expect(res.status).toBe(401);
    expect(upsertCalls).toHaveLength(0);
  });

  it("rejects a missing signature with 401 and writes nothing", async () => {
    const body = orderCreatedBody();
    const res = await onRequestPost(ctx(postRequest(body, null)));

    expect(res.status).toBe(401);
    expect(upsertCalls).toHaveLength(0);
  });

  it("is idempotent: the same order upserts on the order_id key (no duplicate insert)", async () => {
    const body = orderCreatedBody("12345");
    await onRequestPost(ctx(postRequest(body, sign(body))));
    await onRequestPost(ctx(postRequest(body, sign(body))));

    // Both calls go through upsert (not insert) keyed on order_id — the DB
    // unique constraint collapses them to one row at the live boundary.
    expect(upsertCalls).toHaveLength(2);
    for (const call of upsertCalls) {
      expect(JSON.stringify(call.options)).toContain("order_id");
    }
  });
});
