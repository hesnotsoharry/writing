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

import { renderSuccess, parseOrderFromParams, resolveOrder } from "./purchase-success-render.js";

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

// ---------------------------------------------------------------------------
// parseOrderFromParams — URL query-param fallback source
// ---------------------------------------------------------------------------
const PARAM_QUERY = "?order_id=999&email=buyer%40example.com&total=%2429.00";
// %40 = "@", %24 = "$" — URLSearchParams auto-decodes these.

describe("parseOrderFromParams — builds order object from LS link-variable params", () => {
  it("returns null when order_id param is absent (insufficient for display)", () => {
    expect(parseOrderFromParams("?email=buyer@example.com&total=$29.00")).toBeNull();
    expect(parseOrderFromParams("")).toBeNull();
  });

  it("parses order_id, email, and URL-encoded formatted total into the order shape", () => {
    const o = parseOrderFromParams(PARAM_QUERY);
    expect(o.orderNumber).toBe("999");
    expect(o.email).toBe("buyer@example.com");
    expect(o.totalCents).toBe(2900);
    expect(o.productName).toBe("Writers Nook");
    expect(o.receiptUrl).toBeNull();
  });

  it("defaults productName to 'Writers Nook' when product_name param is absent (app-purchase path)", () => {
    expect(parseOrderFromParams("?order_id=1").productName).toBe("Writers Nook");
  });

  it("reads product_name when present so subscription buyers route to the sub card", () => {
    const o = parseOrderFromParams("?order_id=1&product_name=AI%20Writing%20Assistant");
    expect(o.productName).toBe("AI Writing Assistant");
  });

  it("converts a bare dollar-sign total string to cents", () => {
    const o = parseOrderFromParams("?order_id=1&total=$49.00");
    expect(o.totalCents).toBe(4900);
  });

  it("leaves totalCents null when total param is absent", () => {
    const o = parseOrderFromParams("?order_id=1&email=a@b.com");
    expect(o.totalCents).toBeNull();
  });

  it("leaves email null when email param is absent", () => {
    const o = parseOrderFromParams("?order_id=1");
    expect(o.email).toBeNull();
  });

  it("does not expose a receiptUrl (no param source for it)", () => {
    const o = parseOrderFromParams(PARAM_QUERY + "&receipt_url=https://evil.example.com");
    expect(o.receiptUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveOrder — priority: sessionStorage > query params > null
// ---------------------------------------------------------------------------
describe("resolveOrder — sessionStorage wins over query params; query params win over null", () => {
  it("returns the sessionStorage order unchanged when it is present, ignoring query params", () => {
    const result = resolveOrder(ORDER, PARAM_QUERY);
    expect(result).toBe(ORDER); // strict identity — no copy
  });

  it("falls back to query-param order when sessionStorage is null", () => {
    const result = resolveOrder(null, PARAM_QUERY);
    expect(result).not.toBeNull();
    expect(result.orderNumber).toBe("999");
    expect(result.email).toBe("buyer@example.com");
  });

  it("returns null when both sessionStorage and query params lack an order_id", () => {
    expect(resolveOrder(null, "")).toBeNull();
    expect(resolveOrder(null, "?email=foo@bar.com")).toBeNull();
  });

  it("renders query-param order through renderSuccess with correct display values", () => {
    const v = renderSuccess(resolveOrder(null, PARAM_QUERY));
    expect(v.hasOrder).toBe(true);
    expect(v.email).toBe("buyer@example.com");
    expect(v.orderNumber).toBe("#999");
    expect(v.amount).toBe("$29.00");
    expect(v.product).toBe("Writers Nook");
    expect(v.receiptUrl).toBeNull();
  });
});
