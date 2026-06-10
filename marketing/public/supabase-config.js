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
  url: "https://mhflotubzbgzitckgwyv.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZmxvdHViemJneml0Y2tnd3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNTYzMjAsImV4cCI6MjA5NjYzMjMyMH0.eWZyVTO84lGsRhJylB7ZjPMdDUVMlrd1A03JabG1sVg", // Public anon key — safe to commit (RLS-restricted)
};
