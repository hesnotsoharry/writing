import { describe, expect, it } from "vitest";

import { activateMobileLicense, parseActivationBody } from "./mobileActivation";

describe("mobile activation response validation", () => {
  it("parses the documented Lemon Squeezy response shape", () => {
    expect(parseActivationBody({ activated: true, error: null, instance: { id: "phone-instance" },
      license_key: { activation_limit: 3, activation_usage: 2, status: "active" },
      meta: { variant_id: 1_773_908 } })).toEqual({ activated: true, error: null,
      instanceId: "phone-instance", activationLimit: 3, activationUsage: 2, variantId: 1_773_908 });
  });

  it("leaves missing product identity absent so activation fails closed", () => {
    expect(parseActivationBody({ activated: true, instance: { id: "wrong" } })?.variantId).toBeNull();
  });

  it("rejects missing or wrong variants and returns the phone instance for WritersNook", async () => {
    const response = (body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
    await expect(activateMobileLicense("key", response({ activated: true,
      instance: { id: "desktop-instance" } }))).resolves.toMatchObject({ ok: false, kind: "rejected" });
    await expect(activateMobileLicense("key", response({ activated: true,
      instance: { id: "other-product" }, meta: { variant_id: 999 } })))
      .resolves.toMatchObject({ ok: false, kind: "rejected" });
    await expect(activateMobileLicense("key", response({ activated: true,
      instance: { id: "phone-instance" }, license_key: { activation_limit: 3, activation_usage: 2 },
      meta: { variant_id: 1_773_908 } }))).resolves.toEqual({ ok: true,
      instanceId: "phone-instance", activationLimit: 3, activationUsage: 2 });
  });
});
