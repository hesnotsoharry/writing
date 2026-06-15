// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock acquireSession so key-entry interaction tests don't hit the network.
const { mockAcquireSession } = vi.hoisted(() => ({
  mockAcquireSession: vi.fn<() => Promise<{ token: string; expiresAt: number }>>(),
}));

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: mockAcquireSession,
}));

// Mock the BYOK Tauri IPC boundary so ByokKeyRow's mount effect
// (byokHasKey → invoke) doesn't crash in jsdom where Tauri is absent.
vi.mock("../features/ai/byok.client", () => ({
  byokHasKey: vi.fn().mockResolvedValue(false),
  byokSetKey: vi.fn().mockResolvedValue(undefined),
  byokClearKey: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

import { AiSection } from "../features/settings/Settings.sections";
import { TWEAK_DEFAULTS } from "../features/settings/settings.store";

// Orchestrator-authored Phase H acceptance test (Wave 35) — the Settings Assistant
// section + the selection-affordance tweak flags. Implementer expands AiSection per
// WIRING.md and adds aiSelPill/aiSelMenu to the tweak store; may NOT modify this file.
// LABELS ARE PINNED HERE (the brief uses the same strings) so the contract is exact.
// Note: aiEnabled default stays `true` this wave — the production default-OFF flip is a
// deferred Cole/launch decision (existing-user impact), NOT a Phase H change.

describe("tweak defaults — selection affordances", () => {
  it("aiSelPill defaults ON, aiSelMenu defaults OFF (design: pill on, menu off)", () => {
    expect(TWEAK_DEFAULTS.aiSelPill).toBe(true);
    expect(TWEAK_DEFAULTS.aiSelMenu).toBe(false);
  });

  it("aiConsentGiven still defaults false (consent gates first use)", () => {
    expect(TWEAK_DEFAULTS.aiConsentGiven).toBe(false);
  });

  it("aiEnabled remains true this wave (production default-OFF flip deferred to Cole)", () => {
    expect(TWEAK_DEFAULTS.aiEnabled).toBe(true);
  });
});

describe("AiSection — expanded Settings Assistant section", () => {
  function renderSection() {
    const setTweak = vi.fn();
    const tweaks = {
      ...TWEAK_DEFAULTS,
      aiEnabled: true,
      aiLicenseKey: "",
    };
    render(<AiSection tweaks={tweaks} setTweak={setTweak} />);
    return { setTweak };
  }

  it("renders the enable toggle", () => {
    renderSection();
    expect(screen.getByText("Show AI assistant")).toBeTruthy();
  });

  it("renders the selection-pill toggle", () => {
    renderSection();
    expect(screen.getByText("Ask pill on selection")).toBeTruthy();
  });

  it("renders the right-click-menu toggle", () => {
    renderSection();
    expect(screen.getByText("Right-click menu")).toBeTruthy();
  });

  it("renders the first-run walkthrough replay control", () => {
    renderSection();
    expect(screen.getByText(/Show.*again|Replay/i)).toBeTruthy();
  });

  it("renders the privacy block (locked copy)", () => {
    renderSection();
    expect(
      screen.getByText(/Every byte that leaves this machine is visible and intentional/i),
    ).toBeTruthy();
  });

  it("renders the Your API key row label", () => {
    renderSection();
    expect(screen.getByText("Your API key")).toBeTruthy();
  });

  it("renders the Custom endpoint row with Coming soon button", () => {
    renderSection();
    expect(screen.getByText("Custom endpoint")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
  });

  it("renders AI license key entry row when no key is stored", () => {
    renderSection();
    expect(screen.getByText("AI license key")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verify & activate" })).toBeTruthy();
  });
});

// ── AiKeyEntryRow — verify-then-store state machine ───────────────────────────

describe("AiKeyEntryRow — verify-then-store flow", () => {
  function renderWithNoKey() {
    const setTweak = vi.fn();
    const tweaks = { ...TWEAK_DEFAULTS, aiEnabled: true, aiLicenseKey: "" };
    render(<AiSection tweaks={tweaks} setTweak={setTweak} />);
    return { setTweak };
  }

  it("calls acquireSession with the trimmed key and stores it via setTweak on success", async () => {
    mockAcquireSession.mockResolvedValue({ token: "tok-abc", expiresAt: Date.now() + 3600000 });
    const { setTweak } = renderWithNoKey();
    fireEvent.change(screen.getByPlaceholderText("Paste your subscription key"), {
      target: { value: "  valid-key-123  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & activate" }));
    await waitFor(() => expect(setTweak).toHaveBeenCalledWith("aiLicenseKey", "valid-key-123"));
    expect(mockAcquireSession).toHaveBeenCalledWith("valid-key-123");
  });

  it("shows invalid-key error message when acquireSession rejects with 401", async () => {
    mockAcquireSession.mockRejectedValue(new Error("Session exchange failed: 401"));
    renderWithNoKey();
    fireEvent.change(screen.getByPlaceholderText("Paste your subscription key"), {
      target: { value: "bad-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & activate" }));
    await waitFor(() =>
      expect(screen.getByText("That key wasn't recognised — double-check it and try again.")).toBeTruthy()
    );
  });

  it("shows invalid-key error message when acquireSession rejects with 403", async () => {
    mockAcquireSession.mockRejectedValue(new Error("Session exchange failed: 403"));
    const { setTweak } = renderWithNoKey();
    fireEvent.change(screen.getByPlaceholderText("Paste your subscription key"), {
      target: { value: "expired-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & activate" }));
    await waitFor(() =>
      expect(screen.getByText("That key wasn't recognised — double-check it and try again.")).toBeTruthy()
    );
    expect(setTweak).not.toHaveBeenCalled();
  });

  it("shows network error message when acquireSession rejects without a status code", async () => {
    mockAcquireSession.mockRejectedValue(new Error("Failed to fetch"));
    const { setTweak } = renderWithNoKey();
    fireEvent.change(screen.getByPlaceholderText("Paste your subscription key"), {
      target: { value: "some-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & activate" }));
    await waitFor(() =>
      expect(screen.getByText("Couldn't reach the server — check your connection and try again.")).toBeTruthy()
    );
    expect(setTweak).not.toHaveBeenCalled();
  });

  it("does not call setTweak when acquireSession rejects (key not stored on failure)", async () => {
    mockAcquireSession.mockRejectedValue(new Error("Session exchange failed: 401"));
    const { setTweak } = renderWithNoKey();
    fireEvent.change(screen.getByPlaceholderText("Paste your subscription key"), {
      target: { value: "bad-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify & activate" }));
    await waitFor(() =>
      expect(screen.getByText("That key wasn't recognised — double-check it and try again.")).toBeTruthy()
    );
    expect(setTweak).not.toHaveBeenCalled();
  });

  it("does not call acquireSession when the input is empty or whitespace", () => {
    renderWithNoKey();
    const btn = screen.getByRole("button", { name: "Verify & activate" });
    expect(btn).toBeDisabled();
    expect(mockAcquireSession).not.toHaveBeenCalled();
  });
});
