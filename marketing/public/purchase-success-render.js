// ============================================================================
// purchase-success-render.js — PURE mapping layer (no SDK, no DOM).
//
// renderSuccess(order) maps the normalized checkout handoff object (written to
// sessionStorage by checkout.js on Checkout.Success) to a flat display-value
// object that purchase-success.js applies to the DOM.
//
// The license key is NOT available client-side (D2 Phase-4 resolution). The
// buyer reaches it via the signed receiptUrl provided by Lemon Squeezy.
//
// order shape (from checkout.js sessionStorage write):
//   { email, orderNumber, totalCents, productName, receiptUrl }
//   or null on a direct / expired visit.
// ============================================================================
/* global URLSearchParams */

import { formatPrice } from "./account-render.js";

/**
 * Parse URL query parameters into a normalized order object compatible with
 * renderSuccess(). Used when the sessionStorage handoff from checkout.js is
 * absent (direct link, incognito, different-tab redirect).
 *
 * Accepted params (all untrusted — rendered via textContent only):
 *   order_id     — maps to orderNumber (minimum required; returns null if absent)
 *   email        — buyer email
 *   total        — formatted price string, e.g. "$29.00" (LS link variable [total])
 *   product_name — LS product name (link variable [product_name]); drives the
 *                  app-vs-subscription card routing in purchase-success.js. Falls
 *                  back to "Writers Nook" so the app-purchase path is unchanged
 *                  when LS does not supply it.
 *
 * Excluded params: license_key (never read; key reaches buyer via receiptUrl).
 *
 * @param {string} search — URL search string, e.g. "?order_id=123&email=..."
 * @returns {{ email: string|null, orderNumber: string, totalCents: number|null, productName: string, receiptUrl: null }|null}
 */
export function parseOrderFromParams(search) {
  const params = new URLSearchParams(search);
  const orderId = params.get("order_id");
  if (!orderId) return null; // order_id is the minimum required field

  const email = params.get("email") || null;

  let totalCents = null;
  const totalStr = params.get("total");
  if (totalStr) {
    // Strip currency symbols / whitespace, keep digits and decimal point.
    const numeric = parseFloat(totalStr.replace(/[^0-9.]/g, ""));
    if (isFinite(numeric)) totalCents = Math.round(numeric * 100);
  }

  // Default to the app product name so the existing one-time-purchase path is
  // unchanged; subscription confirmation URLs pass [product_name] so the
  // fallback path routes the buyer to the subscription card, not the app cards.
  const productName = params.get("product_name") || "Writers Nook";

  return {
    email,
    orderNumber: orderId,
    totalCents,
    productName,
    receiptUrl: null,
  };
}

/**
 * Resolve the canonical order object from two sources, in priority order:
 *   1. sessionStorage handoff (checkout.js writes this on Checkout.Success)
 *   2. URL query parameters (Lemon Squeezy confirmation-button link variables)
 *   3. null  →  renderSuccess() returns the graceful fallback
 *
 * Keeping this logic in the pure layer makes the priority rule unit-testable
 * without a browser.
 *
 * @param {object|null} sessionOrder — parsed sessionStorage order, or null
 * @param {string}      search       — window.location.search string
 * @returns {object|null}
 */
export function resolveOrder(sessionOrder, search) {
  if (sessionOrder) return sessionOrder;
  return parseOrderFromParams(search);
}

/**
 * Map a captured order (or null) to a success-page display-value object.
 *
 * @param {{ email: string|null, orderNumber: number|string|null, totalCents: number|null, productName: string|null, receiptUrl: string|null }|null} order
 * @returns {{ hasOrder: boolean, email: string|null, orderNumber: string|null, amount: string|null, product: string|null, receiptUrl: string|null }}
 */
export function renderSuccess(order) {
  if (!order) {
    return {
      hasOrder: false,
      email: null,
      orderNumber: null,
      amount: null,
      product: null,
      receiptUrl: null,
    };
  }

  return {
    hasOrder: true,
    email: order.email ?? null,
    orderNumber: order.orderNumber != null ? "#" + order.orderNumber : null,
    amount: order.totalCents != null ? formatPrice(String(order.totalCents)) : null,
    product: order.productName ?? null,
    receiptUrl: order.receiptUrl ?? null,
  };
}
