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
/** Per-test RPC failure injection: fn name → error object to return as { data: null, error }. */
let rpcErrors: Map<string, { message: string; code?: string }>;

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
      const injectedErr = rpcErrors.get(fn);
      if (injectedErr) return Promise.resolve({ data: null, error: injectedErr });
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

function orderPayload(orderId: string, variantId: number, email = "alice@example.com", customLicenseKey?: string) {
  return JSON.stringify({
    meta: {
      event_name: "order_created",
      ...(customLicenseKey !== undefined ? { custom_data: { license_key: customLicenseKey } } : {}),
    },
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
  rpcErrors = new Map();
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
  // With the RPC-first ordering, reset_credits executes before the tombstone check.
  // On a duplicate delivery, reset_credits is called again before the tombstone 23505
  // short-circuits. That is safe: reset_credits uses SET credits_balance = p_allowance
  // (absolute, not +=), so re-calling it is a no-op in terms of credit value.
  it("returns 200 on a duplicate payment_success event (reset_credits idempotent via absolute SET)", async () => {
    const body = invoicePayload("sub_001", "inv_dup_001");
    await onRequestPost(makeContext(body));
    const firstResetCalls = rpcCalls.filter((c) => c.fn === "reset_credits").length;
    expect(firstResetCalls).toBe(1);
    const firstResetCall = rpcCalls.find((c) => c.fn === "reset_credits");
    const firstRequestId = firstResetCall?.args["p_request_id"];

    // Deliver the SAME event again (same idempotency key → 23505 on tombstone)
    rpcCalls = [];
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(200);
    // reset_credits may be called before the tombstone 23505 fires — that is acceptable
    // because it is idempotent (absolute SET). The no-double-credit invariant holds.
    const secondResetCall = rpcCalls.find((c) => c.fn === "reset_credits");
    expect(secondResetCall).toBeDefined();
    expect(secondResetCall!.args["p_request_id"]).toBe(firstRequestId);
  });
});

describe("order_created — top-up pack", () => {
  // Tier 2: no custom_data, email matches existing subscriber row → credits via resolved key.
  it("calls topup_credits with TOPUP_PACK_AMOUNT for a matching top-up variant ID (Tier 2 — email fallback)", async () => {
    const body = orderPayload("order_topup_001", Number(TEST_TOPUP_VARIANT));
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const topup = rpcCalls.find((c) => c.fn === "topup_credits");
    expect(topup).toBeDefined();
    expect(topup!.args["p_amount"]).toBe(TOPUP_PACK_AMOUNT);
    expect(topup!.args["p_license_key"]).toBe("WN-AI-EXISTING");
  });

  // Tier 1: meta.custom_data.license_key present → credits via that key, no email DB lookup needed.
  it("credits via meta.custom_data.license_key directly without an email DB lookup (Tier 1)", async () => {
    subRows = []; // intentionally empty — Tier 1 must NOT require a subscriber row
    const body = orderPayload("order_custom_001", Number(TEST_TOPUP_VARIANT), "any@example.com", "CUSTOM-AI-KEY-XYZ");
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(200);
    const topup = rpcCalls.find((c) => c.fn === "topup_credits");
    expect(topup).toBeDefined();
    expect(topup!.args["p_license_key"]).toBe("CUSTOM-AI-KEY-XYZ");
    expect(topup!.args["p_amount"]).toBe(TOPUP_PACK_AMOUNT);
    // If Tier 2 was incorrectly entered, the email lookup would fail (subRows=[]) and
    // return 200 via orphan — but topup would be undefined. topup being defined with the
    // custom key proves Tier 1 executed without any DB lookup.
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

  // With the RPC-first ordering, topup_credits executes before the tombstone check.
  // On a duplicate delivery, topup_credits is called again before the tombstone 23505
  // short-circuits. Double-credit is prevented by the SQL dedup guard added in
  // 0005_topup_credits_dedup.sql: when p_request_id matches an existing credit_events
  // row, the function returns the current balance as a no-op. The mock does not
  // implement the SQL guard, so we verify the handler contract: stable p_request_id.
  it("duplicate top-up order returns 200 via tombstone; p_request_id is stable for SQL dedup guard", async () => {
    const body = orderPayload("order_topup_dup", Number(TEST_TOPUP_VARIANT));
    await onRequestPost(makeContext(body));
    const firstCalls = rpcCalls.filter((c) => c.fn === "topup_credits").length;
    expect(firstCalls).toBe(1);
    const firstRequestId = rpcCalls.find((c) => c.fn === "topup_credits")!.args["p_request_id"];

    rpcCalls = [];
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(200);
    // If topup_credits is called on the retry, its p_request_id must match the first call
    // so the SQL dedup guard can detect and prevent the double-grant.
    const retryCall = rpcCalls.find((c) => c.fn === "topup_credits");
    if (retryCall) {
      expect(retryCall.args["p_request_id"]).toBe(firstRequestId);
    }
  });
});

describe("subscription_payment_success — renews_at preferred over Date.now()+30d", () => {
  function invoicePayloadWithRenewsAt(subId: string, invoiceId: string, renewsAt: string) {
    return JSON.stringify({
      meta: { event_name: "subscription_payment_success" },
      data: {
        type: "subscription-invoices",
        id: invoiceId,
        attributes: {
          subscription_id: subId,
          updated_at: "2026-07-01T00:00:00Z",
          renews_at: renewsAt,
        },
      },
    });
  }

  it("uses renews_at from the invoice as reset date when present (not Date.now()+30d)", async () => {
    const renewsAt = "2026-08-01T00:00:00Z";
    const body = invoicePayloadWithRenewsAt("sub_001", "inv_renews_001", renewsAt);
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const reset = rpcCalls.find((c) => c.fn === "reset_credits");
    expect(reset).toBeDefined();
    // p_reset_at must equal the invoice's renews_at, not a Date.now()+30d approximation
    expect(reset!.args["p_reset_at"]).toBe(new Date(renewsAt).toISOString());
    // Sanity: it is NOT approximately now+30d (which would be ≠ 2026-08-01)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    expect(reset!.args["p_reset_at"]).not.toBe(thirtyDaysFromNow);
  });

  it("falls back to Date.now()+30d when renews_at is absent from the invoice", async () => {
    const body = invoicePayload("sub_001", "inv_nora_001"); // no renews_at
    const before = Date.now();
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    const after = Date.now();
    expect(res.status).toBe(200);
    const reset = rpcCalls.find((c) => c.fn === "reset_credits");
    expect(reset).toBeDefined();
    const resetAtMs = new Date(reset!.args["p_reset_at"] as string).getTime();
    // Must be approximately 30 days from the call time (±5 seconds)
    expect(resetAtMs).toBeGreaterThanOrEqual(before + 30 * 24 * 3600 * 1000 - 5000);
    expect(resetAtMs).toBeLessThanOrEqual(after + 30 * 24 * 3600 * 1000 + 5000);
  });
});

describe("RPC-first ordering — money-path failure regression", () => {
  // These tests verify the fix to the bug where tombstone-before-RPC would permanently
  // orphan a credit grant: if the RPC failed after the tombstone committed, LS retries
  // would hit the 23505 unique violation and return 200 without ever granting credits.
  // The fix reorders to RPC-first, tombstone-second. These tests confirm that when the
  // RPC fails, the tombstone is NOT written, so a LS retry re-invokes the RPC.

  it("reset_credits failure returns 500 and does NOT write the tombstone (retry will re-invoke the RPC)", async () => {
    rpcErrors.set("reset_credits", { message: "connection refused" });
    const body = invoicePayload("sub_001", "inv_rpcfail_001");
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(500);
    // Tombstone must NOT be written — a subsequent retry must reach reset_credits again
    expect(ledger.size).toBe(0);
    // The RPC was attempted (before the tombstone)
    expect(rpcCalls.find((c) => c.fn === "reset_credits")).toBeDefined();
  });

  it("topup_credits failure returns 500 and does NOT write the tombstone (retry will re-invoke the RPC)", async () => {
    rpcErrors.set("topup_credits", { message: "connection refused" });
    const body = orderPayload("order_rpcfail_001", Number(TEST_TOPUP_VARIANT));
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(500);
    // Tombstone must NOT be written — a subsequent retry must reach topup_credits again
    expect(ledger.size).toBe(0);
    // The RPC was attempted (before the tombstone)
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeDefined();
  });

  it("topup_credits p_request_id equals the tombstone order_id so the SQL dedup guard and ledger agree", async () => {
    const body = orderPayload("order_stableid_001", Number(TEST_TOPUP_VARIANT));
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(200);
    const topup = rpcCalls.find((c) => c.fn === "topup_credits");
    expect(topup).toBeDefined();
    // The request_id passed to the SQL dedup guard must equal the tombstone's order_id
    expect(topup!.args["p_request_id"]).toBe("order:order_stableid_001");
    // Confirm the tombstone uses the same key
    expect(ledger.has("order:order_stableid_001::order_created")).toBe(true);
  });
});

describe("subscription_payment_refunded — credits zeroed", () => {
  it("calls zero_credits with the resolved row's license key on subscription_payment_refunded", async () => {
    const body = JSON.stringify({
      meta: { event_name: "subscription_payment_refunded" },
      data: {
        type: "subscription-invoices",
        id: "inv_refund_001",
        attributes: {
          subscription_id: "sub_001",
          updated_at: "2026-06-12T10:00:00Z",
        },
      },
    });
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const zero = rpcCalls.find((c) => c.fn === "zero_credits");
    expect(zero).toBeDefined();
    expect(zero!.args["p_license_key"]).toBe("WN-AI-EXISTING");
    expect(zero!.args["p_request_id"]).toBe("sub:sub_001:refund:inv_refund_001");
  });

  it("returns 500 when refund arrives before subscription_created (resolveSubscription null → retryable)", async () => {
    const body = JSON.stringify({
      meta: { event_name: "subscription_payment_refunded" },
      data: {
        type: "subscription-invoices",
        id: "inv_refund_oo",
        attributes: {
          subscription_id: "sub_UNKNOWN_REFUND",
          updated_at: "2026-06-12T10:00:00Z",
        },
      },
    });
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
    expect(rpcCalls.find((c) => c.fn === "zero_credits")).toBeUndefined();
  });

  it("duplicate refund returns 200 via tombstone; zero_credits IS still invoked on the duplicate with the same idempotency key (RPC-first ordering)", async () => {
    const body = JSON.stringify({
      meta: { event_name: "subscription_payment_refunded" },
      data: {
        type: "subscription-invoices",
        id: "inv_refund_dup",
        attributes: {
          subscription_id: "sub_001",
          updated_at: "2026-06-12T10:00:00Z",
        },
      },
    });
    // First delivery
    await onRequestPost(makeContext(body));
    const firstCall = rpcCalls.find((c) => c.fn === "zero_credits");
    expect(firstCall).toBeDefined();
    const firstRequestId = firstCall!.args["p_request_id"];

    // Duplicate delivery — RPC-first: zero_credits is called BEFORE the tombstone check.
    // The tombstone 23505 short-circuits AFTER the idempotent RPC, returning 200.
    rpcCalls = [];
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(200);
    // Assert: zero_credits was invoked on the duplicate (RPC-first ordering).
    const dupCall = rpcCalls.find((c) => c.fn === "zero_credits");
    expect(dupCall).toBeDefined();
    // Assert: the same idempotency key was used so the SQL-level ledger guard fires correctly.
    expect(dupCall!.args["p_request_id"]).toBe(firstRequestId);
  });

  it("zero_credits failure returns 500 and does NOT write the tombstone (LS retries)", async () => {
    rpcErrors.set("zero_credits", { message: "connection refused" });
    const body = JSON.stringify({
      meta: { event_name: "subscription_payment_refunded" },
      data: {
        type: "subscription-invoices",
        id: "inv_refund_fail",
        attributes: {
          subscription_id: "sub_001",
          updated_at: "2026-06-12T10:00:00Z",
        },
      },
    });
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(500);
    // Tombstone must NOT be written — the ledger stays empty
    expect(ledger.size).toBe(0);
    // The RPC was attempted (before the tombstone)
    expect(rpcCalls.find((c) => c.fn === "zero_credits")).toBeDefined();
  });
});

describe("subscription cancellation — grace period preserved", () => {
  it("subscription_updated with status 'cancelled' sets row status 'active' (grace period, NOT expired)", async () => {
    const body = subPayload("subscription_updated", "sub_001", "cancelled", {
      ends_at: "2026-07-12T00:00:00Z",
      renews_at: null,
    });
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const cancelled = updateCalls.find(
      (c) => c.col === "ls_subscription_id" && c.val === "sub_001",
    );
    expect(cancelled).toBeDefined();
    expect(cancelled!.data["status"]).toBe("active");
  });

  it("subscription_expired still sets status 'expired' (access ends at period end)", async () => {
    const body = subPayload("subscription_expired", "sub_001", "expired");
    const ctx = makeContext(body);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    const expired = updateCalls.find(
      (c) => c.col === "ls_subscription_id" && c.val === "sub_001",
    );
    expect(expired).toBeDefined();
    expect(expired!.data["status"]).toBe("expired");
  });
});

describe("order_created — top-up out-of-order delivery and config guard", () => {
  // Tier 3: no custom_data, email miss → orphan alert (500, retryable).
  // Returning 500 lets LS retry over its finite window, which auto-heals the
  // late-subscription-row race and ensures the (idempotency-keyed → single) alert
  // eventually lands so ops can credit manually.
  it("returns 500 (retryable) with NO tombstone and NO credit when email not found and no custom_data — lets LS retry / surfaces as failed webhook", async () => {
    const missingEmail = "latecomer@example.com";
    subRows = []; // no subscriber row

    const body = orderPayload("order_oo_001", Number(TEST_TOPUP_VARIANT), missingEmail);

    // Orphan path: 500 lets LS retry; no credit granted; no tombstone written
    const res = await onRequestPost(makeContext(body));
    expect(res.status).toBe(500);
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
    expect(ledger.size).toBe(0);
  });

  it("sends a Resend alert when CONTACT_TO is configured and the orphan path fires", async () => {
    subRows = [];
    const body = orderPayload("order_orphan_alert", Number(TEST_TOPUP_VARIANT), "orphan@example.com");
    const envWithResend = {
      ...makeEnv(),
      CONTACT_TO: "ops@writersnook.com",
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM: "noreply@writersnook.app",
    };
    // Default mockFetch returns ok:true — sendEmail will succeed (id: null is fine for the test)
    const res = await onRequestPost(makeContext(body, TEST_SECRET, envWithResend));
    expect(res.status).toBe(500);
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
    // Resend was called: mockFetch should have been invoked with the Resend API URL
    const resendCall = mockFetch.mock.calls.find(
      (args: unknown[]) => typeof args[0] === "string" && args[0].includes("resend.com"),
    );
    expect(resendCall).toBeDefined();
  });

  it("returns 500 with NO tombstone and NO credit when CONTACT_TO is set but RESEND_API_KEY is absent — credit path keeps retrying", async () => {
    subRows = [];
    const body = orderPayload("order_orphan_noresend", Number(TEST_TOPUP_VARIANT), "orphan@example.com");
    const envWithContactButNoResend = {
      ...makeEnv(),
      CONTACT_TO: "ops@writersnook.com",
      // RESEND_API_KEY and RESEND_FROM absent — sendEmail will skip silently
    };
    const res = await onRequestPost(makeContext(body, TEST_SECRET, envWithContactButNoResend));
    expect(res.status).toBe(500);
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
    expect(ledger.size).toBe(0);
  });

  it("returns 500 with no ledger write when LS_TOPUP_VARIANT_ID is blank (missing config)", async () => {
    const body = orderPayload("order_blank_001", Number(TEST_TOPUP_VARIANT));
    const ctx = makeContext(body, TEST_SECRET, makeEnv("" /* blank topup variant */));
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
    expect(ledger.size).toBe(0);
    expect(rpcCalls.find((c) => c.fn === "topup_credits")).toBeUndefined();
  });

  it("returns 500 with no ledger write when LS_SUB_VARIANT_ID is blank (missing config)", async () => {
    const body = orderPayload("order_blank_002", Number(TEST_TOPUP_VARIANT));
    const ctx = makeContext(body, TEST_SECRET, makeEnv(TEST_TOPUP_VARIANT, "" /* blank sub variant */));
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(500);
    expect(ledger.size).toBe(0);
  });
});
