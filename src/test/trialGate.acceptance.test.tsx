// @vitest-environment jsdom
/**
 * Wave 33, Phase 2 — useLicenseGate trial boot behavior (oracle acceptance test).
 *
 * Pre-impl oracle mode: written against stated intent, not current implementation.
 * Trial-path cases (3–6) FAIL today because the hook returns 'needed' instead of
 * 'trial' and daysLeft is always null (unimplemented). Assertions operationalize
 * the brief's contract, not current behavior.
 *
 * Mock boundary:
 *   - ../features/license/license.store → loadActivation
 *   - ../features/license/trial.store → loadTrial, saveTrial
 *   (do NOT mock ../features/license/trial — use computeTrialStatus real impl)
 */
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockLoadActivation, mockLoadTrial, mockSaveTrial } = vi.hoisted(() => ({
  mockLoadActivation: vi.fn(),
  mockLoadTrial: vi.fn(),
  mockSaveTrial: vi.fn(),
}));

vi.mock("../features/license/license.store", () => ({
  loadActivation: mockLoadActivation,
}));

vi.mock("../features/license/trial.store", () => ({
  loadTrial: mockLoadTrial,
  saveTrial: mockSaveTrial,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { useLicenseGate } from "../features/license/license.gate";

const STORED_ACTIVATION = {
  licenseKey: "KEY-1234",
  instanceId: "inst-abc",
  activatedAt: "2026-06-10T00:00:00.000Z",
};

const STORED_TRIAL_10_DAYS_OLD = {
  trialStartedAt: "2026-06-01T00:00:00.000Z",
  lastSeenAt: "2026-06-01T00:00:00.000Z",
};

const STORED_TRIAL_20_DAYS_OLD = {
  trialStartedAt: "2026-05-22T00:00:00.000Z",
  lastSeenAt: "2026-05-22T00:00:00.000Z",
};

const STORED_TRIAL_WITH_FUTURE_LASTSEEN = {
  trialStartedAt: "2026-05-20T00:00:00.000Z",
  lastSeenAt: "2026-06-15T00:00:00.000Z", // future relative to mocked now
};

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

// ─── Case 1: dbReady false → gateStatus 'checking', no store calls ──────────

describe("useLicenseGate — Case 1: dbReady=false", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays in 'checking' state when dbReady is false", async () => {
    const { result } = renderHook(() => useLicenseGate(false));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.gateStatus).toBe("checking");
    expect(mockLoadActivation).not.toHaveBeenCalled();
    expect(mockLoadTrial).not.toHaveBeenCalled();
  });
});

// ─── Case 2: License record exists → 'cleared', no trial write ───────────────

describe("useLicenseGate — Case 2: license present", () => {
  it("becomes 'cleared' when loadActivation returns a record", async () => {
    mockLoadActivation.mockResolvedValue(STORED_ACTIVATION);
    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("cleared"));
    expect(mockLoadActivation).toHaveBeenCalledTimes(1);
    expect(mockLoadTrial).not.toHaveBeenCalled();
    expect(mockSaveTrial).not.toHaveBeenCalled();
  });
});

// ─── Case 3: No license, no trial record → START trial ──────────────────────

describe("useLicenseGate — Case 3: no license, no trial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
  });

  it("becomes 'trial' when no license and trial is started fresh", async () => {
    mockLoadActivation.mockResolvedValue(null);
    mockLoadTrial.mockResolvedValue(null);
    mockSaveTrial.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("trial"));

    expect(result.current.daysLeft).toBe(14);
    expect(result.current.trialExpired).toBe(false);
  });

  it("calls saveTrial once with both timestamps set to current time", async () => {
    mockLoadActivation.mockResolvedValue(null);
    mockLoadTrial.mockResolvedValue(null);
    mockSaveTrial.mockResolvedValue(undefined);

    renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(mockSaveTrial).toHaveBeenCalledTimes(1));

    const [savedRecord] = mockSaveTrial.mock.calls[0] as [
      { trialStartedAt: string; lastSeenAt: string },
    ];
    expect(savedRecord.trialStartedAt).toBe("2026-06-11T00:00:00.000Z");
    expect(savedRecord.lastSeenAt).toBe("2026-06-11T00:00:00.000Z");
  });
});

// ─── Case 4: No license, ACTIVE trial → compute daysLeft, bump lastSeenAt ────

describe("useLicenseGate — Case 4: no license, active trial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
  });

  it("becomes 'trial' with daysLeft computed when trial is active", async () => {
    mockLoadActivation.mockResolvedValue(null);
    // Trial started 2026-06-01, now 2026-06-11 → 10 days elapsed, 4 days left
    mockLoadTrial.mockResolvedValue(STORED_TRIAL_10_DAYS_OLD);
    mockSaveTrial.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("trial"));

    expect(result.current.daysLeft).toBe(4);
    expect(result.current.trialExpired).toBe(false);
  });

  it("persists a lastSeenAt bump while preserving original trialStartedAt", async () => {
    mockLoadActivation.mockResolvedValue(null);
    mockLoadTrial.mockResolvedValue(STORED_TRIAL_10_DAYS_OLD);
    mockSaveTrial.mockResolvedValue(undefined);

    renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(mockSaveTrial).toHaveBeenCalledTimes(1));

    const [savedRecord] = mockSaveTrial.mock.calls[0] as [
      { trialStartedAt: string; lastSeenAt: string },
    ];
    expect(savedRecord.trialStartedAt).toBe("2026-06-01T00:00:00.000Z"); // unchanged
    expect(savedRecord.lastSeenAt).toBe("2026-06-11T00:00:00.000Z"); // bumped to now
  });
});

// ─── Case 5: No license, EXPIRED trial → 'needed', trialExpired true ─────────

describe("useLicenseGate — Case 5: no license, expired trial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
  });

  it("becomes 'needed' with trialExpired true when trial is expired", async () => {
    mockLoadActivation.mockResolvedValue(null);
    // Trial started 2026-05-22, now 2026-06-11 → 20 days elapsed, trial is expired
    mockLoadTrial.mockResolvedValue(STORED_TRIAL_20_DAYS_OLD);
    mockSaveTrial.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("needed"));

    expect(result.current.trialExpired).toBe(true);
    expect(result.current.daysLeft).toBeNull();
  });

  it("still persists lastSeenAt bump when trial is expired", async () => {
    mockLoadActivation.mockResolvedValue(null);
    mockLoadTrial.mockResolvedValue(STORED_TRIAL_20_DAYS_OLD);
    mockSaveTrial.mockResolvedValue(undefined);

    renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(mockSaveTrial).toHaveBeenCalledTimes(1));

    const [savedRecord] = mockSaveTrial.mock.calls[0] as [
      { trialStartedAt: string; lastSeenAt: string },
    ];
    expect(savedRecord.trialStartedAt).toBe("2026-05-22T00:00:00.000Z"); // unchanged
    expect(savedRecord.lastSeenAt).toBe("2026-06-11T00:00:00.000Z"); // bumped to now
  });
});

// ─── Case 6: Clock rollback → lastSeenAt in future, don't move backwards ─────

describe("useLicenseGate — Case 6: clock rollback defense", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
  });

  it("still becomes 'needed' when lastSeenAt is in the future", async () => {
    mockLoadActivation.mockResolvedValue(null);
    // lastSeenAt is 2026-06-15, mocked now is 2026-06-11 (user rolled clock back)
    // Trial started 2026-05-20, so it's 26 days old → expired
    mockLoadTrial.mockResolvedValue(STORED_TRIAL_WITH_FUTURE_LASTSEEN);
    mockSaveTrial.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("needed"));

    expect(result.current.trialExpired).toBe(true);
  });

  it("does not move lastSeenAt backwards when persisting", async () => {
    mockLoadActivation.mockResolvedValue(null);
    mockLoadTrial.mockResolvedValue(STORED_TRIAL_WITH_FUTURE_LASTSEEN);
    mockSaveTrial.mockResolvedValue(undefined);

    renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(mockSaveTrial).toHaveBeenCalledTimes(1));

    const [savedRecord] = mockSaveTrial.mock.calls[0] as [
      { trialStartedAt: string; lastSeenAt: string },
    ];
    // lastSeenAt must be max(now, stored) → the stored future timestamp
    expect(savedRecord.lastSeenAt).toBe("2026-06-15T00:00:00.000Z");
  });
});

// ─── Case 7: onActivated during trial → flip to 'cleared' ────────────────────

describe("useLicenseGate — Case 7: onActivated during trial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
  });

  it("transitions gateStatus from 'trial' to 'cleared' when onActivated is called", async () => {
    mockLoadActivation.mockResolvedValue(null);
    mockLoadTrial.mockResolvedValue(STORED_TRIAL_10_DAYS_OLD);
    mockSaveTrial.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("trial"));

    act(() => result.current.onActivated());
    expect(result.current.gateStatus).toBe("cleared");
  });
});

// ─── Case 8: loadActivation rejects → fallthrough to trial path ──────────────

describe("useLicenseGate — Case 8: loadActivation rejection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T00:00:00.000Z"));
  });

  it("falls through to trial path when loadActivation rejects", async () => {
    mockLoadActivation.mockRejectedValue(new Error("db error"));
    mockLoadTrial.mockResolvedValue(null);
    mockSaveTrial.mockResolvedValue(undefined);

    const { result } = renderHook(() => useLicenseGate(true));
    await waitFor(() => expect(result.current.gateStatus).toBe("trial"));

    expect(mockLoadTrial).toHaveBeenCalledTimes(1);
    expect(mockSaveTrial).toHaveBeenCalledTimes(1);
  });
});
