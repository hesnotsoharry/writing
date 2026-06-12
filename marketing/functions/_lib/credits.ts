/**
 * Shared credit constants and helpers for the AI proxy.
 *
 * Credit unit: 1 unit = $0.00001 USD.
 * Canonical definition: migration 0002_ai_subscriptions.sql; CREDIT_UNIT_USD in ai-token.ts.
 *
 * Rate model (Haiku 4.5):
 *   Input:  $1/MTok  → 0.1 units/token
 *   Output: $5/MTok  → 0.5 units/token
 */

/** Monthly credit allowance per active subscription (D3). 1,000,000 units ≈ $10.00 API value. */
export const MONTHLY_ALLOWANCE = 1_000_000;

/**
 * Top-up pack grant in credit units.
 * One pack ≈ $6 API value (600,000 units at 1 unit = $0.00001).
 */
export const TOPUP_PACK_AMOUNT = 600_000;

/**
 * Per-license rate cap — maximum chat requests per rolling window (D3).
 * Guards against burst abuse beyond what credit depletion alone would catch:
 * a burst of max_tokens=4096 requests drains credits faster than the meter
 * can signal zero. 20 req/min leaves headroom for rapid back-and-forth chat.
 */
export const RATE_CAP_PER_MINUTE = 20;
export const RATE_WINDOW_SECONDS = 60;

// Token → unit rates (mirrors 0002 comment)
export const INPUT_UNITS_PER_TOKEN = 0.1;
export const OUTPUT_UNITS_PER_TOKEN = 0.5;

/**
 * Estimate the maximum credits a request may consume (reserve before sending).
 * Reserve = input ceiling (chars÷4 heuristic) + per-verb max_tokens × output rate.
 * Always ≥ actualCredits for the same inputs — the reserve is refund-only (D3).
 */
export function estimateCredits(charCount: number, maxTokens: number): number {
  const inputEst = Math.ceil((charCount / 4) * INPUT_UNITS_PER_TOKEN);
  const outputReserve = Math.ceil(maxTokens * OUTPUT_UNITS_PER_TOKEN);
  return inputEst + outputReserve;
}

/**
 * Calculate actual credits consumed from Anthropic's reported token counts.
 * Used for refund-only reconciliation: subtract from the reserve,
 * return the difference to the balance. Never negative.
 */
export function actualCredits(inputTokens: number, outputTokens: number): number {
  return Math.ceil(
    inputTokens * INPUT_UNITS_PER_TOKEN + outputTokens * OUTPUT_UNITS_PER_TOKEN,
  );
}
