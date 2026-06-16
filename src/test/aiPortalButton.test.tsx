// @vitest-environment jsdom
/**
 * Seam tests for the ManageBillingButton (Settings.ai.tsx) — rendered only when
 * tweaks.aiLicenseKey is non-empty (managed subscriber).
 *
 * Contracts:
 *   - Button is NOT rendered when aiLicenseKey is empty (trial / no subscription).
 *   - Button is rendered when aiLicenseKey is non-empty (managed subscriber).
 *   - Clicking the button: acquires a token → calls getPortalUrl → calls openUrl with the URL.
 *   - On getPortalUrl failure: shows an inline error message.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock factories (vi.hoisted runs before all imports) ───────────────

const { mockAcquireSession, mockGetPortalUrl, mockAcquireAnyToken, mockOpenUrl } = vi.hoisted(() => ({
  mockAcquireSession: vi.fn<() => Promise<{ token: string; expiresAt: number }>>(),
  mockGetPortalUrl: vi.fn<() => Promise<{ url: string }>>(),
  mockAcquireAnyToken: vi.fn<() => Promise<string>>(),
  mockOpenUrl: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: mockAcquireSession,
  getPortalUrl: mockGetPortalUrl,
}));

vi.mock("../features/ai/ai.trialToken", () => ({
  acquireAnyToken: mockAcquireAnyToken,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mockOpenUrl,
}));

// BYOK clients — ByokKeyRow and ByokOpenAiKeyRow call these on mount.
vi.mock("../features/ai/byok.client", () => ({
  byokHasKey: vi.fn().mockResolvedValue(false),
  byokSetKey: vi.fn().mockResolvedValue(undefined),
  byokClearKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/byok.openai.client", () => ({
  byokOpenAiHasKey: vi.fn().mockResolvedValue(false),
  byokOpenAiSetKey: vi.fn().mockResolvedValue(undefined),
  byokOpenAiClearKey: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

// ── Component under test ──────────────────────────────────────────────────────

import { AiSection } from "../features/settings/Settings.sections";
import { TWEAK_DEFAULTS } from "../features/settings/settings.store";

function renderWithKey(licenseKey: string) {
  const setTweak = vi.fn();
  const tweaks = { ...TWEAK_DEFAULTS, aiEnabled: true, aiLicenseKey: licenseKey };
  render(<AiSection tweaks={tweaks} setTweak={setTweak} />);
  return { setTweak };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ManageBillingButton — visibility gate", () => {
  it("does NOT render 'Manage billing' when aiLicenseKey is empty (trial/no-subscription)", () => {
    renderWithKey("");
    expect(screen.queryByRole("button", { name: "Manage billing" })).toBeNull();
  });

  it("renders 'Manage billing' button when aiLicenseKey is non-empty (managed subscriber)", () => {
    renderWithKey("sub-license-key-abc");
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeTruthy();
  });
});

describe("ManageBillingButton — click flow", () => {
  it("acquires a token, calls getPortalUrl, then opens the URL via openUrl", async () => {
    const portalUrl = "https://app.lemonsqueezy.com/my-orders/portal-token-xyz";
    mockAcquireAnyToken.mockResolvedValue("session-token-abc");
    mockGetPortalUrl.mockResolvedValue({ url: portalUrl });

    renderWithKey("sub-license-key-abc");
    fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));

    await waitFor(() => expect(mockOpenUrl).toHaveBeenCalledWith(portalUrl));
    expect(mockAcquireAnyToken).toHaveBeenCalledTimes(1);
    expect(mockGetPortalUrl).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error when getPortalUrl rejects", async () => {
    mockAcquireAnyToken.mockResolvedValue("session-token-abc");
    mockGetPortalUrl.mockRejectedValue(new Error("Portal fetch failed: 502"));

    renderWithKey("sub-license-key-abc");
    fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't open billing portal — check your connection and try again."),
      ).toBeTruthy(),
    );
    expect(mockOpenUrl).not.toHaveBeenCalled();
  });
});
