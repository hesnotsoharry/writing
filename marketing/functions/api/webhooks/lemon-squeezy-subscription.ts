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
import { sendEmail } from "../../_lib/resend";
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

// subscription_payment_success / subscription_payment_refunded: data is a
// subscription-invoice (NOT a subscription).
// Bug B (2026-06-12): data.id is the INVOICE id; sub id is at attributes.subscription_id.
interface InvoiceAttributes {
  subscription_id: string;
  updated_at: string;
  /** LS sends the next renewal date on the invoice when available. Prefer this over Date.now()+30d. */
  renews_at?: string | null;
  [key: string]: unknown;
}

interface InvoicePayload {
  meta: { event_name: "subscription_payment_success" | "subscription_payment_refunded" };
  data: { type: "subscription-invoices"; id: string; attributes: InvoiceAttributes };
}

interface TopupOrderAttributes {
  user_email: string;
  first_order_item?: { variant_id?: number; product_id?: number };
  updated_at?: string;
}

interface TopupOrderPayload {
  meta: { event_name: "order_created"; custom_data?: { license_key?: string } };
  data: { type: "orders"; id: string; attributes: TopupOrderAttributes };
}

type LsPayload = SubscriptionPayload | InvoicePayload | TopupOrderPayload;

const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_payment_success",
  "subscription_expired",
]);

const HANDLED_EVENTS = new Set([...SUBSCRIPTION_EVENTS, "order_created", "subscription_payment_refunded"]);

// ── Status mapping ────────────────────────────────────────────────────────────

function mapStatus(lsStatus: LsSubStatus): "active" | "expired" {
  if (lsStatus === "expired" || lsStatus === "unpaid") {
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
 * Email dispatch for the subscription license key (wired to Resend, wave 36).
 * NOTE: licenseKey must be the PERSISTED key from the upsert RETURNING, not
 *   the locally-minted variable, to guard against out-of-order delivery. The
 *   Resend idempotency key (sub-key-<key>) is stable across LS retries because
 *   upsert_subscription RETURNs the existing persisted key (0003_credit_reserve.sql).
 */
async function sendSubscriptionKeyEmail(
  env: WebhookEnv,
  email: string,
  licenseKey: string,
): Promise<void> {
  await sendEmail(env, {
    to: email,
    subject: "Your Writers Nook AI assistant subscription key",
    html: `<p>Hi there,</p><p>Thank you for subscribing to Writers Nook! Your AI assistant license key is:</p><p><strong>${licenseKey}</strong></p><p>Enter it in the app under <strong>Settings → AI Assistant</strong> to activate your subscription.</p><p>Visit your <a href="https://writersnook.app/account">account page</a> any time to manage your subscription.</p>`,
    text: `Thank you for subscribing to Writers Nook!\n\nYour AI assistant license key is: ${licenseKey}\n\nEnter it in the app under Settings → AI Assistant to activate your subscription.\n\nVisit https://writersnook.app/account to manage your subscription.`,
    idempotencyKey: `sub-key-${licenseKey}`,
  });
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
 *
 * Ordering (fixed): RPC first, tombstone second.
 * Tombstone-before-RPC would permanently orphan the grant on RPC failure:
 * a retry hits the 23505 unique violation on the tombstone and returns 200
 * without ever calling reset_credits.
 * reset_credits is idempotent (SET credits_balance = p_allowance, not +=),
 * so reordering is safe — a retry after tombstone failure re-runs the RPC harmlessly.
 */
async function handlePaymentSuccess(payload: InvoicePayload, env: WebhookEnv): Promise<Response> {
  const invoiceId = payload.data.id;
  const subId = payload.data.attributes.subscription_id; // Bug B fix: NOT payload.data.id
  const idempotencyKey = `sub:${subId}:payment:${invoiceId}`;
  const db = makeServiceClient(env);

  const existing = await resolveSubscription(db, subId);
  if (!existing) return new Response("Internal Server Error", { status: 500 });

  // Prefer the invoice's renews_at when present (matches handleCreated/handleStatusUpdate pattern).
  // Fallback to Date.now()+30d so existing subscriptions without renews_at still reset correctly.
  const nextResetAt = payload.data.attributes.renews_at
    ? new Date(payload.data.attributes.renews_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // RPC FIRST: reset_credits before the tombstone so a LS retry after RPC failure re-invokes
  // the grant rather than short-circuiting on a committed tombstone.
  const { data: newBalance, error: resetErr } = await db.rpc("reset_credits", {
    p_license_key: existing.license_key,
    p_allowance: MONTHLY_ALLOWANCE,
    p_reset_at: nextResetAt.toISOString(),
    p_request_id: idempotencyKey,
  });
  if (resetErr || newBalance === null) return new Response("Internal Server Error", { status: 500 });

  // Tombstone SECOND: once the grant succeeds, write the idempotency ledger.
  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: "subscription_payment_success", order_id: idempotencyKey });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

  return new Response(null, { status: 200 });
}

/**
 * subscription_payment_refunded: zero credits on a refunded invoice.
 * Mirrors handlePaymentSuccess in shape (invoice payload, same id extraction).
 * RPC FIRST, tombstone SECOND — same ordering rationale as handlePaymentSuccess.
 * zero_credits uses an absolute SET (credits_balance = 0), so it is idempotent
 * on LS retries without a separate SQL dedup guard.
 */
async function handlePaymentRefunded(payload: InvoicePayload, env: WebhookEnv): Promise<Response> {
  const invoiceId = payload.data.id;
  const subId = payload.data.attributes.subscription_id;
  if (!subId) {
    console.error("[subscription_payment_refunded] malformed payload — missing subscription_id", { invoiceId });
    return new Response("Internal Server Error", { status: 500 });
  }
  const idempotencyKey = `sub:${subId}:refund:${invoiceId}`;
  const db = makeServiceClient(env);

  const existing = await resolveSubscription(db, subId);
  if (!existing) return new Response("Internal Server Error", { status: 500 });

  // RPC FIRST: zero_credits before the tombstone so a LS retry after RPC failure
  // re-invokes the zeroing rather than short-circuiting on a committed tombstone.
  const { data: newBalance, error: zeroErr } = await db.rpc("zero_credits", {
    p_license_key: existing.license_key,
    p_request_id: idempotencyKey,
  });
  if (zeroErr || newBalance === null) return new Response("Internal Server Error", { status: 500 });

  // Tombstone SECOND: once the zeroing succeeds, write the idempotency ledger.
  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: "subscription_payment_refunded", order_id: idempotencyKey });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

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

// ── Top-up orphan alert ───────────────────────────────────────────────────────

/**
 * Terminal handler for a top-up order that cannot be linked to a subscriber.
 * Sends a Resend alert if CONTACT_TO is configured so ops can credit manually.
 * Falls back to log-only if CONTACT_TO is absent or Resend keys are missing.
 */
async function handleOrphanTopup(
  env: WebhookEnv,
  orderId: string,
  email: string,
  variantId: number | undefined,
): Promise<Response> {
  console.error("[topup-orphan]", { orderId, email, variantId });
  if (env.CONTACT_TO) {
    const detail = JSON.stringify({ orderId, email, variantId });
    await sendEmail(env, {
      to: env.CONTACT_TO,
      subject: `[WritersNook] TOP-UP ORPHAN — manual credit required (order ${orderId})`,
      html: `<p>A top-up order arrived that could not be linked to a subscriber.</p><pre>${detail}</pre><p>Credit manually via Supabase.</p>`,
      text: `A top-up order could not be linked to a subscriber.\n\n${detail}\n\nCredit manually via Supabase.`,
      idempotencyKey: `orphan-topup-${orderId}`,
    });
  }
  // Return 500 so LS retries over its finite window — this auto-heals the late-subscription-row race
  // for clients that didn't send custom_data, and keeps re-attempting the (idempotency-keyed → single)
  // alert until it lands. A permanently-unlinkable order surfaces as a failed webhook in the LS dashboard
  // after LS exhausts retries, by which point the operator alert has been sent. No tombstone is written
  // and topup_credits is not called on this path, so retries are side-effect-free apart from the
  // deduplicated alert.
  return new Response(null, { status: 500 });
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

  // Resolve subscriber for top-up variants BEFORE writing the ledger.
  // Three-tier resolution: custom-data key → email lookup → orphan alert (terminal 200).
  let licenseKey: string | null = null;
  if (isTopupVariant(variantId, env)) {
    // Tier 1: LS custom_data.license_key — passed by the desktop client at checkout.
    // Bypasses the DB lookup entirely; correct even for brand-new subscribers.
    const customKey = payload.meta.custom_data?.license_key;
    if (customKey) {
      licenseKey = customKey;
    } else {
      // Tier 2: email fallback — preserves backward-compat for checkouts without custom data.
      const { data: sub, error: subErr } = await db
        .from("subscriptions")
        .select("license_key")
        .eq("user_email", attrs.user_email)
        .single();
      if (subErr || !sub) {
        // Tier 3: orphan alert — returns 200 (terminal) to stop the LS retry storm.
        return handleOrphanTopup(env, orderId, attrs.user_email, variantId);
      }
      licenseKey = (sub as { license_key: string }).license_key;
    }
  }

  // RPC FIRST (top-up variant only): call topup_credits before the tombstone so a LS
  // retry after RPC failure re-invokes the grant rather than short-circuiting on a
  // committed tombstone. p_request_id matches the tombstone order_id so the SQL-level
  // dedup guard (0005_topup_credits_dedup.sql) catches any double-grant on retry.
  if (licenseKey) {
    const { data: newBalance, error: topupErr } = await db.rpc("topup_credits", {
      p_license_key: licenseKey,
      p_amount: TOPUP_PACK_AMOUNT,
      p_request_id: `order:${orderId}`,
    });
    if (topupErr || newBalance === null) return new Response("Internal Server Error", { status: 500 });
  }

  // Tombstone SECOND: record ALL order_created events regardless of variant.
  // This covers top-up packs, subscription-product initial orders, and unknown variants.
  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: "order_created", order_id: `order:${orderId}` });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

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
  if (eventName === "subscription_payment_refunded") {
    return handlePaymentRefunded(payload as InvoicePayload, context.env);
  }
  if (SUBSCRIPTION_EVENTS.has(eventName)) {
    const subPayload = payload as SubscriptionPayload;
    if (eventName === "subscription_created") return handleCreated(subPayload, context.env);
    return handleStatusUpdate(subPayload, context.env);
  }
  return handleTopupOrder(payload as TopupOrderPayload, context.env);
};
