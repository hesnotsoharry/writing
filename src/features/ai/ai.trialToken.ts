/**
 * ai.trialToken.ts — trial + any-token caching helpers (Wave 39).
 *
 * Extracted from AssistantPanel.hooks.ts to keep that file under the 300-line
 * code-line budget. These helpers are the only place that touches aiTrialKey.
 */
import type { MutableRefObject } from "react";

import { getTweak, setStoredTweak } from "../settings/settings.store";
import { acquireSession, acquireTrialSession, type SessionResult } from "./ai.client";

/** True when the cached token is still valid with a 60 s safety margin. */
function isFresh(ref: MutableRefObject<SessionResult | null>): boolean {
  return ref.current !== null && Date.now() < ref.current.expiresAt - 60_000;
}

/**
 * Acquire a trial session token, reusing a cached one when still fresh.
 * Re-exchanges the stored `aiTrialKey` on re-launch; falls back to a first-grant
 * (empty-body POST) when the stored key is absent or stale (throws on re-exchange).
 */
export async function acquireTrialTokenCached(ref: MutableRefObject<SessionResult | null>): Promise<string> {
  if (isFresh(ref)) return ref.current!.token;
  const stored = getTweak("aiTrialKey", "");
  if (stored) {
    try { const r = await acquireTrialSession(stored); ref.current = { token: r.token, expiresAt: r.expiresAt }; return r.token; } catch { /* stale — fall through to first-grant */ }
  }
  const r = await acquireTrialSession();
  if (r.trialKey) setStoredTweak("aiTrialKey", r.trialKey);
  ref.current = { token: r.token, expiresAt: r.expiresAt };
  return r.token;
}

/**
 * Acquire any session token: license-key path for subscribers, trial path for
 * trial users (empty aiLicenseKey). Reads the key from localStorage via getTweak.
 */
export async function acquireAnyToken(ref: MutableRefObject<SessionResult | null>): Promise<string> {
  const lk = getTweak("aiLicenseKey", "");
  if (!lk) return acquireTrialTokenCached(ref);
  if (isFresh(ref)) return ref.current!.token;
  const fresh = await acquireSession(lk);
  ref.current = fresh;
  return fresh.token;
}
