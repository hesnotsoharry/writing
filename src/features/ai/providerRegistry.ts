/**
 * providerRegistry.ts — BYOK provider and model registry.
 *
 * Exports the shape W45 (local models) builds against:
 *   ProviderId | ModelEntry | ProviderGroup | PROVIDER_REGISTRY | PROVIDER_COMMAND
 *
 * W45 appends a 'local' ProviderGroup to PROVIDER_REGISTRY and a 'local' entry to
 * PROVIDER_COMMAND — no structural change to this file needed.
 *
 * All Anthropic model IDs sourced from the codebase (ai.types.ts / byok.rs constant).
 * All OpenAI model IDs and rates verified from research sidecar §5 (2026-06-14).
 */

// ── Provider IDs ──────────────────────────────────────────────────────────────

/** Canonical provider identifiers. W45 appends 'local'. */
export type ProviderId = "anthropic" | "openai" | "local";

/** Rust command name alias (string) — used in PROVIDER_COMMAND. */
export type CommandName = string;

// ── Rust command-name constants ───────────────────────────────────────────────
// Defined here so PROVIDER_COMMAND and the byok.*client files share one source.
// A rename updates one place; the type system propagates the change everywhere.

export const BYOK_CMD_ANTHROPIC = "byok_chat" as const;
export const BYOK_CMD_OPENAI    = "byok_openai_chat" as const;
export const BYOK_CMD_LOCAL     = "byok_local_chat" as const; // W45

// ── Types ─────────────────────────────────────────────────────────────────────

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
      { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku", provider: "anthropic" },
      { id: "claude-sonnet-4-6",         displayName: "Claude Sonnet", provider: "anthropic" },
    ],
  },
  {
    provider: "openai",
    label: "ChatGPT",
    models: [
      // Rates per openai.com/pricing (2026-06-14); research sidecar §5.
      { id: "gpt-5.4",      displayName: "GPT-5.4",      provider: "openai", costHint: "$2.50 / $15 per MTok" },
      { id: "gpt-5.4-mini", displayName: "GPT-5.4 mini", provider: "openai", costHint: "$0.75 / $4.50 per MTok" }, // canonical alias; valid per research sidecar §4; auto-resolves to latest snapshot
      { id: "gpt-5.5",      displayName: "GPT-5.5",      provider: "openai", costHint: "$5 / $30 per MTok" },
    ],
  },
  // W45 appends 'local' group here
];

/**
 * PROVIDER_COMMAND — maps ProviderId → Rust command name.
 * Values are the shared command-name constants above (not string literals).
 *
 * W45 adds: `local: BYOK_CMD_LOCAL`
 */
export const PROVIDER_COMMAND: Record<ProviderId, CommandName> = {
  anthropic: BYOK_CMD_ANTHROPIC,
  openai:    BYOK_CMD_OPENAI,
  local:     BYOK_CMD_LOCAL, // W45
};

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
  return "Your key"; // local (W45) or unknown model
}
