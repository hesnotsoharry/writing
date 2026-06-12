/**
 * Seam tests for POST /api/webhooks/lemon-squeezy-subscription.
 *
 * Contracts under test:
 *   - Invalid HMAC → 401, no writes.
 *   - Unknown event → 200, no writes.
 *   - subscription_created: fetches license key from LS API (Bug A fix).
 *       Stores the LS-fetched key, NOT a WN-AI- self-mint.
 *       LS API failure → 500 (retryable). Zero keys from API → WN-AI- self-mint fallback.
 *   - subscription_payment_success: uses data.attributes.subscription_id (Bug B fix).
 *       Resolves existing row; no row → 500.
 *       Convergence: resolves the SAME row subscription_created made (single row, not two).
 *   - subscription_expired: resolves existing row; updates status='expired'; balance frozen.
 *   - Duplicate event (23505 in webhook_events) → 200, no double-credit write.
 *   - order_created matching top-up variant (LS_TOPUP_VARIANT_ID) → topup_credits called.
 *   - order_created matching subscription variant (LS_SUB_VARIANT_ID) → 200 no-op, ledger recorded.
 *   - order_created non-matching variant → 200 no-op, ledger recorded.
 *
 * Boundary: @supabase/supabase-js and fetch are mocked; no live calls.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MONTHLY_ALLOWANCE, TOPUP_PACK_AMOUNT } from "../../_lib/credits";
import { onRequestPost } from "./lemon-squeezy-subscription";

const TEST_SECRET = "test-sub-signing-secret-xyz";
const TEST_TOPUP_VARIANT = "1782092";
const TEST_SUB_VARIANT = "1782093";
const TEST_LS_API_KEY = "test-ls-api-key";

// ── Fetch mock (LS license-keys API) ─────────────────────────────────────────
// Supabase is mocked via vi.mock; the global fetch is only called by fetchLsLicenseKey.

let mockFetch = vi.fn();
vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => mockFetch(...args));

function lsApiSuccess(key: string) {
  return {
    ok: true,
    json: async () => ({ data: [{ attributes: { key } }] }),
  };
}

function lsApiEmpty() {
  return {
    ok: true,
    json: async () => ({ data: [] }),
  };
}

function lsApiError() {
  return { ok: false, status: 500 };
}

// ── Supabase mock ─────────────────────────────────────────────────────────────

interface RpcCall { fn: string; args: Record<string, unknown> }
interface UpdateCall { table: string; data: Record<string, unknown>; col: string; val: string }
interface SubRow { license_key: string; user_email: string; ls_subscription_id: string }

let ledger: Set<string>;
let rpcCalls: RpcCall[];
let upsertRows: Array<Record<string, unknown>>;
let updateCalls: UpdateCall[];
let subRows: SubRow[];

function makeMockClient() {
  return {
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: string) => {
          void cols;
          return {
            single: () => {
              const found = subRows.find((r) => (r as unknown as Record<string, string>)[col] === val);
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
      update: (data: Record<string, unknown>) => ({
        eq: (col: string, val: string) => {
          updateCalls.push({ table, data, col, val });
          return Promise.resolve({ error: null });
        },
      }),
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
    LS_API_KEY: TEST_LS_API_KEY,
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

// subscription_payment_success uses invoice payloads (data.type = "subscription-invoices").
// Bug B fix: subscription_id is at data.attributes.subscription_id, NOT data.id.
function invoicePayload(subId = "sub_001", invoiceId = "inv_001") {
  return JSON.stringify({
    meta: { event_name: "subscription_payment_success" },
    data: {
      type: "subscription-invoices",
      id: invoiceId,
      attributes: {
        subscription_id: subId,
        updated_at: "2026-06-12T10:00:00Z",
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
  // Default: LS API returns a key for any order
  mockFetch = vi.fn().mockResolvedValue(lsApiSuccess("LS-KEY-FROM-API"));
  ledger = new Set();
  rpcCalls = [];
  upsertRows = [];
  updateCalls = [];
  // sub_001 is the default row — non-created events resolve against ls_subscription_id
  subRows = [{ license_key: "WN-AI-EXISTING", user_email: "alice@example.com", ls_subscription_id: "sub_001" }];
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
  // Bug A fix: LS does NOT include license keys in subscription webhook payloads.
  // The handler fetches the key from GET /v1/license-keys?filter[order_id]={id}.
  it("fetches the license key from the LS API and stores the returned key (not WN-AI-)", async () => {
    mockFetch = vi.fn().mockResolvedValue(lsApiSuccess("LS-REAL-KEY-XYZ"));
    const body = subPayload("subscription_created", "sub_002", "active");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect((mockFetch.mock.calls[0][0] as string)).toContain("license-keys");
    const upsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(upsert).toBeDefined();
    expect(upsert!.args["p_license_key"]).toBe("LS-REAL-KEY-XYZ");
    expect((upsert!.args["p_license_key"] as string).startsWith("WN-AI-")).toBe(false);
    expect(upsert!.args["p_ls_subscription_id"]).toBe("sub_002");
    expect(upsert!.args["p_status"]).toBe("active");
  });

  it("returns 500 when the LS API returns a non-200 response (LS retries)", async () => {
    mockFetch = vi.fn().mockResolvedValue(lsApiError());
    const body = subPayload("subscription_created", "sub_apifail");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
    // No row should be created
    expect(rpcCalls.find((c) => c.fn === "upsert_subscription")).toBeUndefined();
  });

  it("returns 500 when the LS API call throws a network error (LS retries)", async () => {
    mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
    const body = subPayload("subscription_created", "sub_networkerr");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
    expect(rpcCalls.find((c) => c.fn === "upsert_subscription")).toBeUndefined();
  });

  it("mints a WN-AI- key when LS API returns zero keys (self-mint fallback for no-license-key products)", async () => {
    mockFetch = vi.fn().mockResolvedValue(lsApiEmpty());
    const body = subPayload("subscription_created", "sub_nokey");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const upsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(upsert).toBeDefined();
    expect((upsert!.args["p_license_key"] as string).startsWith("WN-AI-")).toBe(true);
    expect(upsert!.args["p_ls_subscription_id"]).toBe("sub_nokey");
  });

  it("does NOT call reset_credits on subscription_created (balance starts at 0)", async () => {
    const body = subPayload("subscription_created", "sub_003", "active");
    const ctx = makeContext(body);
    await onRequestPost(ctx);
    expect(rpcCalls.find((c) => c.fn === "reset_credits")).toBeUndefined();
  });
});

describe("subscription_payment_success", () => {
  // Bug B fix: payload data is a subscription-invoice; sub id is at
  // data.attributes.subscription_id, NOT data.id (which is the invoice id).
  it("calls reset_credits with MONTHLY_ALLOWANCE using the resolved row's license key", async () => {
    const body = invoicePayload("sub_001", "inv_pay_001");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const reset = rpcCalls.find((c) => c.fn === "reset_credits");
    expect(reset).toBeDefined();
    expect(reset!.args["p_allowance"]).toBe(MONTHLY_ALLOWANCE);
    expect(reset!.args["p_license_key"]).toBe("WN-AI-EXISTING");
  });

  it("resolves the SAME row that subscription_created made — convergence via attributes.subscription_id", async () => {
    // subscription_created for sub_001 (already in subRows representing DB state)
    const createdBody = subPayload("subscription_created", "sub_001", "active");
    await onRequestPost(makeContext(createdBody));
    const createdUpsert = rpcCalls.find((c) => c.fn === "upsert_subscription");
    expect(createdUpsert!.args["p_ls_subscription_id"]).toBe("sub_001");

    // payment_success for sub_001 — invoice id differs; subscription_id is sub_001
    rpcCalls = [];
    const payBody = invoicePayload("sub_001", "inv_pay_conv");
    const res = await onRequestPost(makeContext(payBody));
    expect(res.status).toBe(200);
    const reset = rpcCalls.find((c) => c.fn === "reset_credits");
    expect(reset).toBeDefined();
    // Resolved via the same ls_subscription_id — same license_key, single row
    expect(reset!.args["p_license_key"]).toBe("WN-AI-EXISTING");
  });

  it("returns 500 when payment_success arrives before subscription_created (out-of-order retryable)", async () => {
    // No row exists for this sub ID in subRows
    const body = invoicePayload("sub_UNKNOWN_OO", "inv_oo_001");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
    // No reset_credits call — no row was found or created
    expect(rpcCalls.find((c) => c.fn === "reset_credits")).toBeUndefined();
    expect(rpcCalls.find((c) => c.fn === "upsert_subscription")).toBeUndefined();
  });
});

describe("subscription_expired — frozen balance", () => {
  it("sets status=expired via a direct update (not upsert) and does NOT call reset_credits", async () => {
    const body = subPayload("subscription_expired", "sub_001", "expired");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    // No upsert_subscription RPC — expired never creates a row
    expect(rpcCalls.find((c) => c.fn === "upsert_subscription")).toBeUndefined();
    // Status updated via table update, not RPC
    const expiredUpdate = updateCalls.find((c) => c.data["status"] === "expired");
    expect(expiredUpdate).toBeDefined();
    expect(expiredUpdate!.col).toBe("ls_subscription_id");
    expect(expiredUpdate!.val).toBe("sub_001");
    // Balance must not be touched
    expect(rpcCalls.find((c) => c.fn === "reset_credits")).toBeUndefined();
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
  });

  it("returns 500 when subscription_expired arrives before subscription_created (out-of-order retryable)", async () => {
    const body = subPayload("subscription_expired", "sub_EXPIRED_OO", "expired");
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(500);
    expect(updateCalls).toHaveLength(0);
  });
});

describe("duplicate event idempotency via webhook_events", () => {
  it("returns 200 without calling reset_credits on a duplicate payment_success event", async () => {
    const body = invoicePayload("sub_001", "inv_dup_001");
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
