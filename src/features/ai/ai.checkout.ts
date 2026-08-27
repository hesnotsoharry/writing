/**
 * ai.checkout.ts — Lemon Squeezy checkout-URL construction for the managed AI
 * subscription. Shared by the assistant-panel guards and Settings so there is
 * exactly one subscribe/top-up URL builder.
 *
 * Checkout URLs use the variant's public UUID slug (NOT the numeric webhook ID).
 * VITE_LS_AI_SUB_CHECKOUT_VARIANT / VITE_LS_AI_TOPUP_CHECKOUT_VARIANT are set in
 * .env.local at publish time (live slugs) or to test-mode slugs for rehearsals;
 * see marketing/LAUNCH-AI-SUBSCRIPTION.md. When absent, the buttons fall back to
 * the pricing page, which carries its own subscribe control.
 */

const LS_STORE = "writersnookapp";

export const AI_SUB_VARIANT = import.meta.env.VITE_LS_AI_SUB_CHECKOUT_VARIANT as string | undefined;
export const AI_TOPUP_VARIANT = import.meta.env.VITE_LS_AI_TOPUP_CHECKOUT_VARIANT as string | undefined;

export function buildLsCheckoutUrl(variant: string | undefined, licenseKey?: string): string {
  if (!variant) return "https://writersnook.app/pricing";
  const url = `https://${LS_STORE}.lemonsqueezy.com/checkout/buy/${variant}`;
  return licenseKey ? `${url}?checkout[custom][license_key]=${encodeURIComponent(licenseKey)}` : url;
}
