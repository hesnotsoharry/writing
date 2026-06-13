/**
 * Server-side verb configuration — resolves model / temperature / max_tokens per verb.
 *
 * Policy is owned here (not trusted from the client).
 * All verbs ship on claude-haiku-4-5-20251001 this wave.
 * The model-per-verb upgrade is a Cole-gated cost decision deferred to a future wave.
 *
 * Decision 1 (Wave 37): VerbConfig is a discriminated union; the `thinking` variant
 * sets `temperature?: never` for compile-time mutual exclusion (temp+thinking = 400 per
 * Anthropic API — research sidecar §8).
 */

export type VerbKey = 'brainstorm' | 'critique' | 'betaread' | 'proofread';

/**
 * Standard verb config: temperature-driven, extended-thinking excluded.
 * `thinking?: undefined` is present for discriminated-union completeness — accessing it
 * returns undefined at runtime; it is never set to any value.
 */
export interface StandardVerbConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  thinking?: undefined;
}

/**
 * Thinking verb config: extended thinking enabled, temperature MUST be absent.
 * The `temperature?: never` is a compile-time guard: sending temperature alongside
 * thinking → 400 from the Anthropic API (research sidecar §8).
 *
 * No thinking-enabled verb ships in Wave 37; this guards the future upgrade path.
 * `thinking` carries the Anthropic extended-thinking object (Decision 1 D4), passed to
 * the API verbatim. For the `enabled` variant, `budget_tokens` MUST be < maxTokens per
 * the Anthropic API. (A prior boolean shape would have sent `true` and 400'd a future
 * thinking verb.)
 */
export interface ThinkingVerbConfig {
  model: string;
  maxTokens: number;
  thinking:
    | { type: 'enabled'; budget_tokens: number }
    | { type: 'adaptive'; effort: 'low' | 'medium' | 'high' | 'max' };
  /** Intentionally excluded — compile-time mutual exclusion against temp+thinking = 400 */
  temperature?: never;
}

/** Discriminated union for per-verb server-side config */
export type VerbConfig = StandardVerbConfig | ThinkingVerbConfig;

/**
 * Safe fallback for un-updated clients that omit `verb`.
 * Neither temperature nor thinking is set (conservative — no inference by the proxy).
 */
export interface FallbackVerbConfig {
  model: string;
  maxTokens: number;
  temperature?: undefined;
  thinking?: undefined;
}

/**
 * Per-verb model / temperature / max_tokens policy (server-owned, not client-trusted).
 * Wave 37: all verbs on claude-haiku-4-5-20251001 — model-per-verb upgrade is a future wave.
 */
export const VERB_CONFIG: Record<VerbKey, VerbConfig> = {
  brainstorm: { model: 'claude-haiku-4-5-20251001', temperature: 1.0, maxTokens: 2048 },
  critique:   { model: 'claude-haiku-4-5-20251001', temperature: 1.0, maxTokens: 2048 },
  betaread:   { model: 'claude-haiku-4-5-20251001', temperature: 0.7, maxTokens: 2048 },
  proofread:  { model: 'claude-haiku-4-5-20251001', temperature: 0.1, maxTokens: 4096 },
};

/**
 * Fallback config used when a request omits `verb` (un-updated desktop client).
 * maxTokens 1536 = the pre-Wave-37 proofread max (what un-updated desktop clients
 * currently send); conservative so old-client proofread is not truncated during the
 * auto-update lag. INVARIANT: keep the cheapest model + this conservative cap; never
 * raise to a model upgrade.
 */
export const FALLBACK_VERB_CONFIG: FallbackVerbConfig = {
  model: 'claude-haiku-4-5-20251001',
  maxTokens: 1536,
};
