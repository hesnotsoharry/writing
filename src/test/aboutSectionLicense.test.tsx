// @vitest-environment jsdom
// Wave 30 Phase 4 — license row rendering in the About section.
// Contract: AboutSection renders "Activated · key ending …XXXX" (last 4 chars of
// licenseKey only) when loadActivation returns a record, and "Not activated" when null.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockLoadActivation, mockGetVersion } = vi.hoisted(() => ({
  mockLoadActivation: vi.fn(),
  mockGetVersion: vi.fn().mockResolvedValue("0.0.0"),
}));

vi.mock("../features/license/license.store", () => ({
  loadActivation: mockLoadActivation,
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: mockGetVersion,
}));

import { AboutSection } from "../features/settings/Settings.sections";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AboutSection — license row", () => {
  it("shows 'Activated · key ending …XXXX' with the last 4 chars of the key when activated", async () => {
    mockLoadActivation.mockResolvedValue({
      licenseKey: "ABCD-1234-XXXX-5678",
      instanceId: "inst-abc",
      activatedAt: "2026-06-10T00:00:00.000Z",
    });
    render(<AboutSection />);
    await waitFor(() => {
      expect(screen.getByText("Activated · key ending …5678")).toBeTruthy();
    });
  });

  it("shows only the last 4 characters of the key, not 5 or more", async () => {
    // key "XY-ABCDE": slice(-4)="BCDE", slice(-5)="ABCDE" — proves the mask boundary
    mockLoadActivation.mockResolvedValue({
      licenseKey: "XY-ABCDE",
      instanceId: "inst-abc",
      activatedAt: "2026-06-10T00:00:00.000Z",
    });
    render(<AboutSection />);
    await waitFor(() => {
      const el = screen.getByText(/Activated · key ending/);
      expect(el.textContent).toContain("BCDE");
      expect(el.textContent).not.toContain("ABCDE");
    });
  });

  it("shows 'Not activated' when loadActivation returns null", async () => {
    mockLoadActivation.mockResolvedValue(null);
    render(<AboutSection />);
    await waitFor(() => {
      expect(screen.getByText("Not activated")).toBeTruthy();
    });
  });
});
