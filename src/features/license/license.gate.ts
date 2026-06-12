/**
 * license.gate — useLicenseGate hook for the boot-path activation check.
 *
 * Wave 30, Phase 3. Decision D4: activation record in SQLite app_meta; DEV
 * bypass via localStorage so tauri dev + CDP smoke of unrelated features
 * works without clearing the activation record every session.
 */
import { useCallback, useEffect, useState } from "react";

import { loadActivation } from "./license.store";
import { computeTrialStatus, TRIAL_DURATION_DAYS } from "./trial";
import { loadTrial, saveTrial } from "./trial.store";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Gate lifecycle:
 *   'checking' — DB may not be ready yet; activation not yet queried.
 *   'needed'   — no activation record AND no active trial; show ActivationGate.
 *   'trial'    — no activation record but 14-day trial active; show the app
 *                (wave-33; daysLeft carries the countdown for the StatusBar pill).
 *   'cleared'  — record present (or DEV bypass active); show the main app.
 */
export type GateStatus = "checking" | "needed" | "trial" | "cleared";

export interface LicenseGateResult {
  gateStatus: GateStatus;
  /** Whole days left in the trial; non-null only while gateStatus is 'trial'. */
  daysLeft: number | null;
  /** True when gateStatus is 'needed' because a trial ran out (copy variant). */
  trialExpired: boolean;
  onActivated: () => void;
}

// ─── Async gate resolver (module-level to keep hook under 40-line lint cap) ──

type GateResolution = Omit<LicenseGateResult, "onActivated">;

/**
 * Determine the full gate state from current DB contents and wall-clock time.
 * loadActivation errors fall through to the trial path (no crash on DB error).
 */
async function resolveGate(now: Date): Promise<GateResolution> {
  let hasLicense = false;
  try {
    const rec = await loadActivation();
    hasLicense = rec !== null;
  } catch { /* fall through to trial path on DB error */ }

  if (hasLicense) {
    return { gateStatus: "cleared", daysLeft: null, trialExpired: false };
  }

  const trial = await loadTrial();
  const nowISO = now.toISOString();

  if (trial === null) {
    await saveTrial({ trialStartedAt: nowISO, lastSeenAt: nowISO });
    return { gateStatus: "trial", daysLeft: TRIAL_DURATION_DAYS, trialExpired: false };
  }

  const { state, daysLeft } = computeTrialStatus(trial, now);
  // Persist lastSeenAt bump: monotonically non-decreasing (clock-rollback defence).
  const newLastSeenAt = new Date(
    Math.max(now.getTime(), Date.parse(trial.lastSeenAt)),
  ).toISOString();
  await saveTrial({ trialStartedAt: trial.trialStartedAt, lastSeenAt: newLastSeenAt });

  if (state === "expired") {
    return { gateStatus: "needed", daysLeft: null, trialExpired: true };
  }
  return { gateStatus: "trial", daysLeft, trialExpired: false };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Boot-path activation check.
 *
 * @param dbReady - true once the DB init (initializeProjectTree) has completed;
 *   false while still loading. The hook defers its SQLite read until this flag
 *   flips to true so it never races the migration runner.
 *
 * DEV bypass: when import.meta.env.DEV is true AND
 *   localStorage['writing.devLicenseBypass'] === '1', the gate is skipped
 *   without a network call or SQLite read. This is compile-time dead in
 *   production bundles (Vite tree-shakes the DEV branch).
 */
/** Returns true when the DEV gate bypass is active. Always false in production. */
function isDevBypassed(): boolean {
  return (
    import.meta.env.DEV &&
    localStorage.getItem("writing.devLicenseBypass") === "1"
  );
}

export function useLicenseGate(dbReady: boolean): LicenseGateResult {
  // Compute bypass at hook creation so the initial state is already 'cleared'
  // when the flag is set — avoids a synchronous setState inside an effect.
  const bypassed = isDevBypassed();
  const [gateStatus, setGateStatus] = useState<GateStatus>(
    bypassed ? "cleared" : "checking",
  );
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);

  useEffect(() => {
    if (!dbReady || bypassed) return;
    resolveGate(new Date())
      .then(({ gateStatus: gs, daysLeft: dl, trialExpired: te }) => {
        setGateStatus(gs);
        setDaysLeft(dl);
        setTrialExpired(te);
      })
      .catch(() => setGateStatus("needed"));
  }, [dbReady, bypassed]);

  const onActivated = useCallback(() => setGateStatus("cleared"), []);
  return { gateStatus, daysLeft, trialExpired, onActivated };
}
