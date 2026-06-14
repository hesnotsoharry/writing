/**
 * Orchestrator-owned acceptance test — Wave 39 trial-gating constants (Phase 1).
 *
 * Boundary contract: the trial dollar-allowance + abuse-cap dials are config constants
 * in credits.ts (credit unit = $0.00001 per ai-token.ts). The implementer may NOT modify
 * this file — it expresses the contract from the consumer's perspective.
 *
 *   TRIAL_ALLOWANCE              = 150_000   units = $1.50  (per-trial bucket)
 *   GLOBAL_DAILY_TRIAL_SPEND_CAP = 2_500_000 units = $25.00 (hard daily ceiling — Cole-locked)
 *   PER_IP_DAILY_GRANT_CAP       = 3                       (grants / IP / UTC-day)
 */
import { describe, expect, it } from "vitest";

import {
  GLOBAL_DAILY_TRIAL_SPEND_CAP,
  PER_IP_DAILY_GRANT_CAP,
  TRIAL_ALLOWANCE,
} from "./credits";
import { CREDIT_UNIT_USD } from "./ai-token";

describe("Wave 39 trial-gating constants (orchestrator-owned acceptance)", () => {
  it("TRIAL_ALLOWANCE is 150_000 units == $1.50", () => {
    expect(TRIAL_ALLOWANCE).toBe(150_000);
    expect(TRIAL_ALLOWANCE * CREDIT_UNIT_USD).toBeCloseTo(1.5, 10);
  });

  it("GLOBAL_DAILY_TRIAL_SPEND_CAP is 2_500_000 units == $25.00/day", () => {
    expect(GLOBAL_DAILY_TRIAL_SPEND_CAP).toBe(2_500_000);
    expect(GLOBAL_DAILY_TRIAL_SPEND_CAP * CREDIT_UNIT_USD).toBeCloseTo(25, 10);
  });

  it("PER_IP_DAILY_GRANT_CAP is 3 grants/IP/day", () => {
    expect(PER_IP_DAILY_GRANT_CAP).toBe(3);
  });

  it("the daily ceiling holds at least 10 full trial allowances of headroom", () => {
    // Sanity floor only — the two dials need not be even multiples ($25/day vs $1.50).
    expect(GLOBAL_DAILY_TRIAL_SPEND_CAP).toBeGreaterThanOrEqual(TRIAL_ALLOWANCE * 10);
  });
});
