// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — account-render contract (m4 P2 + P3).
// The implementer MUST make this pass and MUST NOT modify it. It pins the PURE
// seams that account.js's SDK/network glue feeds:
//   - renderAccount(purchaseRow, email) — purchases row + signed-in email → view (P2).
//   - formatActivation(validateResult)  — the LS /v1/licenses/validate response
//       (public License API, called browser-side with the row's license_key) →
//       an "X of Y" activation-count string, with a "—" fallback (P3).
// No SDK import here (Decision 3) — these are pure mappers.
// ============================================================================
import { describe, expect, it } from "vitest";

import { formatActivation, renderAccount } from "./account-render.js";

const ROW = {
  license_key: "WNOOK-TEST-KEY-0001",
  order_id: "9999",
  product_name: "Writers Nook",
  total: "2900", // cents
  created_at: "2026-06-04T12:00:00.000000Z",
};

describe("renderAccount — purchase row → account view values", () => {
  it("maps a purchase row to display values for the signed-in user", () => {
    const v = renderAccount(ROW, "buyer@example.com");

    expect(v.email).toBe("buyer@example.com");
    expect(v.hasPurchase).toBe(true);
    expect(v.licenseKey).toBe("WNOOK-TEST-KEY-0001");
    expect(v.orderId).toBe("9999");
    expect(v.product).toBe("Writers Nook");
    // total is in cents; rendered as a dollar amount.
    expect(v.amount).toBe("$29.00");
    // purchaseDate is a non-empty human string derived from created_at.
    expect(typeof v.purchaseDate).toBe("string");
    expect(v.purchaseDate).toContain("2026");
  });

  it("returns a no-purchase state when the user is signed in but has no row", () => {
    const v = renderAccount(null, "buyer@example.com");

    expect(v.email).toBe("buyer@example.com");
    expect(v.hasPurchase).toBe(false);
    expect(v.licenseKey).toBeNull();
    expect(v.orderId).toBeNull();
    expect(v.amount).toBeNull();
  });

  it("formats whole-dollar and sub-dollar totals correctly", () => {
    expect(renderAccount({ ...ROW, total: "4900" }, "a@b.com").amount).toBe("$49.00");
    expect(renderAccount({ ...ROW, total: "0" }, "a@b.com").amount).toBe("$0.00");
  });
});

describe("formatActivation — LS license-validate response → activation-count string", () => {
  it("renders 'usage of limit' for a valid, finite license", () => {
    const result = { valid: true, license_key: { activation_usage: 2, activation_limit: 3, status: "active" } };
    expect(formatActivation(result)).toBe("2 of 3");
  });

  it("renders zero activations correctly (no falsy-zero trap)", () => {
    expect(formatActivation({ valid: true, license_key: { activation_usage: 0, activation_limit: 1 } })).toBe("0 of 1");
  });

  it("renders an unlimited license (null limit) as 'usage of ∞'", () => {
    const result = { valid: true, license_key: { activation_usage: 5, activation_limit: null } };
    expect(formatActivation(result)).toBe("5 of ∞");
  });

  it("falls back to '—' when the License API is unreachable (null result)", () => {
    expect(formatActivation(null)).toBe("—");
  });

  it("falls back to '—' for an invalid or malformed response", () => {
    expect(formatActivation({ valid: false, error: "not found", license_key: null })).toBe("—");
    expect(formatActivation({ valid: true })).toBe("—"); // missing license_key
    expect(formatActivation({ valid: true, license_key: { activation_usage: "x", activation_limit: 3 } })).toBe("—"); // non-numeric usage
  });
});
