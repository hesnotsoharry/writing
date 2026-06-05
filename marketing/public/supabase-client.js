// ============================================================================
// supabase-client.js — shared Supabase client (ES module)
//
// Imports supabase-js v2 directly from jsDelivr's ESM CDN so no bundler or
// npm install is required on this static site — the same pattern the research
// doc recommends for multi-page static HTML (wave-m3-magic-link-accounts-research.md §1).
//
// Auth options chosen here:
//   flowType:'implicit'     — tokens in the URL hash, extracted automatically.
//                             The simpler path for static sites; PKCE requires
//                             a server-side code-exchange step we don't have.
//   detectSessionInUrl:true — when the user lands on account.html after
//                             clicking the magic link, the client reads the
//                             access_token from the URL hash and stores it
//                             in localStorage automatically.
//   persistSession:true     — session survives page navigations and reloads.
//   autoRefreshToken:true   — silently refreshes the access token before it
//                             expires so long-lived visits stay authenticated.
//
// This module is browser-only — it imports from a remote CDN URL that is
// unreachable in a Node/Vitest environment. Do NOT import it in tests.
// Pure, side-effect-free logic belongs in form-utils.js (no SDK import).
// ============================================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.WN_SB || {};

// Guard: alert the developer (in the browser console) if the config has not
// been replaced. The client is still created so signin.js can detect the
// unconfigured state and surface a friendly UI message instead of crashing.
if (!cfg.url || cfg.url === "https://REPLACE_PROJECT.supabase.co") {
  console.warn(
    "[supabase-client.js] window.WN_SB.url is a placeholder. " +
      "Replace with your real Supabase project URL from the dashboard " +
      "(Settings → API) before testing the auth flow.",
  );
}

export const supabase = createClient(cfg.url, cfg.anonKey, {
  auth: {
    flowType: "implicit",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
