import type { Scene } from "../../db/binderStore";
import type { SceneEntityGroup } from "../../db/storyBibleStore";
import type { AiCtxConfig, AiEstimateResult, ManagedModel, MeterStatus } from "./ai.types";
import { MODEL_RATES, TYPICAL_REQUEST } from "./ai.types";

/** Derive whether the active scene is withheld from AI (pre-migration scenes → false). */
export const readSceneExcluded = (s: Scene | null | undefined): boolean => s?.excludeFromAi ?? false;

/**
 * Pure helper: applies the scene-exclusion toggle polarity — inverts the current
 * state and calls onSet with the new value. Guards: only calls if sceneId is set.
 */
export function applySceneExclusionToggle(
  onSet: ((id: string, exclude: boolean) => void) | undefined,
  sceneId: string | null,
  current: boolean,
): void {
  if (sceneId) onSet?.(sceneId, !current);
}

/**
 * Pure helper: toggle an entity NAME in/out of aiCtx.offEntityNames (the strip's
 * per-conversation hide set). Returns a NEW AiCtxConfig — does not mutate the input.
 * Operates on the raw aiCtx the picker writes; never the neverNames-merged variant.
 */
export function applyEntityToggle(aiCtx: AiCtxConfig, name: string): AiCtxConfig {
  const next = new Set(aiCtx.offEntityNames);
  if (next.has(name)) next.delete(name); else next.add(name);
  return { ...aiCtx, offEntityNames: [...next] };
}

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
 * Returns "Resets {Mon D}" (e.g. "Resets Jul 1"), or "" when the date is absent/invalid.
 * Callers must guard on the empty string before rendering (do NOT fall back to "soon" —
 * an absent reset date may mean the subscription is cancelled-in-grace and won't renew).
 */
export function formatResetLabel(resetAt: string): string {
  if (!resetAt) return "";
  try {
    const d = new Date(resetAt);
    if (isNaN(d.getTime())) return "";
    return "Resets " + new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
  } catch {
    return "";
  }
}

let __aiMsgN = 100;
export function aiMsgId(): string { return "m-" + (__aiMsgN++); }
export function aiConvoId(): string { return "cv-" + Date.now().toString(36); }

/**
 * Determines whether the balance fetch should be retried after receiving a zero
 * balance. Returns true only when ALL of:
 *   - the user IS a managed subscriber (isSubscriber)
 *   - the fetched balance is exactly zero (server hasn't credited yet)
 *   - we haven't exhausted the retry budget (attempt < maxAttempts)
 *
 * NOTE: a subscriber who has genuinely used all their credits also reads
 * creditsBalance === 0, so this will schedule ≤ maxAttempts harmless
 * background refetches before settling on the exhausted state. The cost
 * is negligible — do not add complex logic to distinguish the two cases.
 */
export function shouldRetryBalance(
  isSubscriber: boolean,
  creditsBalance: number,
  attempt: number,
  maxAttempts: number,
): boolean {
  return isSubscriber && creditsBalance === 0 && attempt < maxAttempts;
}

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

/** Strip's entity-chip list: all non-persistent-never entities (deduped by name), marked off when in offEntityNames. */
export function buildEntityChips(groups: SceneEntityGroup[], offEntityNames: string[]): { name: string; off: boolean }[] {
  const off = new Set(offEntityNames);
  const seen = new Set<string>();
  const chips: { name: string; off: boolean }[] = [];
  for (const g of groups) {
    for (const e of g.entities) {
      if (e.exclude_from_ai === true || seen.has(e.name)) continue;
      seen.add(e.name);
      chips.push({ name: e.name, off: off.has(e.name) });
    }
  }
  return chips;
}
