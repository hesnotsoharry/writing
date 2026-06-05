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

import { renderSuccess } from "./purchase-success-render.js";

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
    } catch (e) {
      // sessionStorage unavailable or JSON parse failed — order stays null.
    }

    var v = renderSuccess(order);
    applyViewToDom(v);
  });
}
