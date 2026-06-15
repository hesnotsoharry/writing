/**
 * BYOK client — thin invoke wrappers over the five `byok_*` Tauri commands.
 *
 * The user's API key is accepted by `byokSetKey` and immediately transferred to
 * the Rust keychain; it NEVER re-enters JS after that call returns. All other
 * functions operate on stream IDs and boolean flags only.
 *
 * `NormalizedEvent` is imported (not redefined) from `ai.client.ts` so the TS
 * union and the Rust `#[serde(tag="type")]` enum stay in sync from a single
 * source of truth.
 */

import { Channel, invoke } from "@tauri-apps/api/core";

import type { NormalizedEvent } from "./ai.client";

// Re-export so callers don't need to import from ai.client.ts just for the type.
export type { NormalizedEvent };

// ── Message shape ─────────────────────────────────────────────────────────────

/** A single conversation turn. Matches the Rust `Msg` struct. */
export interface Msg {
  role: "user" | "assistant";
  content: string;
}

// ── Keychain commands ─────────────────────────────────────────────────────────

/** Store the user's Anthropic API key in the OS keychain via Rust. */
export async function byokSetKey(apiKey: string): Promise<void> {
  return invoke("byok_set_key", { apiKey });
}

/** Returns true iff a BYOK key is currently stored in the OS keychain. */
export async function byokHasKey(): Promise<boolean> {
  return invoke("byok_has_key");
}

/** Remove the BYOK API key from the OS keychain. Idempotent. */
export async function byokClearKey(): Promise<void> {
  return invoke("byok_clear_key");
}

// ── Streaming ─────────────────────────────────────────────────────────────────

/** Cancel an in-flight byok_chat stream by stream_id. No-op if not found. */
export async function byokStop(streamId: string): Promise<void> {
  return invoke("byok_stop", { streamId });
}

/** Options for `streamByokChat`. Mirrors `StreamChatOptions` from ai.client.ts. */
export interface StreamByokChatOptions {
  /** System prompt forwarded to Anthropic's `system` field. Default: "". */
  system?: string;
  /** Verb key — resolves temperature + max_tokens in Rust. Default: "brainstorm". */
  verb?: string;
  /**
   * Anthropic model ID forwarded to Rust's byok_chat.
   * W49 Phase 2 — model param added; picker wires real selection in Phase 4.
   * Default: 'claude-haiku-4-5-20251001' (preserves pre-Phase-2 behavior).
   */
  model?: string;
  /** AbortSignal — abort fires `byokStop` automatically. */
  signal?: AbortSignal;
}

/**
 * Stream a chat request directly to api.anthropic.com via the Rust BYOK
 * pipeline. The API key is fetched from the OS keychain by Rust and never
 * re-enters JS.
 *
 * @param streamId  Unique ID for this stream; pass to `byokStop` to cancel.
 * @param messages  Conversation history.
 * @param onEvent   Called for each NormalizedEvent (token / done / error).
 * @param options   Optional system, verb, and AbortSignal.
 */
export async function streamByokChat(
  streamId: string,
  messages: Msg[],
  onEvent: (ev: NormalizedEvent) => void,
  options?: StreamByokChatOptions,
): Promise<void> {
  const ch = new Channel<NormalizedEvent>();
  ch.onmessage = onEvent;

  if (options?.signal) {
    options.signal.addEventListener("abort", () => void byokStop(streamId));
  }

  // W49 Phase 2 — model param added; picker wires real selection in Phase 4.
  return invoke("byok_chat", {
    streamId,
    messages,
    system: options?.system ?? "",
    verb: options?.verb ?? "brainstorm",
    model: options?.model ?? "claude-haiku-4-5-20251001",
    onEvent: ch,
  });
}

