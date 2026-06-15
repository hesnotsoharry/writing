/**
 * BYOK local client — thin invoke() wrappers over `byok_local_*` Tauri commands
 * (Wave 45, Phase 4).
 *
 * Mirrors `byok.openai.client.ts` but targets a user-saved local/custom
 * OpenAI-compatible endpoint. Key resolution follows the saved-endpoint pattern
 * from Phase 2: the API key for a saved endpoint is loaded Rust-side via the
 * `local-endpoint/*` keychain namespace — it NEVER re-enters JS after storage.
 *
 * Key-change events fire on the window as `'byok:local-key-changed'` — distinct
 * from Anthropic/OpenAI events so the three providers cannot cross-fire. The hook
 * useByokKeys also listens for `'custom-endpoint:key-changed'` (fired by
 * customEndpoints.client.ts) so key changes made via the Settings UI propagate.
 *
 * `NormalizedEvent` is the same union emitted by all providers; imported from
 * `ai.client.ts` so the TS type and Rust `#[serde(tag="type")]` enum share one
 * source of truth.
 */

import { Channel, invoke } from "@tauri-apps/api/core";

import type { NormalizedEvent } from "./ai.client";
import { getDefault, loadEndpoints } from "./customEndpoints";
import { hasEndpointKey } from "./customEndpoints.client";
import { BYOK_CMD_LOCAL } from "./providerRegistry";

// Re-export so callers don't need to import from ai.client.ts just for the type.
export type { NormalizedEvent };

// ── Message shape ─────────────────────────────────────────────────────────────

/** A single conversation turn. Matches the Rust `Msg` struct. */
export interface Msg {
  role: "user" | "assistant";
  content: string;
}

// ── Key-presence helpers ──────────────────────────────────────────────────────

/**
 * Returns true iff the active (default) saved endpoint has an API key stored in
 * the OS keychain. Returns false when no endpoint is configured or no key is set
 * (keyless servers — those work without a key but are addressed by Phase 5).
 *
 * Parameterless to match the Anthropic/OpenAI has-key pattern; reads the default
 * endpoint ID from the settings store to avoid crossing the key to JS.
 */
export async function byokLocalHasKey(): Promise<boolean> {
  const store = loadEndpoints();
  if (!store.defaultId) return false;
  return hasEndpointKey(store.defaultId).catch(() => false);
}

/**
 * Store an API key for the active (default) saved endpoint in the OS keychain.
 * Fires `'byok:local-key-changed'` after the key is stored.
 * No-op when no default endpoint is configured.
 */
export async function byokLocalSetKey(apiKey: string): Promise<void> {
  const store = loadEndpoints();
  if (!store.defaultId) return;
  const { setEndpointKey } = await import("./customEndpoints.client");
  await setEndpointKey(store.defaultId, apiKey);
  window.dispatchEvent(new CustomEvent("byok:local-key-changed", { detail: { action: "set" } }));
}

/**
 * Remove the API key for the active (default) saved endpoint from the OS keychain.
 * Fires `'byok:local-key-changed'` after clearing. Idempotent.
 * No-op when no default endpoint is configured.
 */
export async function byokLocalClearKey(): Promise<void> {
  const store = loadEndpoints();
  if (!store.defaultId) return;
  const { clearEndpointKey } = await import("./customEndpoints.client");
  await clearEndpointKey(store.defaultId);
  window.dispatchEvent(new CustomEvent("byok:local-key-changed", { detail: { action: "clear" } }));
}

// ── Streaming ─────────────────────────────────────────────────────────────────

/** Cancel an in-flight byok_local_chat stream by stream_id. No-op if not found. */
export async function byokLocalStop(streamId: string): Promise<void> {
  return invoke("byok_local_stop", { streamId });
}

/** Options for `streamByokLocalChat`. */
export interface StreamByokLocalChatOptions {
  /** System prompt. Default: "". */
  system?: string;
  /** Verb key — used upstream for prompt construction; not forwarded to Rust. Default: "brainstorm". */
  verb?: string;
  /** Model identifier (e.g. "llama3.2" from discovered endpoint models). Default: "local". */
  model?: string;
  /** Maximum completion tokens. Default: 1024. */
  maxCompletionTokens?: number;
  /** Temperature (0–2). Default: 1.0. */
  temperature?: number;
  /** AbortSignal — abort fires `byokLocalStop` automatically. */
  signal?: AbortSignal;
}

/** Wire an AbortSignal to stop the given stream. */
function wireSignal(signal: AbortSignal, streamId: string): void {
  signal.addEventListener("abort", () => void byokLocalStop(streamId));
}

/**
 * Stream a chat request to the active saved local endpoint via the Rust BYOK local
 * pipeline. The API key is loaded from the OS keychain by Rust (via `endpoint_id`)
 * and never re-enters JS.
 *
 * Throws if no default endpoint is configured — the caller (routeByokSend /
 * streamByokLocalResponse) must guard on `byokKeys.local` before calling.
 *
 * @param streamId  Unique ID for this stream; pass to `byokLocalStop` to cancel.
 * @param messages  Conversation history (user/assistant turns).
 * @param onEvent   Called for each NormalizedEvent (token / done / error).
 * @param options   Optional system, model, maxCompletionTokens, temperature, signal.
 */
export async function streamByokLocalChat(
  streamId: string,
  messages: Msg[],
  onEvent: (ev: NormalizedEvent) => void,
  options?: StreamByokLocalChatOptions,
): Promise<void> {
  const {
    model = "local",
    system = "",
    maxCompletionTokens = 1024,
    temperature = 1.0,
    signal,
  } = options ?? {};

  // Load the default saved endpoint (URL + ID for Rust-side key resolution).
  const endpoint = getDefault(loadEndpoints());
  if (!endpoint) {
    throw new Error("No local endpoint configured — add one in Settings → Assistant");
  }

  const ch = new Channel<NormalizedEvent>();
  ch.onmessage = onEvent;
  if (signal) wireSignal(signal, streamId);

  return invoke(BYOK_CMD_LOCAL, {
    streamId,
    baseUrl: endpoint.url,
    model,
    messages,
    system,
    maxCompletionTokens,
    temperature,
    apiKey: null,        // key loaded Rust-side via endpointId (never crosses to JS)
    endpointId: endpoint.id,
    onEvent: ch,
  });
}
