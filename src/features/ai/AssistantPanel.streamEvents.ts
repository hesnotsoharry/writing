/**
 * AssistantPanel.streamEvents.ts — pure SSE event dispatcher for streamAiResponse.
 *
 * Extracted from AssistantPanel.hooks.ts (W52 P5) to keep that file under the
 * 300-line / complexity-10 limits. No React imports — purely data transformation.
 */
import { getTweak } from "../settings/settings.store";
import type { NormalizedEvent } from "./ai.client";
import { pushCostEntry } from "./ai.cost-window";
import type { ManagedModel } from "./ai.types";

// ── Shared state bag ──────────────────────────────────────────────────────────

export interface StreamState {
  accumulated: string;
  terminalError: string | null;
  doneCost: number | null;
  balanceAfterValue: number | null | undefined;
}

// ── Terminal-error resolver (extracted to keep applyStreamEvent ≤ complexity 10) ──

function resolveTerminalError(ev: NormalizedEvent): string | null {
  if (ev.type === "error") return `[Something went wrong — ${ev.message}]`;
  if (ev.type === "trial-budget-exhausted") return "[Trial AI is at today's shared limit — try again tomorrow]";
  if (ev.type === "session-expired") return "[Session expired — check your subscription in Settings]";
  if (ev.type === "content-blocked") {
    return "[The managed AI can't process this passage — it looks like mature content. To use AI here, connect your own API key (BYOK) or a local model in Settings; your managed plan stays safe. Tip: you can also mark explicit prose \"Hide from AI\" in the editor.]";
  }
  if (ev.type === "credits-exhausted") {
    const isTrial = !getTweak("aiLicenseKey", "");
    return isTrial
      ? "[Your free trial's used up — subscribe in the panel to keep going]"
      : "[Monthly allowance used up" + (ev.resetAt ? " — resets " + ev.resetAt : "") + "]";
  }
  return null;
}

// ── Public dispatcher ─────────────────────────────────────────────────────────

export interface ApplyEventOpts {
  isProofread: boolean;
  onToken: (text: string) => void;
  model: ManagedModel;
}

/**
 * Apply a single NormalizedEvent to the in-flight StreamState.
 * Called once per SSE frame inside streamAiResponse's streamChat callback.
 * Pure mutation — no React, no async.
 */
export function applyStreamEvent(
  ev: NormalizedEvent,
  state: StreamState,
  opts: ApplyEventOpts,
): void {
  if (ev.type === "token") {
    state.accumulated += ev.text;
    if (!opts.isProofread) opts.onToken(state.accumulated);
    return;
  }
  if (ev.type === "done") {
    state.doneCost = ev.creditsCost;
    state.balanceAfterValue = ev.balanceAfter;
    pushCostEntry(opts.model, ev.creditsCost);
    return;
  }
  const msg = resolveTerminalError(ev);
  if (msg !== null) state.terminalError = msg;
}
