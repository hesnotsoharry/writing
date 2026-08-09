import { describe, expect, it } from "vitest";

import { computeTrialStatus, TRIAL_DURATION_DAYS } from "../../shared/trial";
import { mergeTrialRecords } from "./trialModel";

const day = 86_400_000;
const start = Date.parse("2026-08-01T00:00:00.000Z");
const record = { trialStartedAt: new Date(start).toISOString(), lastSeenAt: new Date(start).toISOString() };

describe("mobile trial boundary", () => {
  it("computes days left and expires exactly at the boundary", () => {
    expect(computeTrialStatus(record, new Date(start + day)).daysLeft).toBe(TRIAL_DURATION_DAYS - 1);
    expect(computeTrialStatus(record, new Date(start + TRIAL_DURATION_DAYS * day))).toEqual({ state: "expired", daysLeft: 0 });
  });

  it("clamps clock rollback to lastSeenAt", () => {
    const seen = { ...record, lastSeenAt: new Date(start + 10 * day).toISOString() };
    expect(computeTrialStatus(seen, new Date(start + 2 * day)).daysLeft).toBe(4);
  });

  it("merges entitlement timestamps monotonically", () => {
    expect(mergeTrialRecords(
      { trialStartedAt: "2026-08-03T00:00:00.000Z", lastSeenAt: "2026-08-05T00:00:00.000Z" },
      { trialStartedAt: "2026-08-01T00:00:00.000Z", lastSeenAt: "2026-08-07T00:00:00.000Z" },
    )).toEqual({ trialStartedAt: "2026-08-01T00:00:00.000Z", lastSeenAt: "2026-08-07T00:00:00.000Z" });
  });
});
