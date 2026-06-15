/**
 * AnthropicAdapter — behavior-preserving extraction of the Anthropic Messages API
 * path from chat.ts (W44 Phase B, Decision 1).
 *
 * Verbatim lift of callAnthropic / processAnthropicLine / pumpAnthropicToClient.
 * Existing chat.test.ts Anthropic cases guard behavioral parity.
 */
import { shouldAttachCache } from "../prompt-cache";
import type { CanonicalUsage, Message, ProviderAdapter, ResolvedConfig } from "./types";

// ── Constants (moved from chat.ts) ───────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const EXTENDED_CACHE_TTL_BETA = "extended-cache-ttl-2025-04-11";

// ── AnthropicAdapter ──────────────────────────────────────────────────────────

export class AnthropicAdapter implements ProviderAdapter {
  readonly provider = "anthropic" as const;

  buildRequest(a: {
    messages: Message[];
    config: ResolvedConfig;
    system?: string;
    apiKey: string;
  }): { url: string; headers: Record<string, string>; body: unknown } {
    const { messages, config, system, apiKey } = a;
    const requestBody: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens,
      stream: true,
      messages,
    };
    if (system) {
      // Gate caching on the model's minimum cacheable-prefix threshold (research sidecar §2).
      const estimatedPrefixTokens = Math.ceil(system.length / 4);
      if (shouldAttachCache(estimatedPrefixTokens, config.model)) {
        requestBody["system"] = [
          { type: "text", text: system, cache_control: { type: "ephemeral", ttl: "1h" } },
        ];
      } else {
        requestBody["system"] = system;
      }
    }
    // Mutual exclusion: thinking and temperature cannot both be present (temp+thinking = 400).
    if (config.thinking) {
      requestBody["thinking"] = config.thinking;
    } else if (config.temperature !== undefined) {
      requestBody["temperature"] = config.temperature;
    }
    const attachedCache = system !== undefined &&
      shouldAttachCache(Math.ceil(system.length / 4), config.model);
    return {
      url: ANTHROPIC_API,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
        ...(attachedCache ? { "anthropic-beta": EXTENDED_CACHE_TTL_BETA } : {}),
      },
      body: requestBody,
    };
  }

  /** Parse one SSE line and mutate `state` with usage or return a text delta. */
  private processLine(line: string, state: CanonicalUsage): string | null {
    if (!line.startsWith("data: ")) return null;
    const json = line.slice(6).trim();
    if (!json || json === "[DONE]") return null;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
    const type = event.type as string | undefined;
    if (type === "message_start") {
      const msg = event.message as {
        usage?: {
          input_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      } | undefined;
      state.inputTokens = msg?.usage?.input_tokens ?? 0;
      state.cacheCreationTokens = msg?.usage?.cache_creation_input_tokens ?? 0;
      state.cacheReadTokens = msg?.usage?.cache_read_input_tokens ?? 0;
      return null;
    }
    if (type === "content_block_delta") {
      const delta = event.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") return delta.text;
      return null;
    }
    if (type === "message_delta") {
      const usage = event.usage as { output_tokens?: number } | undefined;
      state.outputTokens = usage?.output_tokens ?? state.outputTokens;
      return null;
    }
    return null;
  }

  async pump(
    upstreamBody: ReadableStream<Uint8Array>,
    writeToken: (text: string) => Promise<void>,
  ): Promise<CanonicalUsage> {
    const reader = upstreamBody.getReader();
    const decoder = new TextDecoder();
    const state: CanonicalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const text = this.processLine(line, state);
        if (text !== null) await writeToken(text);
      }
    }
    if (buffer.length > 0) {
      const text = this.processLine(buffer, state);
      if (text !== null) await writeToken(text);
    }
    return state;
  }
}
