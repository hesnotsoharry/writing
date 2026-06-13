// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

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
});
