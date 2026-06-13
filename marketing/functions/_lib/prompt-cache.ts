/**
 * Prompt-cache gating logic for the AI proxy.
 *
 * MIN_CACHEABLE_TOKENS maps model IDs to the minimum prefix-token count
 * required for Anthropic to cache the prompt. Attaching cache_control below
 * the threshold is silently ignored by Anthropic (no error), but wastes the
 * content-block form of the system field — the gate prevents that.
 *
 * shouldAttachCache returns true when the estimated prefix tokens meet or
 * exceed the model's threshold. Unknown models default to 4096 (Haiku's floor)
 * — the most conservative value — so caching only attaches when it can pay off.
 *
 * Reference: roadmap/wave-37-ai-harness-optimization-research.md §2
 *   Haiku 4.5 min: 4096 | Sonnet 4.6 min: 1024 | Opus 4.8 min: 1024
 */

/** Minimum cacheable prefix tokens per Anthropic model (as of June 2026). */
export const MIN_CACHEABLE_TOKENS: Record<string, number> = {
  'claude-haiku-4-5-20251001': 4096,
  'claude-sonnet-4-6': 1024,
  'claude-opus-4-8': 1024,
};

/**
 * Returns true when the estimated prefix is large enough for Anthropic to
 * honour the cache_control breakpoint for the given model.
 *
 * @param estimatedPrefixTokens - Estimated token count of the stable prefix
 *   (system prompt + grounding context). Use Math.ceil(charCount / 4).
 * @param model - Anthropic model ID; unknown models default to 4096 (Haiku floor).
 */
export function shouldAttachCache(estimatedPrefixTokens: number, model: string): boolean {
  return estimatedPrefixTokens >= (MIN_CACHEABLE_TOKENS[model] ?? 4096);
}
