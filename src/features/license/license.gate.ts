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
import { loadTrialDetailed, saveTrial } from "./trial.store";

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

const ACTIVATION_READ_ATTEMPTS = 3;

/** 'error' means the record may exist but could not be read (transient SQLite
 *  failure). Callers must NOT route 'error' into the trial path: an activated
 *  customer permanently carries a stale expired-trial row (activation never
 *  clears it), so a read hiccup at boot would hard-lock a paying user out of
 *  their own manuscript (audit P10.1). */
async function loadActivationWithRetry(): Promise<"licensed" | "none" | "error"> {
  for (let attempt = 0; attempt < ACTIVATION_READ_ATTEMPTS; attempt += 1) {
    try {
      return (await loadActivation()) !== null ? "licensed" : "none";
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  return "error";
}

/**
 * Determine the full gate state from current DB contents and wall-clock time.
 * A persistently unreadable activation record fails OPEN for the session:
 * blocking the editor over an I/O hiccup is the worse failure for a
 * local-first writing app, and an unlicensed user with a broken DB gets a
 * broken app regardless.
 */
async function resolveGate(now: Date): Promise<GateResolution> {
  const activation = await loadActivationWithRetry();
  if (activation === "licensed" || activation === "error") {
    if (activation === "error") {
      console.error("[license] activation record unreadable after retries — failing open this session");
    }
    return { gateStatus: "cleared", daysLeft: null, trialExpired: false };
  }

  const trial = await loadTrialDetailed();
  const nowISO = now.toISOString();

  if (trial.kind === "corrupt") {
    // A legitimate install never writes a corrupt row — do not re-grant 14
    // days on a mangled one (audit P10.2). Show the buy/activate gate.
    return { gateStatus: "needed", daysLeft: null, trialExpired: true };
  }
  if (trial.kind === "missing") {
    await saveTrial({ trialStartedAt: nowISO, lastSeenAt: nowISO });
    return { gateStatus: "trial", daysLeft: TRIAL_DURATION_DAYS, trialExpired: false };
  }

  const { state, daysLeft } = computeTrialStatus(trial.record, now);
  // Persist lastSeenAt bump: monotonically non-decreasing (clock-rollback defence).
  const newLastSeenAt = new Date(
    Math.max(now.getTime(), Date.parse(trial.record.lastSeenAt)),
  ).toISOString();
  await saveTrial({ trialStartedAt: trial.record.trialStartedAt, lastSeenAt: newLastSeenAt });

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
