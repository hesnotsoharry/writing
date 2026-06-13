/**
 * POST /api/webhooks/lemon-squeezy-subscription
 *
 * Handles Lemon Squeezy subscription lifecycle events and top-up pack orders.
 * Mirrors the HMAC verification and webhook_events idempotency ledger from
 * lemon-squeezy.ts; new behavior in a separate file (decision: no cross-contamination).
 *
 * Event → payload shape → subscription id extraction:
 *   subscription_created       data is subscription  — sub id = data.id
 *   subscription_updated       data is subscription  — sub id = data.id
 *   subscription_expired       data is subscription  — sub id = data.id
 *   subscription_payment_success data is invoice     — sub id = data.attributes.subscription_id
 *     (Bug B fix 2026-06-12: invoice data.id is the INVOICE id, not the subscription id)
 *
 * Row creation (Bug A fix 2026-06-12):
 *   subscription_created: sole row-creating event. Fetches license key from LS API
 *     (GET /v1/license-keys?filter[order_id]={order_id}). Keys are ORDER-scoped
 *     resources — LS does NOT include them in subscription webhook payloads.
 *     LS API network failure / non-200 → 500 so LS retries (up to 3x).
 *     API returns zero keys (product without license keys) → WN-AI- self-mint fallback.
 *   All other subscription events: resolve existing row by ls_subscription_id only.
 *     No existing row → 500 (retryable; LS retries until created arrives first).
 *
 * Idempotency: webhook_events ledger (23505 unique violation = already processed).
 * Top-up order_created branch: unchanged.
 */
import { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { MONTHLY_ALLOWANCE, TOPUP_PACK_AMOUNT } from "../../_lib/credits";
import { WebhookEnv, makeServiceClient } from "../../_lib/supabase";
import { verifySignature } from "../../_lib/verify-signature";

// ── LS payload types ──────────────────────────────────────────────────────────

type LsSubStatus =
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired";

interface SubscriptionAttributes {
  order_id: number;
  user_name: string;
  user_email: string;
  status: LsSubStatus;
  renews_at: string | null;
  ends_at: string | null;
  updated_at: string;
  [key: string]: unknown;
}

// subscription_created / subscription_updated / subscription_expired payloads.
interface SubscriptionPayload {
  meta: { event_name: "subscription_created" | "subscription_updated" | "subscription_expired" };
  data: { type: "subscriptions"; id: string; attributes: SubscriptionAttributes };
}

// subscription_payment_success: data is a subscription-invoice (NOT a subscription).
// Bug B (2026-06-12): data.id is the INVOICE id; sub id is at attributes.subscription_id.
interface InvoiceAttributes {
  subscription_id: string;
  updated_at: string;
  /** LS sends the next renewal date on the invoice when available. Prefer this over Date.now()+30d. */
  renews_at?: string | null;
  [key: string]: unknown;
}

interface InvoicePayload {
  meta: { event_name: "subscription_payment_success" };
  data: { type: "subscription-invoices"; id: string; attributes: InvoiceAttributes };
}

interface TopupOrderAttributes {
  user_email: string;
  first_order_item?: { variant_id?: number; product_id?: number };
  updated_at?: string;
}

interface TopupOrderPayload {
  meta: { event_name: "order_created" };
  data: { type: "orders"; id: string; attributes: TopupOrderAttributes };
}

type LsPayload = SubscriptionPayload | InvoicePayload | TopupOrderPayload;

const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_payment_success",
  "subscription_expired",
]);

const HANDLED_EVENTS = new Set([...SUBSCRIPTION_EVENTS, "order_created"]);

// ── Status mapping ────────────────────────────────────────────────────────────

function mapStatus(lsStatus: LsSubStatus): "active" | "expired" {
  if (lsStatus === "cancelled" || lsStatus === "expired" || lsStatus === "unpaid") {
    return "expired";
  }
  return "active";
}

// ── License key helpers ───────────────────────────────────────────────────────

function mintNewLicenseKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return (
    "WN-AI-" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

interface LsLicenseKeyResponse {
  data: Array<{ attributes: { key: string } }>;
}

/**
 * Fetches the license key for an order from the LS license-keys API.
 * Returns: key string (use it), null (zero keys → self-mint), or "error" (caller → 500).
 *
 * Bug A fix (2026-06-12): LS does NOT include license keys in subscription webhook
 * payloads. Keys are ORDER-scoped resources — must be fetched via the API.
 * Endpoint: GET /v1/license-keys?filter[order_id]={id}
 *           Authorization: Bearer {LS_API_KEY}, Accept: application/vnd.api+json
 */
async function fetchLsLicenseKey(
  orderId: number,
  env: WebhookEnv,
): Promise<string | null | "error"> {
  try {
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/license-keys?filter[order_id]=${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${env.LS_API_KEY}`,
          Accept: "application/vnd.api+json",
        },
      },
    );
    if (!res.ok) return "error";
    const json = (await res.json()) as LsLicenseKeyResponse;
    if (!json.data || json.data.length === 0) return null;
    return json.data[0].attributes.key;
  } catch {
    return "error";
  }
}

// ── Subscription row resolver ─────────────────────────────────────────────────

interface SubRow { license_key: string }

/**
 * Resolves an existing subscription row by ls_subscription_id.
 * Returns the row or null if not found.
 * Non-created events must find an existing row; null → caller returns 500 (retryable).
 */
async function resolveSubscription(
  db: SupabaseClient,
  lsSubId: string,
): Promise<SubRow | null> {
  const { data, error } = await db
    .from("subscriptions")
    .select("license_key")
    .eq("ls_subscription_id", lsSubId)
    .single();
  if (error || !data) return null;
  return data as SubRow;
}

// ── Email seam ────────────────────────────────────────────────────────────────

/**
 * SEAM: Email dispatch for the subscription license key.
 * No-op stub this phase — wire Resend in wave 35.
 * NOTE: licenseKey must be the PERSISTED key from the upsert RETURNING, not
 *   the locally-minted variable, to guard against out-of-order delivery.
 */
async function sendSubscriptionKeyEmail(
  env: WebhookEnv,
  email: string,
  licenseKey: string,
): Promise<void> {
  // SEAM: intentional no-op stub — wire Resend in wave 35.
  void env; void email; void licenseKey;
}

// ── Variant helpers ───────────────────────────────────────────────────────────

function matchesVariantEnv(variantId: number | undefined, envValue: string | undefined): boolean {
  if (variantId == null) return false;
  const ids = (envValue ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(variantId));
}

function isTopupVariant(variantId: number | undefined, env: WebhookEnv): boolean {
  return matchesVariantEnv(variantId, env.LS_TOPUP_VARIANT_ID);
}

function isSubscriptionVariant(variantId: number | undefined, env: WebhookEnv): boolean {
  return matchesVariantEnv(variantId, env.LS_SUB_VARIANT_ID);
}

// ── Subscription event handlers ───────────────────────────────────────────────

/**
 * subscription_created: sole row-creating event.
 * Fetches license key from LS API; self-mints WN-AI- only when API returns zero keys.
 * LS API network failure or non-200 → 500 so LS retries.
 */
async function handleCreated(payload: SubscriptionPayload, env: WebhookEnv): Promise<Response> {
  const subId = payload.data.id;
  const attrs = payload.data.attributes;
  const idempotencyKey = `sub:${subId}:${attrs.updated_at}`;
  const db = makeServiceClient(env);

  // Fetch from LS API — keys are order-scoped, not in the webhook payload (Bug A fix)
  const apiResult = await fetchLsLicenseKey(attrs.order_id, env);
  if (apiResult === "error") return new Response("Internal Server Error", { status: 500 });
  const licenseKey = apiResult ?? mintNewLicenseKey();

  const status = mapStatus(attrs.status);
  const resetAt = attrs.renews_at ? new Date(attrs.renews_at) : null;

  const { data: upsertedKey, error: upsertErr } = await db.rpc("upsert_subscription", {
    p_license_key: licenseKey,
    p_ls_subscription_id: subId,
    p_user_email: attrs.user_email,
    p_status: status,
    p_reset_at: resetAt?.toISOString() ?? null,
  });
  if (upsertErr) return new Response("Internal Server Error", { status: 500 });

  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: "subscription_created", order_id: idempotencyKey });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

  const emailKey = (upsertedKey as string | null) ?? licenseKey;
  await sendSubscriptionKeyEmail(env, attrs.user_email, emailKey);

  return new Response(null, { status: 200 });
}

/**
 * subscription_payment_success: monthly credit reset.
 * Bug B fix (2026-06-12): payload data is a subscription-invoice object.
 *   Subscription id = data.attributes.subscription_id (NOT data.id = invoice id).
 * Never creates rows; resolves existing row or returns 500 (retryable).
 */
async function handlePaymentSuccess(payload: InvoicePayload, env: WebhookEnv): Promise<Response> {
  const invoiceId = payload.data.id;
  const subId = payload.data.attributes.subscription_id; // Bug B fix: NOT payload.data.id
  const idempotencyKey = `sub:${subId}:payment:${invoiceId}`;
  const db = makeServiceClient(env);

  const existing = await resolveSubscription(db, subId);
  if (!existing) return new Response("Internal Server Error", { status: 500 });

  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: "subscription_payment_success", order_id: idempotencyKey });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

  // Prefer the invoice's renews_at when present (matches handleCreated/handleStatusUpdate pattern).
  // Fallback to Date.now()+30d so existing subscriptions without renews_at still reset correctly.
  const nextResetAt = payload.data.attributes.renews_at
    ? new Date(payload.data.attributes.renews_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.rpc("reset_credits", {
    p_license_key: existing.license_key,
    p_allowance: MONTHLY_ALLOWANCE,
    p_reset_at: nextResetAt.toISOString(),
    p_request_id: idempotencyKey,
  });

  return new Response(null, { status: 200 });
}

/**
 * subscription_updated / subscription_expired: status/reset_at update only.
 * Never creates rows; resolves existing row or returns 500 (retryable).
 * subscription_expired always sets status='expired' regardless of payload status field.
 */
async function handleStatusUpdate(payload: SubscriptionPayload, env: WebhookEnv): Promise<Response> {
  const eventName = payload.meta.event_name;
  const subId = payload.data.id;
  const attrs = payload.data.attributes;
  const idempotencyKey = `sub:${subId}:${attrs.updated_at}`;
  const db = makeServiceClient(env);

  const existing = await resolveSubscription(db, subId);
  if (!existing) return new Response("Internal Server Error", { status: 500 });

  const status = eventName === "subscription_expired" ? "expired" : mapStatus(attrs.status);
  const resetAt = attrs.renews_at ? new Date(attrs.renews_at) : null;

  const { error: updateErr } = await db
    .from("subscriptions")
    .update({ status, reset_at: resetAt?.toISOString() ?? null })
    .eq("ls_subscription_id", subId);
  if (updateErr) return new Response("Internal Server Error", { status: 500 });

  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: eventName, order_id: idempotencyKey });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

  return new Response(null, { status: 200 });
}

// ── Top-up order handler ──────────────────────────────────────────────────────

async function handleTopupOrder(
  payload: TopupOrderPayload,
  env: WebhookEnv,
): Promise<Response> {
  const attrs = payload.data.attributes;
  const orderId = payload.data.id;
  const variantId = attrs.first_order_item?.variant_id;
  const db = makeServiceClient(env);

  // Fix 2: Config guard — both variant IDs must be non-blank.
  // Absent/blank makes every order_created silently no-op; 500 forces LS to retry
  // until the config is fixed (loud failure over silent data loss).
  if (!env.LS_TOPUP_VARIANT_ID || !env.LS_SUB_VARIANT_ID) {
    return new Response("Internal Server Error", { status: 500 });
  }

  // Fix 1: For top-up variants, resolve the subscriber BEFORE writing the ledger.
  // Old flow (buggy): ledger insert → lookup → 404 on miss. On retry: 23505 → 200,
  // grant permanently lost. New flow: lookup first → 500 on miss (retryable, no
  // tombstone written) → ledger insert → grant. Exactly-once guarantee preserved.
  let licenseKey: string | null = null;
  if (isTopupVariant(variantId, env)) {
    const { data: sub, error: subErr } = await db
      .from("subscriptions")
      .select("license_key")
      .eq("user_email", attrs.user_email)
      .single();
    if (subErr || !sub) return new Response("Internal Server Error", { status: 500 });
    licenseKey = (sub as { license_key: string }).license_key;
  }

  // Record ALL order_created events in the idempotency ledger regardless of variant.
  // This covers top-up packs, subscription-product initial orders, and unknown variants.
  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: "order_created", order_id: `order:${orderId}` });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

  if (!licenseKey) {
    // Subscription-variant or unknown-variant order — no credits action.
    // Subscription variants: lifecycle handled via subscription_* events.
    // Unknown variants: idempotent no-op (already ledger-recorded above).
    void isSubscriptionVariant(variantId, env); // acknowledgement; no branch needed
    return new Response(null, { status: 200 });
  }

  // Top-up variant: grant credits to the resolved subscriber.
  await db.rpc("topup_credits", {
    p_license_key: licenseKey,
    p_amount: TOPUP_PACK_AMOUNT,
    p_request_id: `order:${orderId}`,
  });

  return new Response(null, { status: 200 });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<WebhookEnv> = async (context) => {
  const raw = await context.request.text();
  const valid = await verifySignature(
    raw,
    context.request.headers.get("X-Signature"),
    context.env.LEMON_SQUEEZY_SIGNING_SECRET,
  );
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const payload = JSON.parse(raw) as LsPayload;
  const eventName = payload.meta.event_name;
  if (!HANDLED_EVENTS.has(eventName)) return new Response(null, { status: 200 });

  if (eventName === "subscription_payment_success") {
    return handlePaymentSuccess(payload as InvoicePayload, context.env);
  }
  if (SUBSCRIPTION_EVENTS.has(eventName)) {
    const subPayload = payload as SubscriptionPayload;
    if (eventName === "subscription_created") return handleCreated(subPayload, context.env);
    return handleStatusUpdate(subPayload, context.env);
  }
  return handleTopupOrder(payload as TopupOrderPayload, context.env);
};
