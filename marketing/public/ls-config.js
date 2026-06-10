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
  // live store 2026-06-04). The numeric variant ID (1748920) is the API/webhook
  // identifier — NOT the checkout-URL identifier; don't swap them.
  variantApp: "6e07b36b-d763-429c-8064-a0154c679983", // one-time app purchase (founder $29)
  // Phase 2 — NOT wired yet: the $5/mo Cloud Backup & Sync subscription
  // (numeric variant 1748967; its checkout UUID is TBD when it ships).
};
