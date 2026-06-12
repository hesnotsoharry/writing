/**
 * trial — pure 14-day trial status logic (wave-33).
 *
 * Decision D3 (wave-33): clock-rollback clamp — trial math uses
 * effectiveNow = max(now, lastSeenAt), so setting the system clock
 * backwards never extends the trial.
 *
 * Stub: signatures declared by the orchestrator; Phase 1 implements
 * against the oracle acceptance test.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrialRecord {
  /** ISO timestamp of first unlicensed launch. */
  trialStartedAt: string;
  /** ISO timestamp, monotonically non-decreasing across boots. */
  lastSeenAt: string;
}

export type TrialState = "active" | "expired";

export interface TrialStatus {
  state: TrialState;
  /** Whole days remaining: ceil(remaining ms / 86_400_000); expired when <= 0. */
  daysLeft: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TRIAL_DURATION_DAYS = 14;

// ─── Status computation ───────────────────────────────────────────────────────

/**
 * Compute trial status from a stored record and the current wall-clock time.
 * Clamps effective time to max(now, record.lastSeenAt) per Decision D3.
 */
export function computeTrialStatus(
  record: TrialRecord,
  now: Date,
): TrialStatus {
  void record;
  void now;
  throw new Error("not implemented");
}
