import type { TrialRecord } from "../../shared/trial";

export function mergeTrialRecords(left: TrialRecord, right: TrialRecord): TrialRecord {
  const started = Math.min(Date.parse(left.trialStartedAt), Date.parse(right.trialStartedAt));
  const seen = Math.max(Date.parse(left.lastSeenAt), Date.parse(right.lastSeenAt));
  return { trialStartedAt: new Date(started).toISOString(), lastSeenAt: new Date(seen).toISOString() };
}
