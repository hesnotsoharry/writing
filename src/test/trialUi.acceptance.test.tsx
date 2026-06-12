// @vitest-environment jsdom
/**
 * Wave 33, Phase 3 — Trial pill in StatusBar and trial-expired ActivationGate variants.
 * Pre-impl oracle mode: assertions from stated intent; behavior unimplemented.
 *
 * Mock boundary (ActivationGate tests):
 *   - ../features/license/activate → activateLicense
 *   - ../features/license/license.store → saveActivation + loadActivation
 *   - @tauri-apps/plugin-opener → openUrl
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks (ActivationGate tests only) ────────────────────────────────

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

// ─── Imports ──────────────────────────────────────────────────────────────────

import { ActivationGate } from "../features/license/ActivationGate";
import { StatusBar } from "../shell/StatusBar";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── StatusBar: Trial pill ─────────────────────────────────────────────────────

describe("StatusBar — trial pill", () => {
  it("case 1: renders pill with plural copy when trialDaysLeft={5}", () => {
    render(
      <StatusBar
        sceneWordCount={null}
        trialDaysLeft={5}
        onTrialPillClick={vi.fn()}
      />
    );
    // EXPECTED FAIL: pill rendering not yet implemented
    const pill = screen.getByRole("button", { name: /5 days left/i });
    expect(pill).toBeTruthy();
  });

  it("case 2: renders pill with singular copy when trialDaysLeft={1}", () => {
    render(
      <StatusBar
        sceneWordCount={null}
        trialDaysLeft={1}
        onTrialPillClick={vi.fn()}
      />
    );
    // EXPECTED FAIL: pill rendering not yet implemented; would fail on singular copy logic
    const pill = screen.getByRole("button", { name: /1 day left/i });
    expect(pill).toBeTruthy();
    // Ensure plural form is NOT rendered
    expect(screen.queryByText(/1 days left/i)).toBeNull();
  });

  it("case 3: pill click calls onTrialPillClick exactly once", () => {
    const onTrialPillClick = vi.fn();
    render(
      <StatusBar
        sceneWordCount={null}
        trialDaysLeft={3}
        onTrialPillClick={onTrialPillClick}
      />
    );
    // EXPECTED FAIL: pill not yet implemented
    const pill = screen.getByRole("button", { name: /3 days left/i });
    fireEvent.click(pill);
    expect(onTrialPillClick).toHaveBeenCalledTimes(1);
  });

  it("case 4: renders no pill when trialDaysLeft prop absent", () => {
    render(<StatusBar sceneWordCount={null} />);
    // EXPECTED PASS: current behavior (no pill rendered when prop absent)
    expect(screen.queryByText(/day(s)? left/i)).toBeNull();
  });

  it("case 5: renders no pill when trialDaysLeft={null}", () => {
    render(<StatusBar sceneWordCount={null} trialDaysLeft={null} />);
    // EXPECTED PASS: current behavior (no pill rendered when null)
    expect(screen.queryByText(/day(s)? left/i)).toBeNull();
  });
});

// ─── ActivationGate: Trial-expired variant ─────────────────────────────────────

describe("ActivationGate — trial-expired variant", () => {
  it("case 6: renders trial-ended copy when trialExpired={true}", () => {
    mockSaveActivation.mockResolvedValue(undefined);
    render(
      <ActivationGate
        onActivated={vi.fn()}
        trialExpired={true}
        onDismiss={vi.fn()}
      />
    );
    // EXPECTED FAIL: trial-expired headline/subhead variant not yet implemented
    expect(
      screen.getByText(/trial.*(ended|expired|over)/i)
    ).toBeTruthy();
  });

  it("case 7: does NOT render trial-ended copy in default render (no trialExpired prop)", () => {
    mockSaveActivation.mockResolvedValue(undefined);
    render(<ActivationGate onActivated={vi.fn()} />);
    // EXPECTED PASS: current GateHead renders standard copy, no trial variant
    expect(screen.queryByText(/trial.*(ended|expired|over)/i)).toBeNull();
    // Verify standard copy is still there
    expect(screen.getByText(/Enter your license key to get started/i)).toBeTruthy();
  });

  it("case 8: renders 'Continue trial' control when onDismiss provided; click calls onDismiss exactly once, not onActivated", () => {
    mockSaveActivation.mockResolvedValue(undefined);
    const onDismiss = vi.fn();
    const onActivated = vi.fn();
    render(
      <ActivationGate
        onActivated={onActivated}
        trialExpired={false}
        onDismiss={onDismiss}
      />
    );
    // EXPECTED FAIL: "continue trial" control not yet implemented
    const dismissControl = screen.getByRole("button", { name: /continue.*trial/i });
    fireEvent.click(dismissControl);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onActivated).not.toHaveBeenCalled();
  });

  it("case 9: does NOT render 'Continue trial' control when onDismiss absent", () => {
    mockSaveActivation.mockResolvedValue(undefined);
    render(<ActivationGate onActivated={vi.fn()} />);
    // EXPECTED PASS: current implementation has no dismiss control
    expect(screen.queryByRole("button", { name: /continue.*trial/i })).toBeNull();
  });

  it("case 10: activation form (license key input) is rendered in both default and trial-expired variants", () => {
    mockSaveActivation.mockResolvedValue(undefined);

    // Default render
    const { rerender } = render(<ActivationGate onActivated={vi.fn()} />);
    expect(
      screen.getByRole("textbox", { name: /license key/i })
    ).toBeTruthy();

    // Trial-expired render
    rerender(
      <ActivationGate
        onActivated={vi.fn()}
        trialExpired={true}
        onDismiss={vi.fn()}
      />
    );
    // EXPECTED PASS: input is always rendered regardless of variant
    expect(
      screen.getByRole("textbox", { name: /license key/i })
    ).toBeTruthy();
  });
});
