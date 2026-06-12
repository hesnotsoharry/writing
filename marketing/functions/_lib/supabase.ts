import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  LEMON_SQUEEZY_SIGNING_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  CONTACT_TO?: string;
}

/**
 * Extended environment for AI proxy endpoints (api/ai/).
 * ANTHROPIC_API_KEY and PROXY_SESSION_SECRET are set as Cloudflare secrets
 * via `wrangler secret put` or the Pages dashboard — never committed to source.
 */
export interface AiEnv extends Env {
  ANTHROPIC_API_KEY: string;
  PROXY_SESSION_SECRET: string;
}

/**
 * Extended environment for subscription/webhook endpoints.
 * Variant IDs are set via Cloudflare secret management — never hardcoded.
 * Test-mode IDs: LS_SUB_VARIANT_ID=1782093, LS_TOPUP_VARIANT_ID=1782092.
 * Swap to live IDs at launch (LS test→live gotcha: variant IDs differ per mode).
 */
export interface WebhookEnv extends Env {
  /** LS variant ID for the WritersNook subscription product. */
  LS_SUB_VARIANT_ID?: string;
  /** LS variant ID for the top-up credits pack product. */
  LS_TOPUP_VARIANT_ID?: string;
}

/**
 * Creates a Supabase service-role client for the Workers/Pages edge runtime.
 * Uses the custom-fetch pattern required for Cloudflare's edge runtime —
 * the library's default cross-fetch polyfill is Node-oriented and incompatible
 * with the Workers runtime without this override.
 */
export function makeServiceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
    },
  });
}
