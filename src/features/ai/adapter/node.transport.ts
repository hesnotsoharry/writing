/**
 * NodeSdkTransport — eval-rig transport using @anthropic-ai/sdk and openai SDKs.
 *
 * ONLY imported by the eval/ directory. Never imported by the Tauri renderer build.
 * Vite tree-shaking keeps these SDKs out of the production bundle (Decision D3).
 *
 * Keys are provided at construction time from process.env (eval) — never per-request.
 * maxRetries: 2 explicit on both SDK clients (A4 — required for a ~1700-call eval run).
 * Partial usage captured on throw per Amendment A4 (cost ledger stays honest).
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import { type AdapterError, type AdapterUsage, ProviderAdapterError, type WireRequest, type WireResponse } from "./types";

// ── Internal types ────────────────────────────────────────────────────────────

type OnToken = (text: string) => void;

export interface NodeSdkTransportOptions {
  anthropicKey: string;
  openaiKey: string;
  openrouterKey: string;
}

/** Mutable state accumulated during an OpenAI streaming response. */
interface OaiAccumulator {
  text: string;
  model: string;
  stopReason: string;
  usage: OpenAI.Completions.CompletionUsage | null;
}

// ── Anthropic error normalization ─────────────────────────────────────────────

/**
 * Maps @anthropic-ai/sdk v0.104.2 errors to AdapterError.
 * BillingError / OverloadedError are NOT error classes in this SDK version —
 * they are detected via the .type field on InternalServerError.
 */
function mapAnthropicError(err: unknown, partial?: Partial<AdapterError>): AdapterError {
  if (err instanceof Anthropic.AuthenticationError) {
    return { code: "auth", message: err.message, retryable: false, ...partial };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { code: "rate-limit", message: err.message, retryable: true, ...partial };
  }
  if (err instanceof Anthropic.InternalServerError) {
    if (err.type === "billing_error") {
      return { code: "billing", message: err.message, retryable: false, ...partial };
    }
    if (err.type === "overloaded_error" || err.status === 529) {
      return { code: "overloaded", message: err.message, retryable: true, ...partial };
    }
    return { code: "provider", message: err.message, retryable: false, ...partial };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { code: "network", message: err.message, retryable: true, ...partial };
  }
  if (err instanceof Anthropic.APIError) {
    return { code: "provider", message: err.message, retryable: false, ...partial };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { code: "network", message: msg, retryable: true, ...partial };
}

// ── OpenAI / OpenRouter error normalization ───────────────────────────────────

/** Maps openai v6.42.0 errors to AdapterError. Used for both OpenAI and OpenRouter. */
function mapOpenAiError(err: unknown, partial?: Partial<AdapterError>): AdapterError {
  if (err instanceof OpenAI.AuthenticationError) {
    return { code: "auth", message: err.message, retryable: false, ...partial };
  }
  if (err instanceof OpenAI.RateLimitError) {
    return { code: "rate-limit", message: err.message, retryable: true, ...partial };
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return { code: "network", message: err.message, retryable: true, ...partial };
  }
  if (err instanceof OpenAI.InternalServerError) {
    return { code: "overloaded", message: err.message, retryable: true, ...partial };
  }
  if (err instanceof OpenAI.BadRequestError) {
    return { code: "provider", message: err.message, retryable: false, ...partial };
  }
  if (err instanceof OpenAI.APIError) {
    return { code: "provider", message: err.message, retryable: false, ...partial };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { code: "network", message: msg, retryable: true, ...partial };
}

// ── Anthropic wire operations ─────────────────────────────────────────────────

async function anthropicComplete(client: Anthropic, req: WireRequest): Promise<WireResponse> {
  try {
    const msg = await client.messages.create({
      model: req.modelId,
      system: req.system,
      messages: req.messages as Anthropic.MessageParam[],
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      // seed: not passed — Anthropic has no seed API (design doc §3b)
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    return {
      text: textBlock?.type === "text" ? textBlock.text : "",
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      cacheReadTokens: msg.usage.cache_read_input_tokens ?? undefined,
      model: msg.model,
      stopReason: msg.stop_reason ?? "other",
    };
  } catch (err) {
    throw new ProviderAdapterError(mapAnthropicError(err));
  }
}

async function anthropicStream(
  client: Anthropic,
  req: WireRequest,
  onToken: OnToken,
  signal?: AbortSignal,
): Promise<WireResponse> {
  let partialText = "";
  const msgStream = client.messages.stream(
    {
      model: req.modelId,
      system: req.system,
      messages: req.messages as Anthropic.MessageParam[],
      max_tokens: req.maxTokens,
      temperature: req.temperature,
    },
    { signal },
  );
  msgStream.on("text", (textDelta) => {
    partialText += textDelta;
    onToken(textDelta);
  });
  try {
    const msg = await msgStream.finalMessage();
    return {
      text: partialText,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      cacheReadTokens: msg.usage.cache_read_input_tokens ?? undefined,
      model: msg.model,
      stopReason: msg.stop_reason ?? "other",
    };
  } catch (err) {
    throw new ProviderAdapterError(mapAnthropicError(err, { partialText }));
  }
}

// ── OpenAI / OpenRouter wire helpers ─────────────────────────────────────────

function buildOaiMessages(req: WireRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
  const sys: OpenAI.Chat.ChatCompletionMessageParam = { role: "system", content: req.system };
  const conv = req.messages.map(
    (m): OpenAI.Chat.ChatCompletionMessageParam =>
      m.role === "user"
        ? { role: "user", content: m.content }
        : { role: "assistant", content: m.content },
  );
  return [sys, ...conv];
}

/** Extracts normalized usage from an OpenAI CompletionUsage (null-safe). */
function extractOaiUsage(
  usage: OpenAI.Completions.CompletionUsage | null | undefined,
): AdapterUsage {
  if (!usage) return { inputTokens: 0, outputTokens: 0 };
  const cacheReadTokens = usage.prompt_tokens_details?.cached_tokens ?? undefined;
  return { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, cacheReadTokens };
}

/** Accumulates one streaming chunk into acc and fires onToken if text is present. */
function processOaiChunk(
  chunk: OpenAI.Chat.ChatCompletionChunk,
  acc: OaiAccumulator,
  onToken: OnToken,
): void {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    acc.text += delta;
    onToken(delta);
  }
  const reason = chunk.choices[0]?.finish_reason;
  if (reason) acc.stopReason = reason;
  if (chunk.model) acc.model = chunk.model;
  if (chunk.usage) acc.usage = chunk.usage;
}

async function drainOaiChunks(
  chunks: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>,
  acc: OaiAccumulator,
  onToken: OnToken,
): Promise<void> {
  for await (const chunk of chunks) {
    processOaiChunk(chunk, acc, onToken);
  }
}

// ── OpenAI wire operations ────────────────────────────────────────────────────

async function openaiComplete(client: OpenAI, req: WireRequest): Promise<WireResponse> {
  try {
    const res = await client.chat.completions.create({
      model: req.modelId,
      messages: buildOaiMessages(req),
      max_completion_tokens: req.maxTokens,
      temperature: req.temperature,
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    });
    const usage = extractOaiUsage(res.usage);
    const text = res.choices[0]?.message?.content ?? "";
    const stopReason = res.choices[0]?.finish_reason ?? "other";
    return { text, ...usage, model: res.model, stopReason };
  } catch (err) {
    throw new ProviderAdapterError(mapOpenAiError(err));
  }
}

async function openaiStream(
  client: OpenAI,
  req: WireRequest,
  onToken: OnToken,
  signal?: AbortSignal,
): Promise<WireResponse> {
  const acc: OaiAccumulator = { text: "", model: req.modelId, stopReason: "other", usage: null };
  try {
    const chunks = await client.chat.completions.create(
      {
        model: req.modelId,
        messages: buildOaiMessages(req),
        max_completion_tokens: req.maxTokens,
        temperature: req.temperature,
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
        stream: true as const,
        stream_options: { include_usage: true },
      },
      { signal },
    );
    await drainOaiChunks(chunks, acc, onToken);
    const usage = extractOaiUsage(acc.usage);
    return { text: acc.text, ...usage, model: acc.model, stopReason: acc.stopReason };
  } catch (err) {
    const usage = extractOaiUsage(acc.usage);
    const partialUsage = acc.usage ? usage : undefined;
    throw new ProviderAdapterError(mapOpenAiError(err, { partialText: acc.text, partialUsage }));
  }
}

// ── Transport class ───────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class NodeSdkTransport {
  readonly #anthropic: Anthropic;
  readonly #openai: OpenAI;
  readonly #openrouter: OpenAI;

  constructor(opts: NodeSdkTransportOptions) {
    this.#anthropic = new Anthropic({ apiKey: opts.anthropicKey, maxRetries: 2 });
    this.#openai = new OpenAI({ apiKey: opts.openaiKey, maxRetries: 2 });
    this.#openrouter = new OpenAI({
      apiKey: opts.openrouterKey,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: { "HTTP-Referer": "https://writersnook.app", "X-Title": "WritersNook" },
      maxRetries: 2,
    });
  }

  async complete(req: WireRequest): Promise<WireResponse> {
    if (req.provider === "anthropic") return anthropicComplete(this.#anthropic, req);
    const client = req.provider === "openrouter" ? this.#openrouter : this.#openai;
    return openaiComplete(client, req);
  }

  async stream(req: WireRequest, onToken: OnToken, signal?: AbortSignal): Promise<WireResponse> {
    if (req.provider === "anthropic") {
      return anthropicStream(this.#anthropic, req, onToken, signal);
    }
    const client = req.provider === "openrouter" ? this.#openrouter : this.#openai;
    return openaiStream(client, req, onToken, signal);
  }
}
