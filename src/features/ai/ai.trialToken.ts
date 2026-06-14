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
 * Tracks the license key that was in effect when each ref was last populated.
 * Empty string means the ref was last populated via the trial path.
 * A ref absent from the map means it was never populated by acquireAnyToken.
 *
 * WeakMap: keyed on the ref object itself (stable across React renders), so there
 * is no cross-ref contamination and no memory leak when the component unmounts.
 */
const _refOwnerLk = new WeakMap<MutableRefObject<SessionResult | null>, string>();

/**
 * Acquire any session token: license-key path for subscribers, trial path for
 * trial users (empty aiLicenseKey). Reads the key from localStorage via getTweak.
 *
 * Owner-identity guard (Fix C): when the license key transitions from '' (trial) to
 * a real key (subscription activated mid-session), the cached trial token is discarded
 * and a fresh subscriber token is minted — even when the trial token is still fresh.
 */
export async function acquireAnyToken(ref: MutableRefObject<SessionResult | null>): Promise<string> {
  const lk = getTweak("aiLicenseKey", "");
  if (!lk) {
    // Reverse-transition guard (Finding 1 / Wave 39): if this ref was last populated by a
    // subscriber key, discard the cached token before the trial path runs — prevents a cleared
    // subscription from returning a still-fresh subscriber token on the trial/unsubscribed path.
    const prevLk = _refOwnerLk.get(ref) ?? null;
    if (prevLk !== null && prevLk !== "") ref.current = null;
    const token = await acquireTrialTokenCached(ref);
    _refOwnerLk.set(ref, "");
    return token;
  }
  // Subscriber path: cache hit only when the ref was also populated via this same lk.
  // A mismatch (e.g. '' → lk on subscription activation) forces a fresh subscriber mint.
  const prevLk = _refOwnerLk.get(ref) ?? null;
  if (isFresh(ref) && prevLk === lk) return ref.current!.token;
  ref.current = null; // discard any stale trial token before re-acquiring
  const fresh = await acquireSession(lk);
  ref.current = fresh;
  _refOwnerLk.set(ref, lk);
  return fresh.token;
}
