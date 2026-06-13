import { describe, expect, it } from "vitest";

import { aiMeterStatus, computeUsedPct, parseResetAt } from "../features/ai/ai.helpers";

// Orchestrator-authored Phase G acceptance test (Wave 35) — the client-side billing
// helpers. Implementer adds computeUsedPct + parseResetAt to ai.helpers.ts and may NOT
// modify this file. aiMeterStatus already exists; its thresholds are pinned here as a
// regression guard. The balance-endpoint contract + reset_at-drift fix are verified by
// marketing-side tests the implementer authors per the brief's pinned assertions.

describe("computeUsedPct", () => {
  it("is 0 when the full allowance remains", () => {
    expect(computeUsedPct(1_000_000, 1_000_000)).toBe(0);
  });

  it("is 100 when the balance is drained", () => {
    expect(computeUsedPct(1_000_000, 0)).toBe(100);
  });

  it("is ~50 at half the allowance", () => {
    expect(computeUsedPct(1_000_000, 500_000)).toBe(50);
  });

  it("clamps to 0..100 (balance above allowance, or negative)", () => {
    expect(computeUsedPct(1_000_000, 1_200_000)).toBe(0);
    expect(computeUsedPct(1_000_000, -50)).toBe(100);
  });

  it("returns 0 for a non-positive allowance rather than dividing by zero", () => {
    expect(computeUsedPct(0, 0)).toBe(0);
  });
});

describe("aiMeterStatus thresholds (regression guard)", () => {
  it("Plenty below 55%", () => {
    expect(aiMeterStatus(54, "Resets July 1").label).toBe("Plenty left this month");
  });
  it("About half at 55%", () => {
    expect(aiMeterStatus(55, "Resets July 1").label).toBe("About half left");
  });
  it("Running low at 80% (warn class)", () => {
    const s = aiMeterStatus(80, "Resets July 1");
    expect(s.label).toBe("Running low");
    expect(s.cls).toBe("warn");
  });
  it("Used up at 100% (out class), sub carries the reset label", () => {
    const s = aiMeterStatus(100, "Resets July 1");
    expect(s.label).toBe("Used up");
    expect(s.cls).toBe("out");
    expect(s.sub).toBe("Resets July 1");
  });
});

describe("parseResetAt (fixes the first-month 'resets null' bug)", () => {
  it("returns a real ISO/date string unchanged", () => {
    expect(parseResetAt("2026-07-01T00:00:00Z")).toBe("2026-07-01T00:00:00Z");
  });

  it("returns '' for null (so the UI falls through to 'soon', never 'null')", () => {
    expect(parseResetAt(null)).toBe("");
  });

  it("returns '' for undefined / missing", () => {
    expect(parseResetAt(undefined)).toBe("");
  });

  it("returns '' for the literal string 'null' (the String(null) bug)", () => {
    expect(parseResetAt("null")).toBe("");
  });

  it("returns '' for an empty string", () => {
    expect(parseResetAt("")).toBe("");
  });
});
