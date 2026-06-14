// ============================================================================
// purchase-success.js — browser glue for the post-checkout success page.
//
// Reads the normalized order written to sessionStorage by checkout.js
// (key: "wn_order"), calls renderSuccess(), and applies the display values
// to the DOM. Falls back gracefully when sessionStorage is absent or the
// entry has expired (direct visit, incognito clear, etc.).
//
// This file is browser-only and is NOT imported in Vitest tests.
// The pure mapping logic lives in purchase-success-render.js (unit-tested).
// Mirror of the account.js glue pattern.
// ============================================================================
/* global document, window, sessionStorage */

import { renderSuccess, resolveOrder } from "./purchase-success-render.js";

// --------------------------------------------------------------------------
// Apply the renderSuccess view object to the DOM.
// --------------------------------------------------------------------------
function applyViewToDom(v) {
  // Order-summary values
  var succEmail = document.getElementById("succ-email");
  if (succEmail) succEmail.textContent = v.email || "—";

  var succOrder = document.getElementById("succ-order");
  if (succOrder) succOrder.textContent = v.orderNumber || "—";

  var succAmount = document.getElementById("succ-amount");
  if (succAmount) succAmount.textContent = v.amount || "—";

  var succProduct = document.getElementById("succ-product");
  if (succProduct) succProduct.textContent = v.product || "—";

  // Receipt link — show only when URL is available
  var receiptLink = document.getElementById("receipt-link");
  if (receiptLink) {
    if (v.receiptUrl) {
      receiptLink.href = v.receiptUrl;
      receiptLink.style.display = "";
    } else {
      receiptLink.style.display = "none";
    }
  }

  // Lede paragraph — update email reference when order is present
  var ledeEmail = document.getElementById("lede-email");
  if (ledeEmail) {
    if (v.email) {
      ledeEmail.textContent = v.email;
    }
  }

  // When no order is available (direct/expired visit), hide order-specific
  // summary and show the generic fallback note.
  var orderSummary = document.getElementById("order-summary-section");
  var genericNote = document.getElementById("generic-note");
  if (!v.hasOrder) {
    if (orderSummary) orderSummary.style.display = "none";
    if (genericNote) genericNote.style.display = "";
  } else {
    if (orderSummary) orderSummary.style.display = "";
    if (genericNote) genericNote.style.display = "none";
  }
}

// --------------------------------------------------------------------------
// Wire download buttons from window.WN_DL config (set by downloads-config.js).
// Guards: missing config or missing element leaves href="#" intact.
// --------------------------------------------------------------------------
function wireDownloadButtons() {
  var cfg = window.WN_DL || {};
  var macEl = document.getElementById("succ-dl-mac");
  var winEl = document.getElementById("succ-dl-win");
  if (macEl && cfg.macUrl) macEl.href = cfg.macUrl;
  if (winEl && cfg.winUrl) winEl.href = cfg.winUrl;
}

// --------------------------------------------------------------------------
// Main init — runs on DOMContentLoaded.
// --------------------------------------------------------------------------
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    var order = null;
    try {
      var raw = sessionStorage.getItem("wn_order");
      if (raw) {
        order = JSON.parse(raw);
      }
    } catch {
      // sessionStorage unavailable or JSON parse failed — order stays null.
    }

    var v = renderSuccess(resolveOrder(order, window.location.search));
    applyViewToDom(v);
    wireDownloadButtons();

    // Subscription orders: hide app-specific sections and show the sub note.
    // v.product reflects the LS Checkout.Success first_order_item.product_name.
    // The one-time app product is named "Writers Nook" in the LS dashboard;
    // subscription products have distinct names (e.g. "AI Writing Assistant").
    // When product is absent or the name contains "Writers Nook", treat as app.
    var isAppPurchase = !v.hasOrder || !v.product || /writers[\s-]*nook/i.test(v.product);
    if (!isAppPurchase) {
      var hideEl = function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = "none";
      };
      hideEl("app-dl-card");
      hideEl("app-license-card");
      hideEl("app-next-steps");
      var subNote = document.getElementById("sub-note");
      if (subNote) subNote.style.display = "";
    }
  });
}
