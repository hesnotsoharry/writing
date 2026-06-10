// Wave 30 Phase 1 — ORCHESTRATOR-OWNED ACCEPTANCE TEST. Implementers must not modify this file.
// Contract: src/features/license/activate.ts exposes activateLicense(licenseKey) wrapping the
// Rust `activate_license` Tauri command (Decision D2/D3 in roadmap/wave-30-license-activation.md).
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

import { activateLicense } from "../features/license/activate";

describe("activateLicense — consumer contract for the activate_license command", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("invokes the Rust command with the licenseKey argument", async () => {
    mockInvoke.mockResolvedValue({
      activated: true,
      error: null,
      httpStatus: 200,
      instanceId: "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17",
      activationLimit: 3,
      activationUsage: 1,
      licenseStatus: "active",
    });
    await activateLicense("ABC-123");
    expect(mockInvoke).toHaveBeenCalledWith("activate_license", { licenseKey: "ABC-123" });
  });

  it("maps an activated response to ok:true with instance + usage fields", async () => {
    mockInvoke.mockResolvedValue({
      activated: true,
      error: null,
      httpStatus: 200,
      instanceId: "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17",
      activationLimit: 3,
      activationUsage: 2,
      licenseStatus: "active",
    });
    const result = await activateLicense("ABC-123");
    expect(result).toEqual({
      ok: true,
      instanceId: "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17",
      activationLimit: 3,
      activationUsage: 2,
    });
  });

  it("maps a 404 (key not found) to kind invalid_key, preserving the LS message", async () => {
    mockInvoke.mockResolvedValue({
      activated: false,
      error: "license_key not found",
      httpStatus: 404,
      instanceId: null,
      activationLimit: null,
      activationUsage: null,
      licenseStatus: null,
    });
    const result = await activateLicense("nope");
    expect(result).toEqual({
      ok: false,
      kind: "invalid_key",
      message: "license_key not found",
    });
  });

  it("maps a non-404 LS rejection (limit reached / disabled / expired) to kind rejected with the verbatim LS message", async () => {
    mockInvoke.mockResolvedValue({
      activated: false,
      error: "This license key has reached the activation limit.",
      httpStatus: 400,
      instanceId: null,
      activationLimit: 3,
      activationUsage: 3,
      licenseStatus: "active",
    });
    const result = await activateLicense("ABC-123");
    expect(result).toEqual({
      ok: false,
      kind: "rejected",
      message: "This license key has reached the activation limit.",
    });
  });

  it("maps a command rejection (transport/network failure) to kind network — never invalid_key", async () => {
    mockInvoke.mockRejectedValue("could not reach api.lemonsqueezy.com");
    const result = await activateLicense("ABC-123");
    expect(result).toMatchObject({ ok: false, kind: "network" });
    expect(result).not.toMatchObject({ kind: "invalid_key" });
  });
});
