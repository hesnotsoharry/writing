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
  store: "REPLACE_WITH_LS_STORE_SUBDOMAIN",  // e.g. "writers-nook"
  variantApp: "REPLACE_WITH_LS_APP_VARIANT_ID", // e.g. "12345"
};
