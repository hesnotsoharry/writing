/**
 * Cross-provider effort policy — the single source of truth for how hard a model
 * works on a response, and for the output budget that decision requires.
 *
 * WHY THIS IS CENTRAL, not per-adapter: the effort decision has two consumers that must
 * never disagree. The adapters send it on the wire, and chat.ts sizes the credit reserve
 * from the same fact. Two tables would eventually drift, and the drift would surface as
 * an under-reserve (operator absorbs the shortfall) rather than as a loud failure.
 *
 * Neither provider defaults to a neutral middle, and the two defaults sit at OPPOSITE
 * extremes — which is why every current-generation model is now set explicitly:
 *   - Anthropic omits `output_config.effort` → `high`. Expensive; effort tokens bill as output.
 *   - OpenAI, as we call it, sets `reasoning_effort: 'none'` → no reasoning at all.
 * Before this table, Claude models ran at maximum effort and GPT models ran at zero, so
 * the picker was never comparing like with like.
 *
 * Roster decision 2026-07-30 (Cole): current-generation models on both providers run at
 * `medium`. Legacy models are deliberately absent — they keep the behaviour they have
 * always shipped with, because changing a model a user has already selected is a live
 * behaviour change, not a roster refresh.
 */
import { RATES } from "./credits";

export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Per-model effort. A model absent from this map inherits its provider default.
 *
 * Claude Haiku 4.5 is intentionally absent and must stay that way: it does not accept
 * the effort parameter, and it is both the default model and the un-bypassable model
 * for the proofread verb, so a 400 there would hit nearly every user.
 */
export const MODEL_EFFORT: Record<string, EffortLevel> = {
  // Anthropic — medium steps DOWN from the implicit high these models would otherwise use.
  "claude-sonnet-5": "medium",
  "claude-opus-5": "medium",
  // OpenAI — medium steps UP from reasoning_effort 'none'. See REASONING_HEADROOM_TOKENS:
  // this direction costs output budget rather than saving it.
  "gpt-5.4-mini": "medium",
  "gpt-5.6-luna": "medium",
  "gpt-5.6-terra": "medium",
  "gpt-5.6-sol": "medium",
};

/** The effort level for a model, or undefined to leave the provider default in place. */
export function getModelEffort(model: string): EffortLevel | undefined {
  return MODEL_EFFORT[model];
}

/**
 * Extra output tokens granted to OpenAI models that carry a reasoning effort.
 *
 * On OpenAI, reasoning tokens are drawn from max_completion_tokens — the same budget the
 * visible reply comes out of. A verb capped at 2048 that suddenly reasons can spend most
 * of that budget thinking and return a truncated or entirely empty message with
 * finish_reason 'length'. The headroom keeps the prose budget roughly whole.
 *
 * Anthropic models get NO headroom on purpose. Their thinking also draws from max_tokens,
 * but `medium` REDUCES thinking against the implicit `high` they already ran at in
 * production at these same caps — headroom there would inflate the credit reserve to
 * solve a problem that does not exist.
 */
export const REASONING_HEADROOM_TOKENS = 2048;

/**
 * Output budget for a request, including reasoning headroom where the model needs it.
 *
 * Call this ONCE per request, at config-resolution time, so the wire request and the
 * credit reserve are computed from the identical number.
 */
export function resolveMaxTokens(model: string, verbMaxTokens: number): number {
  if (getModelEffort(model) === undefined) return verbMaxTokens;
  if (RATES[model]?.provider !== "openai") return verbMaxTokens;
  return verbMaxTokens + REASONING_HEADROOM_TOKENS;
}
