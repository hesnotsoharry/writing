// ============================================================================
// checkout.js — Lemon Squeezy hosted-checkout wiring
// ES module: exported pure function (testable) + DOM wiring on load.
// ============================================================================
/* global window, document, console, sessionStorage, URLSearchParams */

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

  // Visual cleanup: suppress LS branding/description for a focused overlay,
  // and match the pay button to the site's clay accent (tokens.css --accent).
  if (embed) {
    params.set("logo", "0");
    params.set("media", "0");
    params.set("desc", "0");
    params.set("button_color", "#b25a38");
    params.set("button_text_color", "#ffffff");
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

  // Wire the Checkout.Success event: capture order data, then redirect.
  window.LemonSqueezy.Setup({
    eventHandler: function (data) {
      console.debug("[wn-checkout] lemon.js event:", data && data.event);
      if (data && data.event === "Checkout.Success") {
        var d = (data.data) || {};
        try {
          sessionStorage.setItem("wn_order", JSON.stringify({
            email: d.user_email || null,
            orderNumber: (d.order_number != null) ? d.order_number : null,
            totalCents: (d.total != null) ? d.total : null,
            productName: (d.first_order_item || {}).product_name || null,
            receiptUrl: (d.urls || {}).receipt || null,
          }));
        } catch { /* sessionStorage unavailable — page falls back to generic */ }
        // _value uses the actual order total LS already reports (already read
        // above as totalCents) so it's correct for both the one-time app
        // purchase and the AI-subscription checkout without guessing by product.
        if (window.wnTrack) {
          window.wnTrack("purchase", { _value: (d.total != null) ? d.total : 2900 });
        }
        window.location.href = "purchase-success.html";
      }
    },
  });

  // Generic overlay trigger: any element with data-ls-checkout="<configKey>"
  // opens the LS overlay for the variant stored under that key in window.WN_LS.
  // The element keeps its href as a full-page fallback — the click handler is
  // only attached when lemon.js has loaded, so if the script is unavailable the
  // element falls back to its natural navigation.
  var lsEls = document.querySelectorAll("[data-ls-checkout]");
  for (var i = 0; i < lsEls.length; i++) {
    (function (el) {
      var configKey = el.getAttribute("data-ls-checkout");
      var variant = cfg[configKey];
      if (!variant) {
        console.warn("[checkout.js] data-ls-checkout=\"" + configKey + "\" not found in WN_LS config.");
        return;
      }
      el.addEventListener("click", function (e) {
        e.preventDefault();
        if (window.wnTrack) window.wnTrack("subscribe-ai-click");
        window.LemonSqueezy.Url.Open(
          buildCheckoutUrl({ store: cfg.store, variant: variant, embed: true })
        );
      });
    })(lsEls[i]);
  }

  // Pay button → open LS overlay with email + coupon pre-filled.
  // checkout.html specific; guarded so pages without #payBtn skip this block.
  var payBtn = document.getElementById("payBtn");
  if (payBtn) {
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

      if (window.wnTrack) window.wnTrack("checkout-pay");
      window.LemonSqueezy.Url.Open(url);
    });
  }
});
