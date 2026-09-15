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
import { shouldAttachCache } from "./prompt-cache";

/** Monthly credit allowance per active subscription (D3). 1,000,000 units ≈ $10.00 API value. */
export const MONTHLY_ALLOWANCE = 1_000_000;

/**
 * Per-trial credit allowance. 150,000 units = $1.50 API value at CREDIT_UNIT_USD=$0.00001.
 * Inserted as both credits_balance and credits_monthly on the synthetic subscriptions row.
 */
export const TRIAL_ALLOWANCE = 150_000;

/**
 * Hard global ceiling on total trial AI spend per UTC day (Wave 39 Decision 2 — Cole-locked).
 * 2,500,000 units = $25.00/day. Enforced atomically by reserve_trial_credits in trial_budget.
 */
export const GLOBAL_DAILY_TRIAL_SPEND_CAP = 2_500_000;

/**
 * Maximum trial grants issued per source IP (HMAC-hashed) per UTC day.
 * Enforced atomically by grant_trial against trial_ip_grants.
 */
export const PER_IP_DAILY_GRANT_CAP = 3;

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
  /** AI provider ('anthropic', 'openai', or 'openrouter') — required for adapter routing (Decision 1) */
  provider: 'anthropic' | 'openai' | 'openrouter';
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
 * Credit rate table keyed by model ID (Anthropic + OpenAI + OpenRouter).
 * Units/token = $/MTok × 0.1
 *   (formula: price_per_MTok / 1e6 / CREDIT_UNIT_USD = price_per_MTok × 0.1)
 * Unknown models fall back to Haiku rates (safe, conservative).
 *
 * Legacy models (Sonnet 4.6, Opus 4.8, GPT-5.4, GPT-5.5) stay listed and priced:
 * they remain offered at the bottom of their picker group, and keeping them in the
 * allowlist means a persisted model preference can never 400 after a roster refresh.
 */
export const RATES: Record<string, ModelRates> = {
  // Anthropic rates — source: platform.claude.com/docs/en/about-claude/pricing, confirmed 2026-09-15.
  // Cache multipliers: 5m write = 1.25× input, 1h write = 2× input, read = 0.1× input.
  'claude-haiku-4-5-20251001': { provider: 'anthropic', input: 0.1,  output: 0.5,  cacheWrite5m: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01 },
  // Sonnet 5's $2/$10 launch pricing was made permanent (the scheduled 2026-09-01 increase
  // to $3/$15 was cancelled), so we now bill the real $2/$10 rate.
  'claude-sonnet-5':           { provider: 'anthropic', input: 0.2,  output: 1.0,  cacheWrite5m: 0.25,  cacheWrite1h: 0.4, cacheRead: 0.02 },
  'claude-opus-5':             { provider: 'anthropic', input: 0.5,  output: 2.5,  cacheWrite5m: 0.625, cacheWrite1h: 1.0, cacheRead: 0.05 },
  // Fable 5: $10/$50 per MTok, standard 0.1× cache-read multiplier (only Fable 5.1 has the 0.025× read).
  'claude-fable-5':            { provider: 'anthropic', input: 1.0,  output: 5.0,  cacheWrite5m: 1.25,  cacheWrite1h: 2.0, cacheRead: 0.1  },
  // Anthropic legacy generation — same list price as their Claude 5 successors.
  'claude-sonnet-4-6':         { provider: 'anthropic', input: 0.3,  output: 1.5,  cacheWrite5m: 0.375, cacheWrite1h: 0.6, cacheRead: 0.03 },
  'claude-opus-4-8':           { provider: 'anthropic', input: 0.5,  output: 2.5,  cacheWrite5m: 0.625, cacheWrite1h: 1.0, cacheRead: 0.05 },

  // OpenAI rates — source: developers.openai.com/api/docs/pricing, confirmed 2026-09-15. units/token = $/MTok × 0.1. No cache-write premium (cacheWrite* = input).
  // Luna ($0.20/$1.20) and Terra ($2/$12) were cut permanently on 2026-07-30. Sol lists a promo
  // $4/$20 through 2026-11-21; we bill its standard $5/$30 so nothing needs a dated flip.
  'gpt-5.4-mini':  { provider: 'openai', input: 0.075, output: 0.45, cacheWrite5m: 0.075, cacheWrite1h: 0.075, cacheRead: 0.0075 },
  'gpt-5.6-luna':  { provider: 'openai', input: 0.02,  output: 0.12, cacheWrite5m: 0.02,  cacheWrite1h: 0.02,  cacheRead: 0.002  },
  'gpt-5.6-terra': { provider: 'openai', input: 0.2,   output: 1.2,  cacheWrite5m: 0.2,   cacheWrite1h: 0.2,   cacheRead: 0.02   },
  'gpt-5.6-sol':   { provider: 'openai', input: 0.5,   output: 3.0,  cacheWrite5m: 0.5,   cacheWrite1h: 0.5,   cacheRead: 0.05   },
  // OpenAI legacy generation — GPT-5.4 is price-identical to 5.6 Terra, GPT-5.5 to 5.6 Sol.
  'gpt-5.4':       { provider: 'openai', input: 0.25,  output: 1.5,  cacheWrite5m: 0.25,  cacheWrite1h: 0.25,  cacheRead: 0.025  },
  'gpt-5.5':       { provider: 'openai', input: 0.5,   output: 3.0,  cacheWrite5m: 0.5,   cacheWrite1h: 0.5,   cacheRead: 0.05   },

  // OpenRouter rates — source: openrouter.ai/api/v1/models (authoritative; the model web page
  // quotes a different figure — trust the API), confirmed 2026-09-15: GLM-5.3 and GLM-5.2 both
  // $1.40 / $4.40 per MTok. GLM does not surface Anthropic-style cache tokens; cacheWrite* and
  // cacheRead = 0 (OpenRouterAdapter.pump always reports 0 for both).
  'z-ai/glm-5.3': { provider: 'openrouter', input: 0.14, output: 0.44, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 },
  // GLM-5.2 is no longer offered in the picker (the client maps a stored 5.2 preference back to
  // the default), but clients in the field up to v0.13.0 still list it, so it stays served.
  'z-ai/glm-5.2': { provider: 'openrouter', input: 0.14, output: 0.44, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 },
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
 * exceeds real usage, so reserve ≥ actual in normal operation. EXCEPTION (now fixed when
 * systemLength is supplied): when caching fires (system ≥ the model's cacheable minimum),
 * the reserve accounts for the 1h cache-WRITE premium on the system prefix. When
 * systemLength is omitted (3-arg callers), the old behaviour is preserved exactly.
 *
 * @param charCount - total character count of all messages + system prompt
 * @param maxTokens - per-verb max output tokens (from VERB_CONFIG or FALLBACK_VERB_CONFIG)
 * @param model - Anthropic model ID; unknown models fall back to Haiku rates
 * @param systemLength - optional byte-length of the system string; when supplied and
 *   caching will fire for the model, reserves the system prefix at the 1h cache-write
 *   rate (conservative: cold cache-write turn). Absent → base input rate (unchanged).
 */
export function estimateCredits(charCount: number, maxTokens: number, model: string, systemLength?: number): number {
  const rates = RATES[model] ?? RATES['claude-haiku-4-5-20251001'];
  let inputEst: number;
  if (systemLength !== undefined && systemLength > 0) {
    const systemTokens = Math.ceil(systemLength / 4);
    // Guard: only enter the cache-premium branch when the model actually has a non-zero
    // cache write rate. OpenRouter/GLM has cacheWrite1h = 0 — without this guard,
    // shouldAttachCache returns true for large systems (defaults to the 4096 Haiku floor)
    // and the estimate prices system tokens at 0 while actualCredits bills them at
    // rates.input, producing a systematic under-reserve (operator absorbs the shortfall).
    // OpenAI is unaffected: cacheWrite1h == input for OpenAI, so both branches produce
    // the same arithmetic value. Anthropic behavior is unchanged.
    if (shouldAttachCache(systemTokens, model) && rates.cacheWrite1h > 0) {
      const messageTokens = Math.ceil(Math.max(0, charCount - systemLength) / 4);
      inputEst = Math.ceil(systemTokens * rates.cacheWrite1h + messageTokens * rates.input);
    } else {
      inputEst = Math.ceil((charCount / 4) * rates.input);
    }
  } else {
    inputEst = Math.ceil((charCount / 4) * rates.input);
  }
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
