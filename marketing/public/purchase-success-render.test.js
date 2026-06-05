// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — purchase-success render contract (m4 P4).
// The implementer MUST make this pass and MUST NOT modify it. It pins the PURE
// renderSuccess(order) mapping — the testable seam that purchase-success.js feeds
// from the in-session checkout handoff (checkout.js writes the order to
// sessionStorage on Checkout.Success, then redirects here). The license key is
// NOT available client-side (D2 Phase-4 resolution): the buyer reaches it via the
// signed `receiptUrl`. `order` is the normalized handoff object, or null on a
// direct/expired visit. No SDK/DOM import here.
// ============================================================================
import { describe, expect, it } from "vitest";

import { renderSuccess } from "./purchase-success-render.js";

const ORDER = {
  email: "nina@writer.com",
  orderNumber: 1042,
  totalCents: 2900,
  productName: "Writers Nook",
  receiptUrl: "https://app.lemonsqueezy.com/my-orders/abc?signature=xyz",
};

describe("renderSuccess — in-session order handoff → success-page view", () => {
  it("maps a captured order to display values", () => {
    const v = renderSuccess(ORDER);
    expect(v.hasOrder).toBe(true);
    expect(v.email).toBe("nina@writer.com");
    expect(v.orderNumber).toBe("#1042");
    expect(v.amount).toBe("$29.00"); // cents → dollars
    expect(v.product).toBe("Writers Nook");
    expect(v.receiptUrl).toBe("https://app.lemonsqueezy.com/my-orders/abc?signature=xyz");
  });

  it("returns a no-order fallback when the handoff is absent (direct/expired visit)", () => {
    const v = renderSuccess(null);
    expect(v.hasOrder).toBe(false);
    expect(v.email).toBeNull();
    expect(v.orderNumber).toBeNull();
    expect(v.amount).toBeNull();
    expect(v.product).toBeNull();
    expect(v.receiptUrl).toBeNull();
  });

  it("formats totals from cents", () => {
    expect(renderSuccess({ ...ORDER, totalCents: 4900 }).amount).toBe("$49.00");
    expect(renderSuccess({ ...ORDER, totalCents: 0 }).amount).toBe("$0.00");
  });

  it("tolerates a missing receipt url (renders the order, no receipt link)", () => {
    const v = renderSuccess({ ...ORDER, receiptUrl: undefined });
    expect(v.hasOrder).toBe(true);
    expect(v.receiptUrl).toBeNull();
  });
});
