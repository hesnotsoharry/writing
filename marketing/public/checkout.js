// ============================================================================
// checkout.js — Lemon Squeezy hosted-checkout wiring
// ES module: exported pure function (testable) + DOM wiring on load.
// ============================================================================

/**
 * Build a Lemon Squeezy hosted-checkout URL.
 *
 * @param {object} opts
 * @param {string} opts.store        - LS store subdomain (e.g. "my-store")
 * @param {string} opts.variant      - LS product variant ID
 * @param {string} [opts.email]      - Pre-fill buyer email; omitted when falsy
 * @param {string} [opts.discountCode] - Coupon code to apply; omitted when falsy
 * @param {boolean} [opts.embed]     - true = overlay mode (embed=1)
 * @returns {string} Absolute checkout URL
 */
export function buildCheckoutUrl({ store, variant, email, discountCode, embed }) {
  const base = `https://${store}.lemonsqueezy.com/checkout/buy/${variant}`;
  const params = new URLSearchParams();

  if (embed) params.set("embed", "1");

  // Visual cleanup: suppress LS branding/description for a focused overlay.
  if (embed) {
    params.set("logo", "0");
    params.set("media", "0");
    params.set("desc", "0");
  }

  if (email) params.set("checkout[email]", email);
  if (discountCode) params.set("checkout[discount_code]", discountCode);

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ============================================================================
// DOM wiring — runs after the document is parsed.
// Depends on window.WN_LS (ls-config.js, loaded before this module) and
// window.LemonSqueezy (lemon.js CDN script, loaded before this module).
// Guard: the module is also imported in a Node/Vitest context for unit tests;
// skip all DOM work when document is not available.
// ============================================================================
if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  // Guard: ls-config.js must be loaded before this module.
  const cfg = window.WN_LS;
  if (!cfg || !cfg.store || !cfg.variantApp) {
    console.warn("[checkout.js] window.WN_LS not configured — checkout disabled.");
    return;
  }

  // Initialize lemon.js. Current versions expose window.createLemonSqueezy()
  // which must be called to populate window.LemonSqueezy (.Setup/.Url.Open);
  // older auto-init behavior is gone. (Script: assets.lemonsqueezy.com/lemon.js —
  // the app.lemonsqueezy.com/js/lemon.js URL now serves an HTML redirect that
  // breaks when loaded as a <script src>.)
  if (typeof window.createLemonSqueezy === "function") {
    window.createLemonSqueezy();
  }

  // Guard: lemon.js must have loaded + initialized.
  if (typeof window.LemonSqueezy === "undefined") {
    console.warn("[checkout.js] LemonSqueezy unavailable — lemon.js may not have loaded. Checkout disabled.");
    return;
  }

  // Wire the Checkout.Success event: redirect to the thank-you page.
  window.LemonSqueezy.Setup({
    eventHandler: function (data) {
      if (data && data.event === "Checkout.Success") {
        window.location.href = "purchase-success.html";
      }
    },
  });

  // Pay button → open LS overlay with email + coupon pre-filled.
  var payBtn = document.getElementById("payBtn");
  if (!payBtn) return;

  payBtn.addEventListener("click", function () {
    var email = (document.getElementById("email") || {}).value || "";
    var couponInput = document.getElementById("coupon");
    var discountCode = couponInput ? (couponInput.value || "").trim().toUpperCase() : "";

    var url = buildCheckoutUrl({
      store: cfg.store,
      variant: cfg.variantApp,
      email: email || undefined,
      discountCode: discountCode || undefined,
      embed: true,
    });

    window.LemonSqueezy.Url.Open(url);
  });
});
