/**
 * byokUsage.ts — persistent per-provider BYOK usage store (Wave 49 Phase 5).
 *
 * Persists accumulated per-provider token counts + estimated USD to localStorage
 * under STORAGE_KEY. Decision 6: localStorage is the correct tier for non-secret,
 * non-critical, informational counters — no SQLite migration needed.
 *
 * Public API:
 *   getUsage()     → current per-provider totals (reads localStorage)
 *   recordUsage()  → accumulate one turn's tokens + compute incremental estUsd
 *   clearUsage()   → reset all totals (removes the localStorage key)
 *
 * Guard: all localStorage access is wrapped in try/catch → no-op on failure
 * (private browsing, storage quota, WebView data cleared, test isolation, etc.).
 *
 * Re-render trigger: recordUsage + clearUsage dispatch `byok:usage-updated` on
 * window so the Settings readout can re-read state without polling.
 */

import { getModelEntry } from "./providerRegistry";

// ── Storage key + types ───────────────────────────────────────────────────────

const STORAGE_KEY = "byok-usage-v1";

/** Accumulated token counts + estimated USD for a single provider. */
export interface ProviderUsage {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  /** Running estimated cost in USD. cachedTokens are billed at the cache-read rate. */
  estUsd: number;
}

interface UsageStore {
  anthropic: ProviderUsage;
  openai: ProviderUsage;
}

type SupportedProvider = "anthropic" | "openai";

// ── Defaults ──────────────────────────────────────────────────────────────────

function emptyProvider(): ProviderUsage {
  return { inputTokens: 0, cachedTokens: 0, outputTokens: 0, estUsd: 0 };
}

function emptyStore(): UsageStore {
  return { anthropic: emptyProvider(), openai: emptyProvider() };
}

// ── localStorage read / write ─────────────────────────────────────────────────

function read(): UsageStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<UsageStore>;
    // Merge with defaults so a partial/stale JSON doesn't lose fields.
    return {
      anthropic: { ...emptyProvider(), ...(parsed.anthropic ?? {}) },
      openai: { ...emptyProvider(), ...(parsed.openai ?? {}) },
    };
  } catch {
    // localStorage unavailable or corrupt JSON — safe fallback.
    return emptyStore();
  }
}

function write(data: UsageStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // no-op: localStorage unavailable (private browsing, quota exceeded, etc.)
  }
}

function notifyUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent("byok:usage-updated"));
  } catch {
    // no-op: non-browser environment or JSDOM without event support
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the current per-provider usage totals. Reads from localStorage. */
export function getUsage(): UsageStore {
  return read();
}

/**
 * Accumulate one BYOK turn's token usage for a provider.
 *
 * Looks up the model's rateUsd from providerRegistry and computes incremental
 * estUsd = (input×rate.input + cached×rate.cached + output×rate.output) / 1e6
 * where rates are in $/MTok. cachedTokens are billed at rate.cached (the cheap
 * cache-read rate, not the full input rate) — accurate per Anthropic/OpenAI pricing.
 *
 * If the model is not in the registry (no rateUsd), tokens accumulate but estUsd
 * stays unchanged for that turn.
 *
 * Dispatches `byok:usage-updated` on window after writing so UI components can
 * re-read without polling.
 *
 * @param provider - "anthropic" or "openai"
 * @param tokens - the turn's token breakdown from the NormalizedEvent 'done' arm
 * @param model - the model ID used for this turn (for rate lookup)
 */
export function recordUsage(
  provider: SupportedProvider,
  tokens: { inputTokens: number; cachedTokens: number; outputTokens: number },
  model: string,
): void {
  const entry = getModelEntry(model);
  const rates = entry?.rateUsd;
  const incrementalUsd = rates
    ? (tokens.inputTokens * rates.input + tokens.cachedTokens * rates.cached + tokens.outputTokens * rates.output) / 1e6
    : 0;

  const store = read();
  const prev = store[provider];
  store[provider] = {
    inputTokens: prev.inputTokens + tokens.inputTokens,
    cachedTokens: prev.cachedTokens + tokens.cachedTokens,
    outputTokens: prev.outputTokens + tokens.outputTokens,
    estUsd: prev.estUsd + incrementalUsd,
  };
  write(store);
  notifyUpdate();
}

/**
 * Reset all per-provider usage totals. Removes the localStorage key entirely
 * so a re-read returns zeros.
 *
 * Dispatches `byok:usage-updated` so the Settings readout re-renders.
 */
export function clearUsage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
  notifyUpdate();
}
