// @vitest-environment jsdom
/**
 * Wave 30, Phase 3 — ActivationGate component + useLicenseGate hook tests.
 *
 * Mock boundary:
 *   - ../features/license/activate → activateLicense (not invoke; tests the gate's
 *     behaviour given activate results, not the activate→invoke mapping)
 *   - ../features/license/license.store → saveActivation + loadActivation
 *   - @tauri-apps/plugin-opener → openUrl
 */
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockActivateLicense, mockSaveActivation, mockLoadActivation, mockOpenUrl } =
  vi.hoisted(() => ({
    mockActivateLicense: vi.fn(),
    mockSaveActivation: vi.fn(),
    mockLoadActivation: vi.fn(),
    mockOpenUrl: vi.fn(),
  }));

vi.mock("../features/license/activate", () => ({
  activateLicense: mockActivateLicense,
}));

vi.mock("../features/license/license.store", () => ({
  saveActivation: mockSaveActivation,
  loadActivation: mockLoadActivation,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mockOpenUrl,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { ActivationGate } from "../features/license/ActivationGate";
import { useLicenseGate } from "../features/license/license.gate";

const ACTIVATED_OK = {
  ok: true as const,
  instanceId: "inst-abc",
  activationLimit: 3,
  activationUsage: 1,
};

const INVALID_KEY_RESULT = {
  ok: false as const,
  kind: "invalid_key" as const,
  message: "license_key not found",
};

const REJECTED_RESULT = {
  ok: false as const,
  kind: "rejected" as const,
  message: "This license key has reached the activation limit.",
};

const NETWORK_RESULT = {
  ok: false as const,
  kind: "network" as const,
  message: "DNS lookup failed",
};

const STORED_RECORD = {
  licenseKey: "KEY-1234",
  instanceId: "inst-abc",
  activatedAt: "2026-06-10T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── ActivationGate component tests ──────────────────────────────────────────

describe("ActivationGate — rendering", () => {
  it("renders the input and Activate button in idle state", () => {
    const onActivated = vi.fn();
    render(<ActivationGate onActivated={onActivated} />);
    expect(screen.getByRole("textbox", { name: /license key/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /activate/i })).toBeTruthy();
    expect(screen.getByText(/your key is in your purchase email/i)).toBeTruthy();
  });

  it("renders the Buy WritersNook link", () => {
    render(<ActivationGate onActivated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /buy writersnook/i })).toBeTruthy();
  });
});

describe("ActivationGate — error states produce three distinct messages", () => {
  beforeEach(() => {
    mockSaveActivation.mockResolvedValue(undefined);
  });

  it("invalid_key shows the friendly 'double-check your email' message", async () => {
    mockActivateLicense.mockResolvedValue(INVALID_KEY_RESULT);
    render(<ActivationGate onActivated={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "bad-key" } });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/double-check your purchase email/i),
      ).toBeTruthy();
    });
  });

  it("rejected shows the verbatim LS message, not the friendly message", async () => {
    mockActivateLicense.mockResolvedValue(REJECTED_RESULT);
    render(<ActivationGate onActivated={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "used-key" } });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));
    await waitFor(() => {
      expect(
        screen.getByText("This license key has reached the activation limit."),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/double-check your purchase email/i)).toBeNull();
    expect(screen.queryByText(/couldn't reach the license server/i)).toBeNull();
  });

  it("network shows the 'couldn't reach' message, not the verbatim LS message", async () => {
    mockActivateLicense.mockResolvedValue(NETWORK_RESULT);
    render(<ActivationGate onActivated={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "any-key" } });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/couldn't reach the license server/i),
      ).toBeTruthy();
    });
    expect(screen.queryByText("DNS lookup failed")).toBeNull();
  });
});

describe("ActivationGate — success path calls saveActivation before onActivated", () => {
  it("saveActivation is called and resolves before onActivated fires", async () => {
    const callOrder: string[] = [];
    mockActivateLicense.mockResolvedValue(ACTIVATED_OK);
    mockSaveActivation.mockImplementation(async () => {
      callOrder.push("save");
    });
    const onActivated = vi.fn(() => callOrder.push("activated"));

    render(<ActivationGate onActivated={onActivated} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "KEY-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1));
    expect(callOrder).toEqual(["save", "activated"]);
  });

  it("saveActivation is called with the correct record shape", async () => {
    mockActivateLicense.mockResolvedValue(ACTIVATED_OK);
    mockSaveActivation.mockResolvedValue(undefined);
    const onActivated = vi.fn();

    render(<ActivationGate onActivated={onActivated} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " KEY-1234 " } });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => expect(mockSaveActivation).toHaveBeenCalledTimes(1));
    const [record] = mockSaveActivation.mock.calls[0] as [typeof STORED_RECORD];
    expect(record.licenseKey).toBe("KEY-1234"); // trimmed
    expect(record.instanceId).toBe("inst-abc");
    expect(typeof record.activatedAt).toBe("string");
  });
});

describe("ActivationGate — save-failure path shows Retry without re-calling activate", () => {
  it("shows Retry button when saveActivation throws, does not show Activate button", async () => {
    mockActivateLicense.mockResolvedValue(ACTIVATED_OK);
    mockSaveActivation.mockRejectedValue(new Error("disk full"));

    render(<ActivationGate onActivated={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "KEY-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry saving/i })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /^activate$/i })).toBeNull();
  });

  it("Retry re-calls saveActivation with same data, does NOT call activateLicense again", async () => {
    mockActivateLicense.mockResolvedValue(ACTIVATED_OK);
    mockSaveActivation
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValueOnce(undefined);
    const onActivated = vi.fn();

    render(<ActivationGate onActivated={onActivated} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "KEY-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry saving/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /retry saving/i }));

    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1));
    expect(mockActivateLicense).toHaveBeenCalledTimes(1); // no second call
    expect(mockSaveActivation).toHaveBeenCalledTimes(2); // first (failed) + retry
  });
});

// ─── useLicenseGate hook tests ────────────────────────────────────────────────

describe("useLicenseGate — gate shows when no activation record", () => {
  it("gateStatus becomes 'needed' when loadActivation returns null", async () => {
    mockLoadActivation.mockResolvedValue(null);
    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("needed"));
    expect(mockLoadActivation).toHaveBeenCalledTimes(1);
  });

  it("gateStatus becomes 'cleared' when loadActivation returns a record", async () => {
    mockLoadActivation.mockResolvedValue(STORED_RECORD);
    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("cleared"));
  });

  it("stays 'checking' while dbReady is false", async () => {
    mockLoadActivation.mockResolvedValue(null);
    const { result } = renderHook(() => useLicenseGate(false));
    // Give the effect a chance to run (it should not, since dbReady is false)
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.gateStatus).toBe("checking");
    expect(mockLoadActivation).not.toHaveBeenCalled();
  });
});

describe("useLicenseGate — DEV bypass skips gate when flag set", () => {
  it("gateStatus becomes 'cleared' without calling loadActivation when bypass flag is '1'", async () => {
    localStorage.setItem("writing.devLicenseBypass", "1");
    mockLoadActivation.mockResolvedValue(null); // would return null if called
    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("cleared"));
    // loadActivation must NOT have been called — bypass short-circuits it
    expect(mockLoadActivation).not.toHaveBeenCalled();
  });

  it("does NOT bypass when flag is absent, even in DEV", async () => {
    // localStorage is cleared in afterEach; no flag set here
    mockLoadActivation.mockResolvedValue(null);
    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("needed"));
    expect(mockLoadActivation).toHaveBeenCalledTimes(1);
  });
});

describe("useLicenseGate — onActivated clears the gate", () => {
  it("calling onActivated transitions gateStatus to 'cleared'", async () => {
    mockLoadActivation.mockResolvedValue(null);
    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("needed"));
    act(() => result.current.onActivated());
    expect(result.current.gateStatus).toBe("cleared");
  });
});
