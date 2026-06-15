/**
 * BYOK OpenAI client — thin invoke() wrappers over the five `byok_openai_*`
 * Tauri commands (Wave 49, Phase 1).
 *
 * Mirrors `byok.client.ts` (Anthropic path) but targets api.openai.com via the
 * Rust `byok_openai_*` command set. The user's OpenAI API key is accepted by
 * `byokOpenAiSetKey` and immediately transferred to the Rust keychain; it NEVER
 * re-enters JS after that call returns.
 *
 * Key-change events fire on the window as `'byok:openai-key-changed'` — distinct
 * from `'byok:key-changed'` (Anthropic) so the two providers cannot cross-fire.
 *
 * `NormalizedEvent` is the same union emitted by both providers; imported from
 * `ai.client.ts` so the TS type and the Rust `#[serde(tag="type")]` enum share
 * one source of truth.
 */

import { Channel, invoke } from "@tauri-apps/api/core";

import type { NormalizedEvent } from "./ai.client";
import { BYOK_CMD_OPENAI } from "./providerRegistry";

// Re-export so callers don't need to import from ai.client.ts just for the type.
export type { NormalizedEvent };

// ── Message shape ─────────────────────────────────────────────────────────────

/** A single conversation turn. Matches the Rust `Msg` struct. */
export interface Msg {
  role: "user" | "assistant";
  content: string;
}

// ── Keychain commands ─────────────────────────────────────────────────────────

/**
 * Store the user's OpenAI API key in the OS keychain via Rust.
 * Fires `'byok:openai-key-changed'` on the window after the key is stored.
 */
export async function byokOpenAiSetKey(apiKey: string): Promise<void> {
  await invoke("byok_openai_set_key", { apiKey });
  window.dispatchEvent(
    new CustomEvent("byok:openai-key-changed", { detail: { action: "set" } }),
  );
}

/** Returns true iff an OpenAI BYOK key is currently stored in the OS keychain. */
export async function byokOpenAiHasKey(): Promise<boolean> {
  return invoke("byok_openai_has_key");
}

/**
 * Remove the OpenAI API key from the OS keychain. Idempotent.
 * Fires `'byok:openai-key-changed'` on the window after the key is cleared.
 */
export async function byokOpenAiClearKey(): Promise<void> {
  await invoke("byok_openai_clear_key");
  window.dispatchEvent(
    new CustomEvent("byok:openai-key-changed", { detail: { action: "clear" } }),
  );
}

// ── Streaming ─────────────────────────────────────────────────────────────────

/** Cancel an in-flight byok_openai_chat stream by stream_id. No-op if not found. */
export async function byokOpenAiStop(streamId: string): Promise<void> {
  return invoke("byok_openai_stop", { streamId });
}

/** Options for `streamByokOpenAiChat`. */
export interface StreamByokOpenAiChatOptions {
  /** System prompt folded into a leading system message. Default: "". */
  system?: string;
  /** Verb key — used upstream for prompt construction; not forwarded to Rust. Default: "brainstorm". */
  verb?: string;
  /**
   * Model identifier. W49 Phase 1 default: 'gpt-5.4'.
   * Phase 4 will inject the registry-resolved model instead.
   */
  model?: string;
  /** Maximum completion tokens. Default: 1024. */
  maxCompletionTokens?: number;
  /** Temperature (0–2). Only valid when reasoning_effort is 'none'. Default: 1.0. */
  temperature?: number;
  /** AbortSignal — abort fires `byokOpenAiStop` automatically. */
  signal?: AbortSignal;
}

/** Wire an AbortSignal to stop the given stream. */
function wireSignal(signal: AbortSignal, streamId: string): void {
  signal.addEventListener("abort", () => void byokOpenAiStop(streamId));
}

/**
 * Stream a chat request directly to api.openai.com via the Rust BYOK OpenAI
 * pipeline. The API key is fetched from the OS keychain by Rust and never
 * re-enters JS.
 *
 * @param streamId  Unique ID for this stream; pass to `byokOpenAiStop` to cancel.
 * @param messages  Conversation history (user/assistant turns).
 * @param onEvent   Called for each NormalizedEvent (token / done / error).
 * @param options   Optional system, model, maxCompletionTokens, temperature, signal.
 */
export async function streamByokOpenAiChat(
  streamId: string,
  messages: Msg[],
  onEvent: (ev: NormalizedEvent) => void,
  options?: StreamByokOpenAiChatOptions,
): Promise<void> {
  const {
    model = "gpt-5.4",
    system = "",
    maxCompletionTokens = 1024,
    temperature = 1.0,
    signal,
  } = options ?? {};

  const ch = new Channel<NormalizedEvent>();
  ch.onmessage = onEvent;
  if (signal) wireSignal(signal, streamId);

  // W49 Phase 4: command name from shared BYOK_CMD_OPENAI constant (providerRegistry.ts).
  return invoke(BYOK_CMD_OPENAI, {
    streamId, messages, onEvent: ch,
    model, system, maxCompletionTokens, temperature,
  });
}
