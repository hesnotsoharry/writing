/**
 * providerRegistry.ts — BYOK provider and model registry.
 *
 * Exports the shape W45 (local models) builds against:
 *   ProviderId | ModelEntry | ProviderGroup | PROVIDER_REGISTRY
 *
 * W45 appends a 'local' ProviderGroup to PROVIDER_REGISTRY — no structural change to this file needed.
 *
 * All Anthropic model IDs sourced from the codebase (ai.types.ts / byok.rs constant).
 * All OpenAI model IDs and rates verified from research sidecar §5 (2026-06-14).
 */

// ── Provider IDs ──────────────────────────────────────────────────────────────

/** Canonical provider identifiers. W45 appends 'local'. */
export type ProviderId = "anthropic" | "openai" | "local";

// ── Rust command-name constants ───────────────────────────────────────────────
// Defined here so the byok.*client files share one source of truth.
// A rename updates one place; the type system propagates the change everywhere.

export const BYOK_CMD_ANTHROPIC = "byok_chat" as const;
export const BYOK_CMD_OPENAI    = "byok_openai_chat" as const;
export const BYOK_CMD_LOCAL     = "byok_local_chat" as const; // W45

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-model USD rates used by byokUsage.ts to compute estimated cost. $/MTok. */
export interface ModelRateUsd {
  /** Normal (non-cached) input token rate in $/MTok. */
  input: number;
  /** Cache-read input token rate in $/MTok (cheaper than normal input). */
  cached: number;
  /** Output token rate in $/MTok. */
  output: number;
}

/** A single model entry in the BYOK picker. */
export interface ModelEntry {
  id: string;
  displayName: string;
  provider: ProviderId;
  /**
   * Human-readable cost hint shown in the picker (format: '$in / $out per MTok').
   * Verified from provider pricing pages (2026-06-14). Absent for Anthropic (managed
   * billing; BYOK users pay Anthropic directly at their negotiated rate).
   */
  costHint?: string;
  /**
   * Numeric USD rates per MTok. Sourced from marketing/functions/_lib/credits.ts RATES
   * (units/token × 10 = $/MTok, since 1 unit/token = $10/MTok at CREDIT_UNIT_USD=$0.00001).
   * Used by byokUsage.ts to compute per-turn and cumulative estimated cost.
   * Optional — absent for models where rates are unknown (cost accumulates token-only).
   */
  rateUsd?: ModelRateUsd;
}

/** A provider group rendered in the BYOK picker. */
export interface ProviderGroup {
  provider: ProviderId;
  /** Display header rendered above the group's model buttons. */
  label: string;
  models: ModelEntry[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * PROVIDER_REGISTRY — single source of truth for the BYOK model picker.
 *
 * Anthropic IDs: sourced from ai.types.ts + byok.rs MODEL constant (codebase canon).
 * OpenAI IDs + rates: verified from openai.com/pricing, research sidecar §5 (2026-06-14).
 * gpt-5.4 / gpt-5.4-mini / gpt-5.5 are canonical aliases (research sidecar §4); auto-resolve to latest snapshot.
 *
 * W45 appends a 'local' ProviderGroup here.
 */
export const PROVIDER_REGISTRY: ProviderGroup[] = [
  {
    provider: "anthropic",
    label: "Claude",
    models: [
      // Rates sourced from marketing/functions/_lib/credits.ts RATES (2026-06-14):
      //   units/token × 10 = $/MTok  (CREDIT_UNIT_USD = $0.00001; 1 unit/token = $10/MTok)
      {
        id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku", provider: "anthropic",
        rateUsd: { input: 1.0, cached: 0.10, output: 5.0 },
      },
      {
        id: "claude-sonnet-4-6", displayName: "Claude Sonnet", provider: "anthropic",
        rateUsd: { input: 3.0, cached: 0.30, output: 15.0 },
      },
    ],
  },
  {
    provider: "openai",
    label: "ChatGPT",
    models: [
      // Rates sourced from marketing/functions/_lib/credits.ts RATES (2026-06-14) and
      // confirmed against research sidecar §4 (openai.com/pricing, 2026-06-14).
      {
        id: "gpt-5.4", displayName: "GPT-5.4", provider: "openai",
        costHint: "$2.50 / $15 per MTok",
        rateUsd: { input: 2.50, cached: 0.25, output: 15.0 },
      },
      {
        id: "gpt-5.4-mini", displayName: "GPT-5.4 mini", provider: "openai",
        costHint: "$0.75 / $4.50 per MTok",
        // canonical alias; auto-resolves to latest snapshot (research sidecar §4)
        rateUsd: { input: 0.75, cached: 0.075, output: 4.50 },
      },
      {
        id: "gpt-5.5", displayName: "GPT-5.5", provider: "openai",
        costHint: "$5 / $30 per MTok",
        rateUsd: { input: 5.00, cached: 0.50, output: 30.0 },
      },
    ],
  },
  // W45 Phase 4: local / custom OpenAI-compatible endpoint group.
  // Models here are seed entries — the picker displays them when an endpoint is
  // configured but a specific model hasn't been selected yet. Real discovered
  // model names (from Phase 2's discover_models command) are persisted per-endpoint
  // in the settings store and surfaced through the endpoint manager UI.
  {
    provider: "local",
    label: "Local",
    models: [
      // Seed entry: always present so the picker has a valid local group.
      // Users select their actual discovered model (e.g. "llama3.2") via the endpoint
      // manager in Settings → Assistant; this ID is a displayable fallback.
      {
        id: "local",
        displayName: "Local model (configure endpoint in Settings)",
        provider: "local",
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the ModelEntry for a given model ID, or undefined if not in the registry. */
export function getModelEntry(modelId: string): ModelEntry | undefined {
  for (const group of PROVIDER_REGISTRY) {
    const found = group.models.find((m) => m.id === modelId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Returns the BYOK badge label for the active model's provider.
 * Used in AssistantPanel.tsx to name the active provider in the "Your key" chip.
 */
export function getBadgeLabel(modelId: string): string {
  const entry = getModelEntry(modelId);
  if (entry?.provider === "anthropic") return "Your Anthropic key";
  if (entry?.provider === "openai") return "Your OpenAI key";
  if (entry?.provider === "local") return "Local model"; // W45
  return "Your key"; // unknown model
}
