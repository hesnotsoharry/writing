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
