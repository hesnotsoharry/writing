/**
 * Provider adapter registry — getAdapter(model) is the single dispatch point
 * for the ProviderAdapter seam (W44 Decision 1).
 *
 * Routing is keyed off RATES[model].provider (NOT prefix-sniffing `claude-*`/`gpt-*`)
 * so that future model renames cannot silently break routing.
 *
 * W51 P1: unknown models now THROW instead of falling back to AnthropicAdapter.
 * The silent fallback was a mis-routing risk (an unknown OpenAI model would bill at
 * Haiku rates and route to Anthropic). Callers must validate the model before calling
 * getAdapter — chat.ts does so via resolveModelConfig + MANAGED_MODELS.
 */
import { RATES } from "../credits";
import { AnthropicAdapter } from "./anthropic";
import { OpenAIAdapter } from "./openai";
import type { ProviderAdapter } from "./types";

export function getAdapter(model: string): ProviderAdapter {
  const provider = RATES[model]?.provider;
  if (provider === "openai") return new OpenAIAdapter();
  if (provider === "anthropic") return new AnthropicAdapter();
  throw new Error(`Unknown model: ${model}`);
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export { AnthropicAdapter } from "./anthropic";
export { OpenAIAdapter } from "./openai";
export type { CanonicalUsage, Message, ProviderAdapter, ResolvedConfig } from "./types";
