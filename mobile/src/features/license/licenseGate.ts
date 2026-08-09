import { useCallback, useEffect, useState } from "react";

import { getLicenseStore, getTrialStore } from "../../db/stores";
import { computeTrialStatus, TRIAL_DURATION_DAYS } from "../../shared/trial";

export type MobileGateStatus = "checking" | "needed" | "trial" | "cleared";
export interface MobileGateResult {
  gateStatus: MobileGateStatus; daysLeft: number | null; trialExpired: boolean;
  onActivated(): void;
}

export async function resolveMobileGate(now: Date): Promise<Omit<MobileGateResult, "onActivated">> {
  const license = await (await getLicenseStore()).read();
  if (license) return { gateStatus: "cleared", daysLeft: null, trialExpired: false };
  const store = await getTrialStore(); const trial = await store.read(); const nowIso = now.toISOString();
  if (!trial) {
    await store.write({ trialStartedAt: nowIso, lastSeenAt: nowIso });
    return { gateStatus: "trial", daysLeft: TRIAL_DURATION_DAYS, trialExpired: false };
  }
  const status = computeTrialStatus(trial, now);
  const lastSeenAt = new Date(Math.max(now.getTime(), Date.parse(trial.lastSeenAt))).toISOString();
  await store.write({ trialStartedAt: trial.trialStartedAt, lastSeenAt });
  return status.state === "expired"
    ? { gateStatus: "needed", daysLeft: null, trialExpired: true }
    : { gateStatus: "trial", daysLeft: status.daysLeft, trialExpired: false };
}

export function useMobileLicenseGate(dbReady: boolean): MobileGateResult {
  const [state, setState] = useState<Omit<MobileGateResult, "onActivated">>({
    gateStatus: "checking", daysLeft: null, trialExpired: false,
  });
  useEffect(() => {
    if (!dbReady) return;
    void resolveMobileGate(new Date()).then(setState).catch(() => setState({
      gateStatus: "needed", daysLeft: null, trialExpired: false,
    }));
  }, [dbReady]);
  const onActivated = useCallback(() => setState({ gateStatus: "cleared", daysLeft: null, trialExpired: false }), []);
  return { ...state, onActivated };
}
