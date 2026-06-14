/**
 * Shared types for the ProviderAdapter seam (W44 Decision 1).
 *
 * Canonical home for Message and ResolvedConfig so that adapter
 * modules can import them without creating a circular dependency
 * through chat.ts.
 */
import type { FallbackVerbConfig, VerbConfig } from "../verb-config";

// ── Message ───────────────────────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── ResolvedConfig ────────────────────────────────────────────────────────────

/** Per-request resolved verb config (Standard | Thinking | Fallback). */
export type ResolvedConfig = VerbConfig | FallbackVerbConfig;

// ── CanonicalUsage ────────────────────────────────────────────────────────────

/**
 * Normalized token-usage bucket returned by every ProviderAdapter.pump.
 *
 * Field semantics:
 *   inputTokens        — non-cached input tokens billed at the base `input` rate.
 *   outputTokens       — output tokens billed at the `output` rate.
 *   cacheCreationTokens— tokens written to cache this request (Anthropic only;
 *                        always 0 for OpenAI — caching is automatic / no write premium).
 *   cacheReadTokens    — tokens retrieved from cache this request.
 *
 * OpenAI divergence (Decision 3): `prompt_tokens` INCLUDES `cached_tokens`.
 * The OpenAIAdapter MUST compute inputTokens = prompt_tokens − cached_tokens
 * before populating this struct, or cached input is billed twice.
 */
export interface CanonicalUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

// ── ProviderAdapter ───────────────────────────────────────────────────────────

export interface ProviderAdapter {
  readonly provider: "anthropic" | "openai";

  /**
   * Build the provider-specific HTTP request (URL + headers + body object).
   * The caller JSON-serializes `body` and calls fetch.
   */
  buildRequest(a: {
    messages: Message[];
    config: ResolvedConfig;
    system?: string;
    apiKey: string;
  }): { url: string; headers: Record<string, string>; body: unknown };

  /**
   * Consume the upstream SSE stream, calling `writeToken` for each text delta,
   * and return the canonical token-usage breakdown on completion.
   */
  pump(
    upstreamBody: ReadableStream<Uint8Array>,
    writeToken: (text: string) => Promise<void>,
  ): Promise<CanonicalUsage>;
}
