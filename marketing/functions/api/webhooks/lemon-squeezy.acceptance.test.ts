// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — webhook contract (m4 Phase 1).
// The implementer MUST make this pass and MUST NOT modify it. It expresses the
// Lemon Squeezy webhook contract from the consumer's side, expanded in m4.
//
// ORDERING — act-then-mark (decision D5, surfaced by the Phase-1 panel review):
// the IDEMPOTENT side effect runs FIRST, the ledger row is written AFTER. This
// removes the lost-event window a mark-then-act ordering has (ledger committed,
// then a transient upsert failure -> LS retry hits the ledger -> event dropped).
// Because the `purchases` upsert is idempotent on `order_id`, re-applying it on a
// retry is harmless; the `webhook_events` ledger therefore dedups EXACTLY-ONCE
// effects (Phase 2's confirmation email) rather than guarding the upsert.
//
// Per delivery:
//   - invalid/absent X-Signature -> 401 + NO writes.
//   - unhandled event_name       -> 200, no side effect, no ledger row.
//   - nullish/empty order_id      -> 400 + NO writes (guards `String(undefined)`).
//   - handled event: upsert `purchases` (idempotent, onConflict order_id) FIRST,
//       THEN `await db.from("webhook_events").insert({ event_name, order_id })`.
//       A duplicate (Postgres "23505" on the (order_id, event_name) UNIQUE) means
//       "already processed once" -> still 200 (the idempotent upsert re-applied
//       harmlessly; a first-time-only effect would be skipped here).
//   - order_created       -> buyer identity; license stays null (D1).
//   - order_refunded      -> status="refunded" + refunded_at set.
//   - license_key_created -> license_key = data.attributes.key (authoritative source, D1).
// Supabase is mocked at the boundary; the live exactly-once guarantee is the DB
// UNIQUE constraints, verified once provisioned. Signing is HMAC-SHA256 hex of
// the RAW body. The dedup guarantee is asserted via the LEDGER (ledgerInserts),
// not via suppressing the idempotent upsert.
// ============================================================================
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./lemon-squeezy";

const TEST_SECRET = "test-signing-secret-abc123";

// Writes to `purchases` (the side effects). Ledger inserts are tracked separately.
let purchaseWrites: Array<{ op: string; row: Record<string, unknown>; options: unknown }> = [];
// Simulates the UNIQUE (order_id, event_name) constraint on webhook_events.
let ledger: Set<string>;
let ledgerInserts: number;

function makeMockClient() {
  return {
    from: (table: string) => ({
      // webhook_events ledger insert — models the unique-constraint behavior.
      insert: (row: { event_name: string; order_id: string }) => {
        const key = `${row.order_id}::${row.event_name}`;
        const duplicate = ledger.has(key);
        if (!duplicate) {
          ledger.add(key);
          ledgerInserts += 1;
        }
        const result = duplicate
          ? { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
          : { data: { id: ledgerInserts }, error: null };
        // Thenable so the handler may `await insert(...)` or `.insert(...).select().single()`.
        return {
          select: () => ({ single: () => Promise.resolve(result) }),
          then: (resolve: (v: typeof result) => unknown) => resolve(result),
        };
      },
      // purchases write — captured for assertions.
      upsert: (row: Record<string, unknown>, options: unknown) => {
        if (table === "purchases") purchaseWrites.push({ op: "upsert", row, options });
        return {
          select: () => ({ single: () => Promise.resolve({ data: { id: 1 }, error: null }) }),
        };
      },
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeMockClient(),
}));

// ---- payload builders (LS JSON:API shapes; research §3) --------------------

function orderCreatedBody(orderId = "9999") {
  return JSON.stringify({
    meta: { event_name: "order_created" },
    data: {
      type: "orders",
      id: orderId,
      attributes: {
        user_email: "buyer@example.com",
        user_name: "Test Buyer",
        total: "2900",
        status: "paid",
        refunded: false,
        first_order_item: { product_name: "Writers Nook" },
        created_at: "2026-06-04T12:00:00.000000Z",
      },
    },
  });
}

function orderRefundedBody(orderId = "9999") {
  return JSON.stringify({
    meta: { event_name: "order_refunded" },
    data: {
      type: "orders",
      id: orderId,
      attributes: {
        user_email: "buyer@example.com",
        user_name: "Test Buyer",
        total: "2900",
        status: "paid",
        refunded: true,
        refunded_at: "2026-06-05T09:30:00.000000Z",
        first_order_item: { product_name: "Writers Nook" },
      },
    },
  });
}

// license_key_created: data.type === "license-keys"; the key lives at
// data.attributes.key and the owning order at data.attributes.order_id.
function licenseKeyCreatedBody(orderId = 9999, key = "WNOOK-REAL-KEY-7Q4M") {
  return JSON.stringify({
    meta: { event_name: "license_key_created" },
    data: {
      type: "license-keys",
      id: "1",
      attributes: {
        order_id: orderId,
        user_email: "buyer@example.com",
        user_name: "Test Buyer",
        key,
        key_short: "WNOOK-...-7Q4M",
        activation_limit: 3,
        status: "inactive",
        created_at: "2026-06-04T12:00:05.000000Z",
      },
    },
  });
}

function unknownEventBody() {
  return JSON.stringify({
    meta: { event_name: "subscription_created" },
    data: { type: "subscriptions", id: "555", attributes: { user_email: "buyer@example.com" } },
  });
}

function sign(body: string, secret = TEST_SECRET) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function postRequest(body: string, signature: string | null, eventName: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Event-Name": eventName,
  };
  if (signature !== null) headers["X-Signature"] = signature;
  return new Request("https://writersnook.app/api/webhooks/lemon-squeezy", { method: "POST", headers, body });
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

// Drive a signed POST in one line.
function post(body: string, eventName: string) {
  return onRequestPost(ctx(postRequest(body, sign(body), eventName)));
}

describe("Lemon Squeezy webhook contract (m4)", () => {
  beforeEach(() => {
    purchaseWrites = [];
    ledger = new Set();
    ledgerInserts = 0;
  });

  // ---- signature enforcement (all events) ----------------------------------

  it("rejects an invalid signature with 401 and writes nothing", async () => {
    const body = orderCreatedBody();
    const res = await onRequestPost(ctx(postRequest(body, "deadbeef", "order_created")));
    expect(res.status).toBe(401);
    expect(purchaseWrites).toHaveLength(0);
    expect(ledgerInserts).toBe(0);
  });

  it("rejects a missing signature with 401 and writes nothing", async () => {
    const body = orderCreatedBody();
    const res = await onRequestPost(ctx(postRequest(body, null, "order_created")));
    expect(res.status).toBe(401);
    expect(purchaseWrites).toHaveLength(0);
    expect(ledgerInserts).toBe(0);
  });

  // ---- order_created --------------------------------------------------------

  it("accepts a signed order_created: ledgers it and upserts the buyer (license still null)", async () => {
    const res = await post(orderCreatedBody(), "order_created");
    expect(res.status).toBe(200);
    expect(ledgerInserts).toBe(1);
    expect(purchaseWrites).toHaveLength(1);

    const { row, options } = purchaseWrites[0];
    expect(row).toMatchObject({ email: "buyer@example.com", order_id: "9999" });
    expect(row.license_key ?? null).toBeNull(); // order_created never carries the key (D1)
    expect(JSON.stringify(options)).toContain("order_id"); // conflict target
  });

  // ---- order_refunded -------------------------------------------------------

  it("accepts a signed order_refunded: marks the row refunded with refunded_at", async () => {
    const res = await post(orderRefundedBody(), "order_refunded");
    expect(res.status).toBe(200);
    expect(purchaseWrites).toHaveLength(1);

    const { row, options } = purchaseWrites[0];
    expect(row.order_id).toBe("9999");
    expect(row.status).toBe("refunded");
    expect(row.refunded_at).toBe("2026-06-05T09:30:00.000000Z");
    expect(JSON.stringify(options)).toContain("order_id");
  });

  // ---- license_key_created (authoritative license source) -------------------

  it("accepts a signed license_key_created: writes the real license key onto the order's row", async () => {
    const res = await post(licenseKeyCreatedBody(9999, "WNOOK-REAL-KEY-7Q4M"), "license_key_created");
    expect(res.status).toBe(200);
    expect(purchaseWrites).toHaveLength(1);

    const { row, options } = purchaseWrites[0];
    expect(row.order_id).toBe("9999"); // matched to the owning order
    expect(row.license_key).toBe("WNOOK-REAL-KEY-7Q4M");
    expect(JSON.stringify(options)).toContain("order_id");
  });

  // ---- ledger idempotency (any event) --------------------------------------

  it("dedups at the ledger: a replay re-applies the idempotent upsert but the ledger records it exactly once", async () => {
    const r1 = await post(orderCreatedBody("12345"), "order_created");
    const r2 = await post(orderCreatedBody("12345"), "order_created"); // exact replay

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // act-then-mark (D5): the idempotent upsert runs on BOTH deliveries (a transient
    // failure is recoverable on retry — no lost-event window) ...
    expect(purchaseWrites).toHaveLength(2);
    // ... while the ledger dedups exactly-once effects (Phase 2's email) — recorded once.
    expect(ledgerInserts).toBe(1);
  });

  it("rejects a handled event with a missing order_id: 400, no writes (no String(undefined) poisoning)", async () => {
    const body = JSON.stringify({
      meta: { event_name: "license_key_created" },
      data: {
        type: "license-keys",
        id: "1",
        attributes: { user_email: "buyer@example.com", key: "WNOOK-NO-ORDER" }, // order_id absent
      },
    });
    const res = await onRequestPost(ctx(postRequest(body, sign(body), "license_key_created")));
    expect(res.status).toBe(400);
    expect(purchaseWrites).toHaveLength(0);
    expect(ledgerInserts).toBe(0);
  });

  it("distinguishes events on the same order: order_created then license_key_created both apply", async () => {
    await post(orderCreatedBody("777"), "order_created");
    await post(licenseKeyCreatedBody(777, "WNOOK-KEY-FOR-777"), "license_key_created");

    expect(ledgerInserts).toBe(2); // different (order_id, event_name) pairs
    expect(purchaseWrites).toHaveLength(2);
    expect(purchaseWrites[1].row.license_key).toBe("WNOOK-KEY-FOR-777");
  });

  // ---- unknown events -------------------------------------------------------

  it("ignores an unhandled event: 200, no ledger row, no purchases write", async () => {
    const res = await post(unknownEventBody(), "subscription_created");
    expect(res.status).toBe(200);
    expect(ledgerInserts).toBe(0);
    expect(purchaseWrites).toHaveLength(0);
  });
});
