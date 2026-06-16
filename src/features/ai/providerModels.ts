/**
 * providerModels.ts — shared model registry for the W46 eval rig and W44 production adapter.
 *
 * Zero-dependency: safe for both Node (eval) and Tauri renderer (W44) import paths.
 * Model IDs sourced from wave-46-adapter-design.md Appendix (confirmed 2026-06-14/15).
 *
 * Tier-1 models are confirmed Tier-2 entries are stubs pending the live probe (P0-4).
 * OpenAI gpt-5.x model IDs are inferred from the design doc — verify at live probe.
 */

// ── Provider names ─────────────────────────────────────────────────────────────

export type ProviderName = "anthropic" | "openai" | "openrouter";

// ── Model entry ───────────────────────────────────────────────────────────────

export interface ModelEntry {
  modelId: string;
  provider: ProviderName;
  /** Set for openrouter; undefined for anthropic and openai. */
  baseUrl?: string;
  defaultMaxTokens: number;
  defaultTemperature: number;
  /** Whether the provider reliably honours the seed parameter for this model. */
  seedSupported: boolean;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Pilot model registry — wave-46 Tier-1 confirmed models + Panel Judge C.
 * Verify OpenAI model IDs at the P0-4 live probe before trusting them.
 */
export const PROVIDER_MODELS: ModelEntry[] = [
  // ── Tier 1 — Anthropic ─────────────────────────────────────────────────────
  {
    modelId: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: false,
  },
  {
    modelId: "claude-sonnet-4-6",
    provider: "anthropic",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: false,
  },
  {
    // Prior-gen Sonnet anchor for the W46 rig-v2 matrix. Still served by the
    // Anthropic API as of 2026-06-15 (live-verified at the rig-v2 probe).
    modelId: "claude-sonnet-4-5-20250929",
    provider: "anthropic",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: false,
  },
  {
    modelId: "claude-opus-4-8",
    provider: "anthropic",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: false,
  },

  // ── Tier 1 — OpenAI (IDs inferred; confirm at P0-4 live probe) ─────────────
  {
    modelId: "gpt-5.4-mini",
    provider: "openai",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: true,
  },
  {
    modelId: "gpt-5.4",
    provider: "openai",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: true,
  },
  {
    modelId: "gpt-5.5",
    provider: "openai",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: true,
  },
  {
    // Prior-gen GPT anchor for the W46 rig-v2 matrix (closest served analogue to
    // Sonnet 4.5). Live-verified served as of 2026-06-15 at the rig-v2 probe.
    modelId: "gpt-5.2",
    provider: "openai",
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: true,
  },

  // ── Panel Judge C — OpenRouter ─────────────────────────────────────────────
  // Mistral Large per P0-7 decision; confirm slug at live probe.
  {
    modelId: "mistralai/mistral-large-latest",
    provider: "openrouter",
    baseUrl: OPENROUTER_BASE_URL,
    defaultMaxTokens: 1024,
    defaultTemperature: 0.3,
    seedSupported: true,
  },

  // rig-v2 probe (2026-06-15) confirmed Sonnet 4.5 + GPT-5.2 are still served
  // (added above). Opus 4.5/4.1 and GPT-4o remain out of the eval matrix by choice.
];

// ── Accessors ─────────────────────────────────────────────────────────────────

/** Look up a model entry by its canonical modelId. Returns undefined if not found. */
export function getModel(modelId: string): ModelEntry | undefined {
  return PROVIDER_MODELS.find((m) => m.modelId === modelId);
}

/** All registered model IDs, in registry order. */
export function listModelIds(): string[] {
  return PROVIDER_MODELS.map((m) => m.modelId);
}
