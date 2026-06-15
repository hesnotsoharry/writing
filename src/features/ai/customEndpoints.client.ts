/**
 * customEndpoints.client.ts — thin invoke wrappers over the `local_endpoint_*_key`
 * Tauri commands (Wave 45 Phase 2). Mirrors byok.client.ts structure.
 *
 * API keys NEVER re-enter persistent JS state after `setEndpointKey` returns.
 * Model discovery for saved endpoints loads the key Rust-side via `discover_models`
 * (endpoint_id param) — the raw key never crosses back to JS.
 */
import { invoke } from "@tauri-apps/api/core";

/** CustomEvent dispatched after set or clear — mirrors byok's `byok:key-changed`. */
export const CUSTOM_ENDPOINT_KEY_CHANGED = "custom-endpoint:key-changed";

/** Store a per-endpoint API key in the OS keychain. Dispatches `custom-endpoint:key-changed`. */
export async function setEndpointKey(endpointId: string, apiKey: string): Promise<void> {
  await invoke("local_endpoint_set_key", { endpointId, apiKey });
  window.dispatchEvent(new CustomEvent(CUSTOM_ENDPOINT_KEY_CHANGED));
}

/** Returns true iff a non-empty API key is stored for this endpoint. */
export async function hasEndpointKey(endpointId: string): Promise<boolean> {
  return invoke("local_endpoint_has_key", { endpointId });
}

/**
 * Remove the API key for this endpoint from the OS keychain. Idempotent.
 * Dispatches `custom-endpoint:key-changed`.
 */
export async function clearEndpointKey(endpointId: string): Promise<void> {
  await invoke("local_endpoint_clear_key", { endpointId });
  window.dispatchEvent(new CustomEvent(CUSTOM_ENDPOINT_KEY_CHANGED));
}

