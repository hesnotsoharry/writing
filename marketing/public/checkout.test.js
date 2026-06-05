// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — Phase 1 checkout-URL contract.
// The implementer MUST make this pass and MUST NOT modify it. It pins the
// Lemon Squeezy hosted-checkout URL shape the buyer is handed off to
// (research §2): base path, embed overlay, prefilled email, coupon ->
// discount_code, and OMISSION of optional params when empty. Encoding and
// param order are the implementer's choice — assertions parse via `new URL`.
// ============================================================================
import { describe, expect, it } from "vitest";

import { buildCheckoutUrl } from "./checkout.js";

describe("buildCheckoutUrl — LS hosted-checkout URL contract", () => {
  it("builds the canonical overlay URL with prefilled email + discount", () => {
    const url = new URL(
      buildCheckoutUrl({
        store: "my-store",
        variant: "12345",
        email: "buyer@example.com",
        discountCode: "FOUNDERS",
        embed: true,
      }),
    );

    expect(url.origin).toBe("https://my-store.lemonsqueezy.com");
    expect(url.pathname).toBe("/checkout/buy/12345");
    expect(url.searchParams.get("embed")).toBe("1");
    // URLSearchParams decodes the bracketed keys regardless of how they were encoded.
    expect(url.searchParams.get("checkout[email]")).toBe("buyer@example.com");
    expect(url.searchParams.get("checkout[discount_code]")).toBe("FOUNDERS");
  });

  it("omits checkout[email] when no email is given", () => {
    const url = new URL(
      buildCheckoutUrl({ store: "s", variant: "1", embed: true }),
    );
    expect(url.searchParams.has("checkout[email]")).toBe(false);
  });

  it("omits checkout[discount_code] when no coupon is given", () => {
    const url = new URL(
      buildCheckoutUrl({
        store: "s",
        variant: "1",
        email: "a@b.com",
        discountCode: "",
        embed: true,
      }),
    );
    expect(url.searchParams.has("checkout[discount_code]")).toBe(false);
  });

  it("URL-encodes special characters in the email", () => {
    const raw = buildCheckoutUrl({
      store: "s",
      variant: "1",
      email: "a+tag@b.com",
      embed: true,
    });
    // The raw string must not contain a bare '+' or '@' in the email value
    // (they must be percent-encoded so they survive as data, not delimiters).
    const emailValue = new URL(raw).searchParams.get("checkout[email]");
    expect(emailValue).toBe("a+tag@b.com");
  });
});
