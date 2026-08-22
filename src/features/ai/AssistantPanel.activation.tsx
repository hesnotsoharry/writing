/**
 * AssistantPanel.activation.tsx — Turnstile trial-activation card (Phase 2).
 *
 * Server phase 1 (already live) accepts an optional turnstileToken on the AI
 * trial-session first grant and verifies it when present; the desktop app can't
 * host the Turnstile widget directly (WebView2/WKWebView origins confuse
 * Cloudflare's heuristics — see research/turnstile-trial-session-scout.md §2),
 * so the widget runs on a small hosted page and hands the token back over
 * postMessage. Not part of the editor core — this is Assistant-panel chrome.
 */
import { useEffect, useState } from "react";

import { Icon } from "../../components/Icon";
import { setStoredTweak } from "../settings/settings.store";
import { acquireTrialSession } from "./ai.client";

// The token is single-use, short-lived, and only redeemable against our own server
// secret — accepting it from any postMessage sender would cost nothing even if spoofed.
// We still gate on origin here (belt-and-suspenders): only writersnook.app may set state.
const CHALLENGE_ORIGIN = "https://writersnook.app";
const CHALLENGE_URL = "https://writersnook.app/turnstile-challenge.html";
const CHALLENGE_TIMEOUT_MS = 8_000;

type ChallengeStatus = "pending" | "ready" | "unavailable";
interface ChallengeState { status: ChallengeStatus; token: string | null }

function isChallengeMessage(data: unknown): data is { type: string; token?: unknown } {
  return typeof data === "object" && data !== null && "type" in data;
}

/**
 * Listens for the challenge iframe's postMessage handshake. Times out to
 * "unavailable" after ~8s so offline desktops (or a blocked widget) can still
 * activate while the server stays permissive (TURNSTILE_ENFORCED unset).
 */
export function useTurnstileChallenge(): ChallengeState & { onIframeError: () => void } {
  const [state, setState] = useState<ChallengeState>({ status: "pending", token: null });

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== CHALLENGE_ORIGIN || !isChallengeMessage(e.data)) return;
      if (e.data.type === "wn-turnstile-token" && typeof e.data.token === "string") {
        setState({ status: "ready", token: e.data.token });
      } else if (e.data.type === "wn-turnstile-unavailable") {
        setState((s) => (s.status === "ready" ? s : { status: "unavailable", token: null }));
      }
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => {
      setState((s) => (s.status === "pending" ? { status: "unavailable", token: null } : s));
    }, CHALLENGE_TIMEOUT_MS);
    return () => { window.removeEventListener("message", onMessage); clearTimeout(timer); };
  }, []);

  const onIframeError = () => setState((s) => (s.status === "ready" ? s : { status: "unavailable", token: null }));
  return { ...state, onIframeError };
}

type ActivatePhase = "idle" | "loading" | "error";

/** Runs the explicit first grant and persists the trial key. Exported for the unit seam. */
export async function runActivation(
  token: string | null,
  setStoredTweak: (key: "aiTrialKey", value: string) => void,
): Promise<void> {
  const r = await acquireTrialSession(undefined, token ?? undefined);
  if (r.trialKey) setStoredTweak("aiTrialKey", r.trialKey);
}

interface TrialActivationCardProps {
  onActivated: () => void;
  /** Injected for tests — production callers rely on the default (settings.store). */
  persistTrialKey?: (key: "aiTrialKey", value: string) => void;
}

/**
 * Replaces the composer + balance chatter when no trial token is available yet.
 * Renders the hosted challenge page in a small iframe and an explicit "Activate"
 * button, enabled once a token arrives or the widget reports itself unavailable.
 */
export function TrialActivationCard({ onActivated, persistTrialKey }: TrialActivationCardProps) {
  const challenge = useTurnstileChallenge();
  const [phase, setPhase] = useState<ActivatePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const canActivate = challenge.status !== "pending" && phase !== "loading";

  async function handleActivate(): Promise<void> {
    setPhase("loading"); setError(null);
    try {
      const token = challenge.status === "ready" ? challenge.token : null;
      await runActivation(token, persistTrialKey ?? setStoredTweak);
      setPhase("idle");
      onActivated();
    } catch (err: unknown) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Couldn't activate the free trial — try again.");
    }
  }

  return (
    <div className="ai-guard ai-activation">
      <div className="gtitle"><Icon name="sparkle" className="ic" /> Try the AI assistant free</div>
      <p>$1.50 of usage on us. No account needed.</p>
      <iframe className="ai-activation-frame" src={CHALLENGE_URL} title="Verification" onError={challenge.onIframeError} />
      <div className="gacts">
        <button className="btn btn-primary" disabled={!canActivate} onClick={() => { void handleActivate(); }}>
          {phase === "loading" ? "Activating…" : "Activate free trial"}
        </button>
      </div>
      {error && <span className="ai-key-error">{error}</span>}
    </div>
  );
}
