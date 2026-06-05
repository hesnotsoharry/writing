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

import { formatPrice } from "./account-render.js";

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
