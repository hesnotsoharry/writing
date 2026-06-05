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
  variantApp: "1748920", // one-time app purchase (founder $29)
  // Phase 2 — NOT wired yet: the $5/mo Cloud Backup & Sync subscription variant.
  // variantSync: "1748967",
};
