// ============================================================================
// ORCHESTRATOR-OWNED ACCEPTANCE TEST — Phase 2 account-render contract.
// The implementer MUST make this pass and MUST NOT modify it. It pins the
// PURE renderAccount(purchaseRow, email) mapping — the testable seam that
// account.js's SDK glue feeds (a purchases row + the signed-in email) and
// applies to the DOM. No SDK import here (Decision 3).
// ============================================================================
import { describe, expect, it } from "vitest";

import { renderAccount } from "./account-render.js";

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
