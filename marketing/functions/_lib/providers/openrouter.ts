/**
 * OpenRouterAdapter — OpenAI-compatible SSE adapter for OpenRouter (W54 Phase 1).
 *
 * Routes requests to https://openrouter.ai/api/v1/chat/completions.
 * The wire format is OpenAI Chat Completions SSE — identical field names, identical
 * chunking shape — so the pump mirrors OpenAIAdapter exactly.
 *
 * Key decisions (W54 Decision 1):
 *   - OpenRouter primary for GLM-5.2 (~32% cheaper than Z.ai-direct; OpenAI-compatible).
 *   - No thinking/reasoning toggle in v1 (unconfirmed behaviour; deferred to follow-up).
 *   - Cache billing: OpenRouter does NOT surface Anthropic-style cache tokens for GLM.
 *     cacheCreationTokens and cacheReadTokens are always 0; inputTokens = prompt_tokens
 *     (no subtraction required — there is no cached_tokens detail in the usage chunk).
 *   - Optional HTTP-Referer / X-Title attribution headers included for OpenRouter analytics.
 */
import type { CanonicalUsage, Message, ProviderAdapter, ResolvedConfig } from "./types";

// ── State shape (internal) ────────────────────────────────────────────────────

interface OpenRouterUsageState {
  promptTokens: number;
  completionTokens: number;
}

// ── OpenRouterAdapter ─────────────────────────────────────────────────────────

export class OpenRouterAdapter implements ProviderAdapter {
  readonly provider = "openrouter" as const;

  buildRequest(a: {
    messages: Message[];
    config: ResolvedConfig;
    system?: string;
    apiKey: string;
  }): { url: string; headers: Record<string, string>; body: unknown } {
    const { messages, config, system, apiKey } = a;

    // Fold system into a leading {role:'system'} message — OpenRouter Chat Completions
    // uses the same shape as OpenAI (no top-level system parameter).
    const allMessages: Array<{ role: string; content: string }> = [];
    if (system) allMessages.push({ role: "system", content: system });
    allMessages.push(...messages);

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens,   // OpenRouter uses max_tokens (not max_completion_tokens)
      stream: true,
      stream_options: { include_usage: true }, // required for the final usage-bearing chunk
      messages: allMessages,
      // Temperature: pass through when present; omit when thinking config is set.
      // No reasoning_effort / thinking toggle in v1 (W54 Decision 1; unconfirmed via OpenRouter).
    };

    if ("temperature" in config && config.temperature !== undefined) {
      body["temperature"] = config.temperature;
    }

    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // Attribution headers — encouraged by OpenRouter; harmless to include.
        "HTTP-Referer": "https://writersnook.app",
        "X-Title": "WritersNook",
      },
      body,
    };
  }

  /** Parse one SSE line; emit text delta via writeToken; capture usage into state. */
  private async processLine(
    line: string,
    state: OpenRouterUsageState,
    writeToken: (text: string) => Promise<void>,
  ): Promise<void> {
    if (!line.startsWith("data: ")) return;
    const json = line.slice(6).trim();
    if (!json || json === "[DONE]") return;
    let chunk: Record<string, unknown>;
    try {
      chunk = JSON.parse(json) as Record<string, unknown>;
    } catch {
      return;
    }
    // Content delta (non-empty choices array)
    const choices = chunk["choices"] as Array<{ delta?: { content?: unknown } }> | undefined;
    if (choices && choices.length > 0) {
      const content = choices[0]?.delta?.content;
      if (typeof content === "string") await writeToken(content);
    }
    // Final usage chunk (empty choices, populated usage)
    const usage = chunk["usage"] as {
      prompt_tokens?: number;
      completion_tokens?: number;
    } | undefined;
    if (usage) {
      state.promptTokens = usage.prompt_tokens ?? 0;
      state.completionTokens = usage.completion_tokens ?? 0;
    }
  }

  async pump(
    upstreamBody: ReadableStream<Uint8Array>,
    writeToken: (text: string) => Promise<void>,
  ): Promise<CanonicalUsage> {
    const reader = upstreamBody.getReader();
    const decoder = new TextDecoder();
    const state: OpenRouterUsageState = { promptTokens: 0, completionTokens: 0 };
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        await this.processLine(line, state, writeToken);
      }
    }
    if (buffer.length > 0) {
      await this.processLine(buffer, state, writeToken);
    }
    // OpenRouter / GLM does not surface Anthropic-style cache tokens.
    // inputTokens = full prompt_tokens (no cached_tokens subtraction needed).
    // cacheCreationTokens and cacheReadTokens are always 0 for this provider.
    return {
      inputTokens: state.promptTokens,
      outputTokens: state.completionTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
  }
}
