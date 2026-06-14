/**
 * Module-singleton remote-config store + fail-open fetch.
 *
 * At startup, fetchAndStoreHouseStyleConfig() is called once (fire-and-forget)
 * from App.tsx. Any failure leaves _active null so the baked-in default in
 * shared.ts is used. All guards are fail-open: network errors, bad HTTP status,
 * non-JSON bodies, type-guard failures, and oversized payloads all fall through
 * to "keep null / use baked-in default".
 */
import { type HouseStyleConfig,MAX_HOUSE_STYLE_BLOCK } from "./prompts/shared";

// Re-derive API_BASE from env — do NOT import from ai.client.ts (private const).
const API_BASE: string =
  (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ??
  "https://writersnook.app";

let _active: HouseStyleConfig | null = null;

/**
 * Active house-style config, or null when the baked-in default applies
 * (pre-fetch or fetch-failed). Read synchronously at prompt-build time.
 */
export function getActiveHouseStyleConfig(): HouseStyleConfig | null {
  return _active;
}

/** Test-only reset — clears the singleton back to null. */
export function __resetHouseStyleConfigForTests(): void {
  _active = null;
}

function isValidConfig(r: unknown): r is HouseStyleConfig {
  if (typeof r !== "object" || r === null) return false;
  const c = r as Record<string, unknown>;
  if (
    typeof c.version !== "number" ||
    typeof c.enabled !== "boolean" ||
    typeof c.block !== "string"
  )
    return false;
  if (
    typeof c.perModelAddenda !== "object" ||
    c.perModelAddenda === null ||
    Array.isArray(c.perModelAddenda)
  )
    return false;
  if ((c.block as string).length > MAX_HOUSE_STYLE_BLOCK) return false;
  return true;
}

/**
 * Fetch the remote house-style config and store it. Fail-open: any failure
 * leaves _active null (baked-in default from HOUSE_STYLE_DEFAULT applies).
 * Never throws.
 */
export async function fetchAndStoreHouseStyleConfig(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/house-style`, {
      method: "GET",
    });
    // guard 1: HTTP error (checked BEFORE parse so HTML 5xx bodies are never parsed)
    if (!res.ok) return;
    // guard 2: throws on non-JSON → caught below
    const parsed: unknown = await res.json();
    // guards 3-4: type-guard + length cap
    if (!isValidConfig(parsed)) return;
    _active = parsed;
  } catch {
    // guard 0: network reject / parse throw → keep baked-in default
  }
}

