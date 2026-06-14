/**
 * Provider adapter registry — getAdapter(model) is the single dispatch point
 * for the ProviderAdapter seam (W44 Decision 1).
 *
 * Routing is keyed off RATES[model].provider (NOT prefix-sniffing `claude-*`/`gpt-*`)
 * so that future model renames cannot silently break routing.
 *
 * Unknown/misspelled models fall back to AnthropicAdapter. They already resolve
 * to Haiku rates in the credit math, so the user is never over-charged — but an
 * unknown OpenAI model would under-bill. This is documented in the watch-list as
 * an under-charge risk; monitoring is the mitigation (Decision 1 adjudication).
 */
import { RATES } from "../credits";
import { AnthropicAdapter } from "./anthropic";
import { OpenAIAdapter } from "./openai";
import type { ProviderAdapter } from "./types";

export function getAdapter(model: string): ProviderAdapter {
  const provider = RATES[model]?.provider;
  if (provider === "openai") return new OpenAIAdapter();
  return new AnthropicAdapter();
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export { AnthropicAdapter } from "./anthropic";
export { OpenAIAdapter } from "./openai";
export type { CanonicalUsage, Message, ProviderAdapter, ResolvedConfig } from "./types";
