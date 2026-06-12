/**
 * Seam tests for POST /api/webhooks/lemon-squeezy-subscription.
 *
 * Contracts under test:
 *   - Invalid HMAC → 401, no writes.
 *   - Unknown event → 200, no writes.
 *   - subscription_created: prefers LS-provided license key (PRIMARY path, LS-mint active).
 *       Falls back to WN-AI- self-mint when payload has no key (dormant fallback).
 *   - subscription_payment_success: calls reset_credits (balance := MONTHLY_ALLOWANCE).
 *   - subscription_expired: upserts status='expired'; balance is NOT touched (frozen).
 *   - Out-of-order: payment_success before created → converges on same row (idempotent).
 *   - Duplicate event (23505 in webhook_events) → 200, no double-credit write.
 *   - order_created matching top-up variant (LS_TOPUP_VARIANT_ID) → topup_credits called.
 *   - order_created matching subscription variant (LS_SUB_VARIANT_ID) → 200 no-op, ledger recorded.
 *   - order_created non-matching variant → 200 no-op, ledger recorded.
 *
 * Boundary: @supabase/supabase-js and verifySignature are mocked; no live calls.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MONTHLY_ALLOWANCE, TOPUP_PACK_AMOUNT } from "../../_lib/credits";
import { onRequestPost } from "./lemon-squeezy-subscription";

const TEST_SECRET = "test-sub-signing-secret-xyz";
const TEST_TOPUP_VARIANT = "1782092";
const TEST_SUB_VARIANT = "1782093";

// ── Supabase mock ─────────────────────────────────────────────────────────────

interface RpcCall { fn: string; args: Record<string, unknown> }

let ledger: Set<string>;
let rpcCalls: RpcCall[];
let subRows: Array<{ license_key: string; user_email: string }>;
let upsertRows: Array<Record<string, unknown>>;

function makeMockClient() {
  return {
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: string) => {
          void cols; void col;
          return {
            single: () => {
              const found = subRows.find((r) => r.user_email === val);
              return Promise.resolve(
                found
                  ? { data: found, error: null }
                  : { data: null, error: { message: "not found" } },
              );
            },
          };
        },
      }),
      insert: (row: { event_name: string; order_id: string }) => {
        const key = `${row.order_id}::${row.event_name}`;
        const dup = ledger.has(key);
        if (!dup) ledger.add(key);
        const result = dup
          ? { data: null, error: { code: "23505", message: "duplicate" } }
          : { data: { id: 1 }, error: null };
        return Promise.resolve(result);
      },
      upsert: (row: Record<string, unknown>, opts: unknown) => {
        void opts;
        if (table === "subscriptions") upsertRows.push(row);
        return {
          select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }),
        };
      },
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: args["p_license_key"] ?? "WN-AI-TEST", error: null });
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => makeMockClient() }));

// ── Signature helpers ─────────────────────────────────────────────────────────

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeEnv(topupVariant = TEST_TOPUP_VARIANT, subVariant = TEST_SUB_VARIANT) {
  return {
    SUPABASE_URL: "https://placeholder.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
    SUPABASE_ANON_KEY: "placeholder-anon",
    LEMON_SQUEEZY_SIGNING_SECRET: TEST_SECRET,
    LS_TOPUP_VARIANT_ID: topupVariant,
    LS_SUB_VARIANT_ID: subVariant,
  };
}

function makeContext(body: string, secret = TEST_SECRET, env = makeEnv()) {
  const sig = sign(body, secret);
  return {
    env,
    request: new Request("https://writersnook.app/api/webhooks/lemon-squeezy-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature": sig },
      body,
    }),
  } as unknown as Parameters<typeof onRequestPost>[0];
}

// ── Payload builders ──────────────────────────────────────────────────────────

function subPayload(
  eventName: string,
  subId = "sub_001",
  status = "active",
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    meta: { event_name: eventName },
    data: {
      type: "subscriptions",
      id: subId,
      attributes: {
        order_id: 9001,
        user_name: "Alice",
        user_email: "alice@example.com",
        status,
        renews_at: "2026-07-12T00:00:00Z",
        ends_at: null,
        updated_at: "2026-06-12T10:00:00Z",
        ...extra,
      },
    },
  });
}

function orderPayload(orderId: string, variantId: number, email = "alice@example.com") {
  return JSON.stringify({
    meta: { event_name: "order_created" },
    data: {
      type: "orders",
      id: orderId,
      attributes: {
        user_email: email,
        first_order_item: { variant_id: variantId, product_id: 5001 },
      },
    },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  ledger = new Set();
  rpcCalls = [];
  upsertRows = [];
  subRows = [{ license_key: "WN-AI-EXISTING", user_email: "alice@example.com" }];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HMAC verification", () => {
  it("returns 401 for an invalid signature", async () => {
    const body = subPayload("subscription_created");
    const ctx = makeContext(body, "wrong-secret");
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it("returns 200 for an unknown event without writing anything", async () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_paused" }, data: { type: "subscriptions", id: "sub_x", attributes: { updated_at: "2026-06-12T10:00:00Z" } } });
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("subscription_created", () => {
  // Primary path: LS-mint is active (verified 2026-06-12). The LS payload carries
  // the license key when "generate license key" is enabled on the subscription product.
  it("uses the LS-provided license key when present in the payload (primary path — LS-mint active)", async () => {
    const body = subPayload("subscription_created", "sub_002", "active", {
      license_key: "LS-PROVIDED-KEY-ABC",
    });
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const upsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(upsert).toBeDefined();
    expect(upsert!.args["p_license_key"]).toBe("LS-PROVIDED-KEY-ABC");
    expect(upsert!.args["p_ls_subscription_id"]).toBe("sub_002");
    expect(upsert!.args["p_status"]).toBe("active");
  });

  it("does NOT call reset_credits on subscription_created (balance starts at 0)", async () => {
    const body = subPayload("subscription_created", "sub_003", "active", {
      license_key: "LS-PROVIDED-KEY-DEF",
    });
    const ctx = makeContext(body);
    await onRequestPost(ctx);
    expect(rpcCalls.find((c) => c.fn === "reset_credits")).toBeUndefined();
  });

  // Dormant fallback: self-mint when LS payload carries no license_key.
  it("mints a WN-AI- key when payload has no license_key (self-mint dormant fallback)", async () => {
    const body = subPayload("subscription_created");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const upsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(upsert).toBeDefined();
    expect((upsert!.args["p_license_key"] as string).startsWith("WN-AI-")).toBe(true);
    expect(upsert!.args["p_ls_subscription_id"]).toBe("sub_001");
    expect(upsert!.args["p_status"]).toBe("active");
  });
});

describe("subscription_payment_success", () => {
  it("calls reset_credits with MONTHLY_ALLOWANCE after upsert", async () => {
    const body = subPayload("subscription_payment_success");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const reset = rpcCalls.find((c) => c.fn === "reset_credits");
    expect(reset).toBeDefined();
    expect(reset!.args["p_allowance"]).toBe(MONTHLY_ALLOWANCE);
  });

  it("sets status=active on the upserted row", async () => {
    const body = subPayload("subscription_payment_success");
    const ctx = makeContext(body);
    await onRequestPost(ctx);
    const upsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(upsert!.args["p_status"]).toBe("active");
  });
});

describe("subscription_expired — frozen balance", () => {
  it("sets status=expired and does NOT call reset_credits or topup_credits", async () => {
    const body = subPayload("subscription_expired", "sub_001", "expired");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const upsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(upsert!.args["p_status"]).toBe("expired");
    // Balance must not be touched — no reset or top-up
    expect(rpcCalls.find((c) => c.fn === "reset_credits")).toBeUndefined();
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
  });
});

describe("out-of-order delivery convergence", () => {
  it("payment_success before created: both events process; row ends up active with allowance", async () => {
    // payment_success arrives first — creates the row with a minted key
    const paymentBody = subPayload("subscription_payment_success", "sub_oo1");
    await onRequestPost(makeContext(paymentBody));
    const resetCall = rpcCalls.find((c) => c.fn === "reset_credits");
    expect(resetCall).toBeDefined();
    expect(resetCall!.args["p_allowance"]).toBe(MONTHLY_ALLOWANCE);

    // subscription_created arrives later — upserts; ON CONFLICT updates status/reset_at only
    rpcCalls = [];
    const createdBody = subPayload("subscription_created", "sub_oo1");
    await onRequestPost(makeContext(createdBody));
    const upsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(upsert).toBeDefined();
    // No second reset_credits — just the status update
    expect(rpcCalls.find((c) => c.fn === "reset_credits")).toBeUndefined();
  });
});

describe("duplicate event idempotency via webhook_events", () => {
  it("returns 200 without calling reset_credits on a duplicate payment_success event", async () => {
    const body = subPayload("subscription_payment_success", "sub_dup");
    const ctx1 = makeContext(body);
    await onRequestPost(ctx1);
    const firstResetCalls = rpcCalls.filter((c) => c.fn === "reset_credits").length;

    // Deliver the SAME event again (same idempotency key → 23505)
    rpcCalls = [];
    const ctx2 = makeContext(body);
    const res = await onRequestPost(ctx2);
    expect(res.status).toBe(200);
    // reset_credits must NOT be called again
    expect(rpcCalls.filter((c) => c.fn === "reset_credits")).toHaveLength(0);
    expect(firstResetCalls).toBe(1);
  });
});

describe("order_created — top-up pack", () => {
  it("calls topup_credits with TOPUP_PACK_AMOUNT for a matching top-up variant ID", async () => {
    const body = orderPayload("order_topup_001", Number(TEST_TOPUP_VARIANT));
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const topup = rpcCalls.find((c) => c.fn === "topup_credits");
    expect(topup).toBeDefined();
    expect(topup!.args["p_amount"]).toBe(TOPUP_PACK_AMOUNT);
    expect(topup!.args["p_license_key"]).toBe("WN-AI-EXISTING");
  });

  it("returns 200 without calling topup_credits for a subscription-variant order (no-op, ledger recorded)", async () => {
    const body = orderPayload("order_sub_001", Number(TEST_SUB_VARIANT));
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
    // Idempotency: sending it again returns 200 without writing anything new
    rpcCalls = [];
    const res2 = await onRequestPost(makeContext(body));
    expect(res2.status).toBe(200);
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
  });

  it("returns 200 without calling topup_credits for an unknown-variant order (no-op, ledger recorded)", async () => {
    const body = orderPayload("order_other_001", 9999999);
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
  });

  it("duplicate top-up order is idempotent via webhook_events", async () => {
    const body = orderPayload("order_topup_dup", Number(TEST_TOPUP_VARIANT));
    await onRequestPost(makeContext(body));
    const firstCalls = rpcCalls.filter((c) => c.fn === "topup_credits").length;

    rpcCalls = [];
    await onRequestPost(makeContext(body));
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
    expect(firstCalls).toBe(1);
  });
});
