/**
 * POST /api/webhooks/lemon-squeezy-subscription
 *
 * Handles Lemon Squeezy subscription lifecycle events and top-up pack orders.
 * Mirrors the HMAC verification and webhook_events idempotency ledger from
 * lemon-squeezy.ts; new behavior in a separate file (decision: no cross-contamination).
 *
 * Handled events:
 *   subscription_created       — create subscription row; prefer LS-provided license key;
 *                                fall back to WN-AI- self-mint if absent.
 *   subscription_updated       — update status / reset_at.
 *   subscription_payment_success — monthly reset: balance := MONTHLY_ALLOWANCE.
 *   subscription_expired       — freeze: status='expired', balance preserved.
 *   order_created (top-up)     — += TOPUP_PACK_AMOUNT for matching LS_TOPUP_VARIANT_ID.
 *                                Other variant IDs (subscription product, unknown) are
 *                                recorded in webhook_events as idempotent no-ops.
 *
 * Idempotency: webhook_events ledger (23505 unique violation = already processed).
 * Out-of-order safety: upsert_subscription() ON CONFLICT (ls_subscription_id)
 *   never overwrites license_key once minted; balance only changes via explicit RPCs.
 *
 * Key-mint path (D2, verified 2026-06-12): LS subscription products have "generate
 *   license key" enabled. Prefer the key from the LS payload; WN-AI- self-mint is
 *   the dormant fallback. The email seam always reads the PERSISTED key from the
 *   upsert RETURNING to guard against out-of-order delivery.
 */
import { PostgrestError } from "@supabase/supabase-js";

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
  // LS includes a license_key field when "generate license key" is enabled.
  // Verified active for subscription products (D2, 2026-06-12).
  [key: string]: unknown;
}

interface SubscriptionPayload {
  meta: { event_name: string };
  data: { type: "subscriptions"; id: string; attributes: SubscriptionAttributes };
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

type LsPayload = SubscriptionPayload | TopupOrderPayload;

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

// ── Key mint seam (D2) ────────────────────────────────────────────────────────

/**
 * SEAM: License key extraction — LS-mint path (D2, verified 2026-06-12, PRIMARY).
 * Returns the key if the LS payload carries one; null otherwise (self-mint fallback).
 */
function extractLicenseKey(attrs: SubscriptionAttributes): string | null {
  const key = attrs["license_key"];
  return typeof key === "string" && key.length > 0 ? key : null;
}

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

// ── Subscription event handler ────────────────────────────────────────────────

async function handleSubscriptionEvent(
  payload: SubscriptionPayload,
  env: WebhookEnv,
): Promise<Response> {
  const eventName = payload.meta.event_name;
  const subId = payload.data.id;
  const attrs = payload.data.attributes;

  // Idempotency key: event + subscription + state timestamp (changes per-update)
  const idempotencyKey = `sub:${subId}:${attrs.updated_at}`;
  const db = makeServiceClient(env);

  // Resolve license key: prefer LS-provided (primary path); fall back to self-mint.
  const extracted = extractLicenseKey(attrs);
  const licenseKey = extracted ?? mintNewLicenseKey();
  const selfMinted = extracted === null;

  // Map LS status (expired event always freezes)
  const status =
    eventName === "subscription_expired" ? "expired" : mapStatus(attrs.status);
  const resetAt = attrs.renews_at ? new Date(attrs.renews_at) : null;

  // Upsert subscription row (ON CONFLICT: update status/reset_at; never overwrite key)
  const { data: upsertedKey, error: upsertErr } = await db.rpc("upsert_subscription", {
    p_license_key: licenseKey,
    p_ls_subscription_id: subId,
    p_user_email: attrs.user_email,
    p_status: status,
    p_reset_at: resetAt?.toISOString() ?? null,
  });
  if (upsertErr) return new Response("Internal Server Error", { status: 500 });

  // Mark event in idempotency ledger AFTER the idempotent upsert
  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: eventName, order_id: idempotencyKey });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

  // payment_success: reset balance to monthly allowance
  if (eventName === "subscription_payment_success") {
    const effectiveKey = (upsertedKey as string | null) ?? licenseKey;
    const nextResetAt = resetAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.rpc("reset_credits", {
      p_license_key: effectiveKey,
      p_allowance: MONTHLY_ALLOWANCE,
      p_reset_at: nextResetAt.toISOString(),
      p_request_id: idempotencyKey,
    });
  }

  // subscription_created: email the persisted credential when we self-minted.
  // ALWAYS use the upsert RETURNING key, never the local variable — guards
  // against out-of-order delivery where a prior event stored a different key.
  if (eventName === "subscription_created" && selfMinted) {
    const emailKey = (upsertedKey as string | null) ?? licenseKey;
    await sendSubscriptionKeyEmail(env, attrs.user_email, emailKey);
  }

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

  // Record ALL order_created events in the idempotency ledger regardless of variant.
  // This covers top-up packs, subscription-product initial orders, and unknown variants.
  const { error: ledgerErr } = await db
    .from("webhook_events")
    .insert({ event_name: "order_created", order_id: `order:${orderId}` });
  const ledgerCode = (ledgerErr as PostgrestError | null)?.code;
  if (ledgerCode === "23505") return new Response(null, { status: 200 });
  if (ledgerErr) return new Response("Internal Server Error", { status: 500 });

  if (!isTopupVariant(variantId, env)) {
    // Subscription-variant or unknown-variant order — no credits action.
    // Subscription variants: lifecycle handled via subscription_* events.
    // Unknown variants: idempotent no-op (already ledger-recorded above).
    void isSubscriptionVariant(variantId, env); // acknowledgement; no branch needed
    return new Response(null, { status: 200 });
  }

  // Top-up variant: find the subscriber by email and grant credits.
  const { data: sub, error: subErr } = await db
    .from("subscriptions")
    .select("license_key")
    .eq("user_email", attrs.user_email)
    .single();
  if (subErr || !sub) return new Response("Not Found", { status: 404 });

  const licenseKey = (sub as { license_key: string }).license_key;

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

  if (SUBSCRIPTION_EVENTS.has(eventName)) {
    return handleSubscriptionEvent(payload as SubscriptionPayload, context.env);
  }
  return handleTopupOrder(payload as TopupOrderPayload, context.env);
};
