/**
 * Acceptance test: subscription_created webhook must email the license key to a new subscriber.
 * Contracts under test:
 *   - subscription_created resolves a license key from the LS API (Bug A fix).
 *   - After upsert, the handler calls sendSubscriptionKeyEmail with env, user_email, and license key.
 *   - sendSubscriptionKeyEmail wires Resend: POSTs to https://api.resend.com/emails with the key in the body.
 *   - The POST carries an Idempotency-Key header.
 *   - On duplicate webhook (23505 ledger), the email is NOT re-sent.
 *
 * Boundary: @supabase/supabase-js and global fetch are mocked; no live calls.
 * Oracle: This test MUST FAIL until sendSubscriptionKeyEmail is wired to call sendEmail.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./lemon-squeezy-subscription";

const TEST_SECRET = "test-sub-signing-secret-xyz";
const TEST_LS_API_KEY = "test-ls-api-key";

// ── Fetch mock (routes to LS API or Resend) ────────────────────────────────────

let mockFetch = vi.fn();
vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => mockFetch(...args));

function lsApiSuccess(key: string) {
  return {
    ok: true,
    json: async () => ({ data: [{ attributes: { key } }] }),
  };
}

// Route fetch calls based on URL
function fetchRouter(url: string | Request) {
  const urlStr = typeof url === "string" ? url : url.toString();

  // LS API call for license keys
  if (urlStr.includes("license-keys")) {
    return Promise.resolve(lsApiSuccess("LS-SUB-KEY-ABC"));
  }

  // Resend API call — track this
  if (urlStr.includes("api.resend.com/emails")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ id: "email-sub-1" }),
    });
  }

  // Fallback
  return Promise.resolve({
    ok: false,
    json: async () => ({}),
  });
}

// ── Supabase mock ─────────────────────────────────────────────────────────────

let ledger: Set<string>;

function makeMockClient() {
  return {
    from: (_table: string) => ({
      insert: (row: { event_name: string; order_id: string }) => {
        const key = `${row.order_id}::${row.event_name}`;
        const dup = ledger.has(key);
        if (!dup) ledger.add(key);
        const result = dup
          ? { data: null, error: { code: "23505", message: "duplicate" } }
          : { data: { id: 1 }, error: null };
        return Promise.resolve(result);
      },
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { license_key: "existing" }, error: null }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      upsert: (row: Record<string, unknown>) => {
        return {
          select: () => ({
            single: () => Promise.resolve({ data: row["p_license_key"] || "LS-SUB-KEY-ABC", error: null }),
          }),
        };
      },
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      if (fn === "upsert_subscription") {
        return Promise.resolve({ data: args["p_license_key"] ?? "LS-SUB-KEY-ABC", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => makeMockClient() }));

// ── Signature helpers ──────────────────────────────────────────────────────────

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeEnv() {
  return {
    SUPABASE_URL: "https://placeholder.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
    SUPABASE_ANON_KEY: "placeholder-anon",
    LEMON_SQUEEZY_SIGNING_SECRET: TEST_SECRET,
    LS_TOPUP_VARIANT_ID: "1782092",
    LS_SUB_VARIANT_ID: "1782093",
    LS_API_KEY: TEST_LS_API_KEY,
    RESEND_API_KEY: "re_test_key",
    RESEND_FROM: "Writers Nook <noreply@writersnook.app>",
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

// ── Payload builders ───────────────────────────────────────────────────────────

function subPayload(subId = "sub_email_001", email = "subscriber@example.com") {
  return JSON.stringify({
    meta: { event_name: "subscription_created" },
    data: {
      type: "subscriptions",
      id: subId,
      attributes: {
        order_id: 9001,
        user_name: "Alice",
        user_email: email,
        status: "active",
        renews_at: "2026-07-12T00:00:00Z",
        ends_at: null,
        updated_at: "2026-06-12T10:00:00Z",
      },
    },
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch = vi.fn(fetchRouter);
  ledger = new Set();
  vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => mockFetch(...args));
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("subscription_created -> Resend license-key email (Wave 36 Phase B)", () => {
  it("sends a Resend email with the license key to the subscriber on subscription_created", async () => {
    const res = await onRequestPost(makeContext(subPayload("sub_email_001", "alice@example.com")));
    expect(res.status).toBe(200);

    // DISCRIMINATING ASSERTION: a POST to api.resend.com/emails MUST have happened.
    // This assertion fails until sendSubscriptionKeyEmail is wired to call sendEmail.
    const resendCall = mockFetch.mock.calls.find((call) => {
      const url = typeof call[0] === "string" ? call[0] : call[0]?.toString?.();
      return typeof url === "string" && url.includes("api.resend.com/emails");
    });
    expect(resendCall).toBeDefined();

    // Assert the Resend POST carried the subscriber's email
    const [, options] = resendCall || [];
    const body = typeof options?.body === "string" ? JSON.parse(options.body) : options?.body;
    expect(body?.to).toContain("alice@example.com");

    // Assert the email body CONTAINS the resolved license key
    const emailContent = JSON.stringify(body);
    expect(emailContent).toContain("LS-SUB-KEY-ABC");

    // Assert Idempotency-Key header is present and includes the key
    const headers = options?.headers as Record<string, string>;
    expect(headers?.["Idempotency-Key"]).toBeDefined();
    expect(headers?.["Idempotency-Key"]).toContain("LS-SUB-KEY-ABC");
  });

  it("does NOT re-send the email on a duplicate subscription_created webhook (ledger dedup)", async () => {
    const body = subPayload("sub_email_dup", "bob@example.com");

    // First delivery
    await onRequestPost(makeContext(body));
    const firstResendCalls = mockFetch.mock.calls.filter((call) => {
      const url = typeof call[0] === "string" ? call[0] : call[0]?.toString?.();
      return typeof url === "string" && url.includes("api.resend.com/emails");
    });
    const firstCount = firstResendCalls.length;
    expect(firstCount).toBe(1);

    // Reset the mock for clarity
    vi.clearAllMocks();
    mockFetch = vi.fn(fetchRouter);
    vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => mockFetch(...args));

    // Replay the SAME webhook
    const res2 = await onRequestPost(makeContext(body));
    expect(res2.status).toBe(200);

    // Second delivery: no Resend call should happen (ledger deduped the event)
    const secondResendCalls = mockFetch.mock.calls.filter((call) => {
      const url = typeof call[0] === "string" ? call[0] : call[0]?.toString?.();
      return typeof url === "string" && url.includes("api.resend.com/emails");
    });
    expect(secondResendCalls).toHaveLength(0);
  });
});
