// ============================================================================
// Supabase project configuration — PUBLIC values.
// The anon key is intentionally browser-visible. It is restricted by Row-Level
// Security (RLS) policies on every table — it cannot access data that the
// authenticated user does not own. It is NOT a secret.
//
// The service-role key (which bypasses RLS) is a secret and lives in the
// gitignored .dev.vars file used by the m1 Cloudflare Worker — NOT here.
//
// Replace the placeholder strings with real values from your Supabase
// dashboard (Settings → API) before testing or shipping the auth flow.
// ============================================================================
window.WN_SB = {
  url: "https://REPLACE_PROJECT.supabase.co",  // e.g. "https://abcxyz123.supabase.co"
  anonKey: "REPLACE_WITH_ANON_KEY",            // Public anon key — safe to commit
};
