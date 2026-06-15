import type { AiEstimateResult, ManagedModel, MeterStatus } from "./ai.types";
import { MODEL_RATES, TYPICAL_REQUEST } from "./ai.types";

export interface EstimateParams {
  sceneWords: number;
  extraWords?: number;
  selWords?: number;
  entityCount: number;
  about: boolean;
  turns?: number;
}

export function aiEstimate(
  ctx: EstimateParams,
  model?: ManagedModel,
  monthlyAllowance?: number,
): AiEstimateResult {
  const words =
    (ctx.sceneWords || 0) +
    (ctx.extraWords || 0) +
    (ctx.selWords || 0) +
    ctx.entityCount * 45 +
    (ctx.about ? 130 : 0) +
    (ctx.turns || 0) * 350;

  let pct: number;
  if (model && monthlyAllowance && monthlyAllowance > 0) {
    const rate = MODEL_RATES[model];
    if (rate) {
      const ctxTokens = words * (4 / 3); // ~1.33 tokens/word
      const worstCostUnits = ctxTokens * rate.input + 800 * rate.output; // worst-case: no cache, 800 out
      pct = Math.max(0.1, Math.round((worstCostUnits / monthlyAllowance) * 1000) / 10);
    } else {
      pct = Math.max(0.2, Math.round((words / 4000) * 10) / 10);
    }
  } else {
    pct = Math.max(0.2, Math.round((words / 4000) * 10) / 10);
  }
  return { words, pct };
}

export function aiMeterStatus(usedPct: number, resetLabel: string): MeterStatus {
  if (usedPct >= 100) return { cls: "out", label: "Used up", sub: resetLabel };
  if (usedPct >= 80) return { cls: "warn", label: "Running low", sub: resetLabel };
  if (usedPct >= 55) return { cls: "", label: "About half left", sub: resetLabel };
  return { cls: "", label: "Plenty left this month", sub: resetLabel };
}

/**
 * Compute how much of the monthly allowance has been used (0–100, clamped).
 * Returns 0 if allowance is non-positive to avoid division-by-zero.
 */
export function computeUsedPct(allowance: number, balance: number): number {
  if (allowance <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((allowance - balance) / allowance) * 100)));
}

/**
 * Estimate how many more "typical" replies a credit-unit balance buys on a given model.
 * Pure + approximate (the UI always renders the result with a "~" prefix). Uses the
 * static TYPICAL_REQUEST profile and the client MODEL_RATES mirror. Floors the result
 * so we never promise a reply the balance can't cover. Returns 0 for non-finite
 * or non-positive balances, unknown models, or non-positive computed cost.
 */
export function estimateRepliesLeft(
  balanceUnits: number,
  model: ManagedModel,
  avgCostOverride?: number,
): number {
  const rate = MODEL_RATES[model];
  if (!rate) return 0;
  if (!Number.isFinite(balanceUnits) || balanceUnits <= 0) return 0;
  const costPerReply =
    avgCostOverride !== undefined && avgCostOverride > 0
      ? avgCostOverride
      : TYPICAL_REQUEST.inputTokens * rate.input + TYPICAL_REQUEST.outputTokens * rate.output;
  if (costPerReply <= 0) return 0;
  return Math.floor(balanceUnits / costPerReply);
}

/**
 * Parse a raw resetAt value from the proxy into a safe string.
 * Guards against null, undefined, empty string, and the literal "null" bug
 * (the String(null) anti-pattern from the pre-Phase-G 429 handler).
 */
export function parseResetAt(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "" || raw === "null") return "";
  return String(raw);
}

/**
 * Format a resetAt ISO string for display in the panel.
 * Returns "Resets {Mon D}" (e.g. "Resets Jul 1") or "soon" when the date is absent/invalid.
 */
export function formatResetLabel(resetAt: string): string {
  if (!resetAt) return "soon";
  try {
    const d = new Date(resetAt);
    if (isNaN(d.getTime())) return "soon";
    return "Resets " + new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
  } catch {
    return "soon";
  }
}

let __aiMsgN = 100;
export function aiMsgId(): string { return "m-" + (__aiMsgN++); }
export function aiConvoId(): string { return "cv-" + Date.now().toString(36); }

/**
 * Parse a raw prose selection string into a word-counted record.
 * Returns null when the selection is empty or below the 3-word minimum.
 */
export function parseProseSelection(raw: string): { text: string; words: number } | null {
  const text = raw.trim();
  if (!text) return null;
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (words < 3) return null;
  return { text, words };
}
