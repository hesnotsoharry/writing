/* global window */
// ============================================================================
// Lemon Squeezy store configuration — PUBLIC values.
// These appear in the checkout URL visible in the browser; they are NOT
// secrets. Replace the placeholder strings with real values from the LS
// dashboard before testing or shipping.
//
// The webhook signing secret (used in the server-side verify worker) is a
// secret and lives in the gitignored .dev.vars file — NOT here.
// ============================================================================
window.WN_LS = {
  store: "writersnookapp", // writersnookapp.lemonsqueezy.com
  // The CHECKOUT URL uses the variant's public UUID slug (verified against the
  // LIVE store 2026-06-10, post test→live flip). The numeric variant ID
  // (live 1773908; test-mode was 1748920) is the API/webhook identifier — NOT
  // the checkout-URL identifier; don't swap them.
  variantApp: "5722d58c-f3e9-46cf-9d29-a84ecf338723", // one-time app purchase (founder $29)
  // Phase 2 — NOT wired yet: the $5/mo Device Sync subscription (relay-based,
  // end-to-end encrypted, no server-side storage of user content).
  // (numeric variant 1748967; its checkout UUID is TBD when it ships).
};
