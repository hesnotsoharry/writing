/**
 * AssistantPanel.balance.ts — fetchBalance helper extracted to keep AssistantPanel.tsx
 * within the 300-line file limit. Not part of the public module boundary.
 */
import type { MutableRefObject, RefObject } from "react";

import type { GateStatus } from "../license/license.gate";
import { getTweak } from "../settings/settings.store";
import { getBalance, type SessionResult } from "./ai.client";
import { computeUsedPct, formatResetLabel } from "./ai.helpers";
import { acquireAnyToken } from "./ai.trialToken";

export interface BalanceSetters {
  setUsedPct: (v: number) => void; setCreditsBalance: (v: number) => void;
  setMonthlyAllowance: (v: number) => void; setPlan: (v: "active" | "trial" | "expired") => void;
  setResetLabel: (v: string) => void; setOffline: (v: boolean) => void;
}

// Backoff schedule covering the ~87s webhook-settle window for new subscribers.
// Delays: 8 s, 20 s, 35 s, 60 s — cumulative ~123 s, max 4 retries.
// A subscriber who genuinely exhausted their credits also reads creditsBalance === 0
// and triggers ≤4 harmless extra fetches before settling — acceptable trade-off.
export const BALANCE_RETRY_DELAYS = [8_000, 20_000, 35_000, 60_000];

/** Inner fetch-and-apply; called by useAiBalance's effect + retry timer. */
export async function fetchBalance(
  opts: {
    sessionRef: RefObject<SessionResult | null>;
    setters: BalanceSetters;
    gateStatus: GateStatus;
    getCancelled: () => boolean;
    scheduleRetry: (balance: number, key: string) => void;
  },
): Promise<void> {
  const key = getTweak("aiLicenseKey", "");
  if (!key && opts.gateStatus !== "trial") return;
  try {
    const token = await acquireAnyToken(opts.sessionRef as MutableRefObject<SessionResult | null>);
    const data = await getBalance(token);
    if (opts.getCancelled()) return;
    opts.setters.setUsedPct(computeUsedPct(data.monthlyAllowance, data.creditsBalance));
    opts.setters.setCreditsBalance(data.creditsBalance);
    opts.setters.setMonthlyAllowance(data.monthlyAllowance);
    opts.setters.setPlan(data.status);
    opts.setters.setResetLabel(formatResetLabel(data.resetAt));
    opts.setters.setOffline(false);
    opts.scheduleRetry(data.creditsBalance, key);
  } catch (err: unknown) {
    if (opts.getCancelled()) return;
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("403")) { opts.setters.setPlan("expired"); opts.setters.setOffline(false); }
    else { opts.setters.setOffline(true); }
  }
}
