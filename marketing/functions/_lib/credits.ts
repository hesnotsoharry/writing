/**
 * Shared credit constants and helpers for the AI proxy.
 *
 * Credit unit: 1 unit = $0.00001 USD  (CREDIT_UNIT_USD in ai-token.ts — canonical definition).
 *
 * Rate model (Wave 37 — model-aware, replaces hardcoded Haiku scalars):
 *   RATES[model] = { input, output, cacheWrite5m, cacheWrite1h, cacheRead }
 *   units/token = $/MTok × 0.1  (since CREDIT_UNIT_USD = $0.00001 and 1 MTok = 1e6 tokens)
 *
 * Both estimateCredits and actualCredits take a `model` arg so reserve and reconcile
 * always use the same rate table and cannot diverge (Decision 1 D3, Wave 37).
 */
import { CREDIT_UNIT_USD } from "./ai-token";

/** Monthly credit allowance per active subscription (D3). 1,000,000 units ≈ $10.00 API value. */
export const MONTHLY_ALLOWANCE = 1_000_000;

/**
 * Top-up pack grant in credit units.
 * One pack ≈ $6 API value (600,000 units at 1 unit = $0.00001).
 */
export const TOPUP_PACK_AMOUNT = 600_000;

/**
 * Per-license rate cap — maximum chat requests per rolling window (D3).
 * Guards against burst abuse beyond what credit depletion alone would catch.
 */
export const RATE_CAP_PER_MINUTE = 20;
export const RATE_WINDOW_SECONDS = 60;

/** Per-model credit rates (units/token) */
export interface ModelRates {
  /** Input tokens (normal) */
  input: number;
  /** Output tokens */
  output: number;
  /** Cache write — 5-minute TTL */
  cacheWrite5m: number;
  /** Cache write — 1-hour TTL */
  cacheWrite1h: number;
  /** Cache read */
  cacheRead: number;
}

/**
 * Credit rate table keyed by Anthropic model ID.
 * Units/token = $/MTok × 0.1
 *   (formula: price_per_MTok / 1e6 / CREDIT_UNIT_USD = price_per_MTok × 0.1)
 * Unknown models fall back to Haiku rates (safe, conservative).
 */
export const RATES: Record<string, ModelRates> = {
  'claude-haiku-4-5-20251001': { input: 0.1,  output: 0.5,  cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01 },
  'claude-sonnet-4-6':         { input: 0.3,  output: 1.5,  cacheWrite5m: 0.375, cacheWrite1h: 0.6, cacheRead: 0.03 },
  'claude-opus-4-8':           { input: 0.5,  output: 2.5,  cacheWrite5m: 0.625, cacheWrite1h: 1.0, cacheRead: 0.05 },
};

/**
 * @deprecated Use RATES['claude-haiku-4-5-20251001'].input instead.
 * Kept as a re-export so existing consumers compile without import-site changes.
 */
export const INPUT_UNITS_PER_TOKEN = 1e-6 / CREDIT_UNIT_USD;   // $1/MTok → 0.1 units/token

/**
 * @deprecated Use RATES['claude-haiku-4-5-20251001'].output instead.
 * Kept as a re-export so existing consumers compile without import-site changes.
 */
export const OUTPUT_UNITS_PER_TOKEN = 5e-6 / CREDIT_UNIT_USD;  // $5/MTok → 0.5 units/token

/**
 * Estimate the maximum credits a request may consume (reserve before sending).
 * Reserve = input ceiling (chars÷4 heuristic) + per-verb max_tokens × output rate.
 * Refund-only reconciliation (D3): the full max_tokens output reservation almost always
 * exceeds real usage, so reserve ≥ actual in normal operation. EXCEPTION: on a first-turn
 * cache-WRITE (system ≥ the model's cacheable minimum), actualCredits applies the 1.25×
 * cache-write premium to the cached system tokens that this estimate bills at the base
 * input rate, so actual MAY slightly exceed reserve on that turn. Reconcile charges
 * min(reserve, actual) — the USER is never over-charged or driven negative; the service
 * absorbs the small premium. Follow-up: reserve the cache-write rate when caching fires.
 *
 * @param charCount - total character count of all messages + system prompt
 * @param maxTokens - per-verb max output tokens (from VERB_CONFIG or FALLBACK_VERB_CONFIG)
 * @param model - Anthropic model ID; unknown models fall back to Haiku rates
 */
export function estimateCredits(charCount: number, maxTokens: number, model: string): number {
  const rates = RATES[model] ?? RATES['claude-haiku-4-5-20251001'];
  const inputEst = Math.ceil((charCount / 4) * rates.input);
  const outputReserve = Math.ceil(maxTokens * rates.output);
  return inputEst + outputReserve;
}

/**
 * Calculate actual credits consumed from Anthropic's reported token counts.
 * Used for refund-only reconciliation: subtract from the reserve,
 * return the difference to the balance. Never negative.
 *
 * @param inputTokens - from usage.input_tokens
 * @param outputTokens - from usage.output_tokens
 * @param model - Anthropic model ID; unknown models fall back to Haiku rates
 * @param cacheCreationTokens - from usage.cache_creation_input_tokens (Phase 6 caching)
 * @param cacheReadTokens - from usage.cache_read_input_tokens (Phase 6 caching)
 * @param cacheWriteTtl - TTL used for cache-write pricing ('5m' default | '1h')
 */
export function actualCredits(
  inputTokens: number,
  outputTokens: number,
  model: string,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
  cacheWriteTtl: '5m' | '1h' = '5m',
): number {
  const rates = RATES[model] ?? RATES['claude-haiku-4-5-20251001'];
  const cacheWriteRate = cacheWriteTtl === '1h' ? rates.cacheWrite1h : rates.cacheWrite5m;
  return Math.ceil(
    inputTokens * rates.input +
    outputTokens * rates.output +
    cacheCreationTokens * cacheWriteRate +
    cacheReadTokens * rates.cacheRead,
  );
}
