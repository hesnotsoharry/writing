/**
 * Adapter types — provider-agnostic interfaces for the W46 eval rig and W44 production adapter.
 *
 * Contract source: wave-46-adapter-design.md Items 1–2 + Amendments A1–A4.
 * Import AiMessage from ../ai.client (single source of truth for message shape).
 * ProviderName is sourced from ../providerModels (zero-dep registry; avoid duplication).
 */

import type { AiMessage } from "../ai.client";
import type { ProviderName } from "../providerModels";

// ── Error surface ─────────────────────────────────────────────────────────────

export type AdapterErrorCode =
  | "auth" // 401 — bad API key
  | "rate-limit" // 429 — provider throttle (retryable)
  | "billing" // Anthropic billing_error (key valid, account issue)
  | "overloaded" // Anthropic 529 / overloaded_error (retryable)
  | "network" // connection-level failure (retryable)
  | "provider"; // catch-all for unexpected provider errors

export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
  retryable: boolean;
  /**
   * Partial text accumulated before the error (Amendment A4).
   * Populated by NodeSdkTransport when a stream fails mid-way.
   */
  partialText?: string;
  /**
   * Partial usage if the SDK exposes it at error time (Amendment A4).
   * Keeps the cost ledger honest when a call bills input tokens then fails.
   */
  partialUsage?: AdapterUsage;
}

/** Thrown by complete() and stream() on provider errors. */
export class ProviderAdapterError extends Error {
  constructor(public readonly normalized: AdapterError) {
    super(normalized.message);
    this.name = "ProviderAdapterError";
  }
}

// ── Response types ────────────────────────────────────────────────────────────

/** Token usage in a normalized shape — same fields serve eval cost calc and W44 display. */
export interface AdapterUsage {
  inputTokens: number;
  outputTokens: number;
  /**
   * Anthropic: cache_read_input_tokens. OpenAI: prompt_tokens_details.cached_tokens.
   * Undefined when the provider did not return a value (non-cached call).
   */
  cacheReadTokens?: number;
}

/**
 * The one normalized result type — serves both streaming and non-streaming paths.
 *
 * Non-streaming (eval): complete() resolves with this directly.
 * Streaming (W44): stream() resolves with this as the terminal aggregate;
 *                 incremental tokens arrive via the onToken callback.
 */
export interface AdapterResult {
  text: string;
  usage: AdapterUsage;
  /** Model ID echoed from the provider response (confirms which snapshot ran). */
  model: string;
  /**
   * Stop reason — normalized from all providers.
   *
   * Mapping:
   *   "end_turn"       ← Anthropic: end_turn, stop_sequence  | OpenAI: stop
   *   "max_tokens"     ← Anthropic: max_tokens               | OpenAI: length
   *   "content_filter" ← Anthropic: refusal                  | OpenAI: content_filter
   *   "tool_use"       ← Anthropic: tool_use                 | OpenAI: tool_calls
   *   "other"          ← pause_turn (NEVER end_turn, per A3), function_call, unknown
   *
   * A3: pause_turn means mid-turn continuation — the eval MUST NOT score it as complete.
   */
  stopReason: "end_turn" | "max_tokens" | "content_filter" | "tool_use" | "other";
}

// ── Call parameters ───────────────────────────────────────────────────────────

/** What the caller passes in — provider-agnostic. */
export interface AdapterCallParams {
  modelId: string; // must exist in PROVIDER_MODELS registry
  system: string; // from buildMessages().system — passed verbatim
  messages: AiMessage[]; // from buildMessages().messages — passed verbatim
  maxTokens: number;
  temperature: number; // 0–1; eval: 0.3 creative / 0 proofread
  seed?: number; // silently dropped for Anthropic (no seed API)
}

/** The public adapter interface — same for eval rig and W44. */
export interface ProviderAdapter {
  /** Non-streaming. Eval rig primary path. Throws ProviderAdapterError on errors. */
  complete(params: AdapterCallParams): Promise<AdapterResult>;

  /**
   * Streaming. W44 UI primary path.
   * Calls onToken for each incremental text chunk as it arrives.
   * Resolves with AdapterResult (full text + terminal usage) when done.
   * signal: network-level cancellation (W44 stop button) — Amendment A1.
   */
  stream(
    params: AdapterCallParams,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<AdapterResult>;
}

// ── Transport seam ────────────────────────────────────────────────────────────

/** The raw wire-level request passed from adapter → transport. */
export interface WireRequest {
  provider: ProviderName;
  /**
   * API key for the provider.
   * NodeSdkTransport uses its own constructor-provided keys and ignores this field;
   * the field is reserved for future transports that receive keys per-request.
   */
  apiKey: string;
  baseUrl?: string; // set for openrouter; undefined for anthropic + openai
  modelId: string;
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
  seed?: number;
}

/** The raw wire-level response returned by the transport — stopReason is a raw provider string. */
export interface WireResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  model: string;
  stopReason: string; // raw provider value; adapter normalizes to AdapterResult.stopReason
}

export interface ProviderTransport {
  complete(req: WireRequest): Promise<WireResponse>;
  stream(req: WireRequest, onToken: (text: string) => void, signal?: AbortSignal): Promise<WireResponse>;
}

// Re-export so callers can import ProviderName from one place.
export type { ProviderName };
