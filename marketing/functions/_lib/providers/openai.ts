/**
 * OpenAIAdapter — Chat Completions (v1/chat/completions) provider for W44.
 *
 * Key decisions (W44 Decisions 2, 3, 5):
 *   - Chat Completions API (not Responses); direct fetch, no SDK.
 *   - system folded into a leading {role:'system'} message (no top-level system param).
 *   - max_completion_tokens (NOT max_tokens — deprecated for GPT-5+ models).
 *   - stream_options:{include_usage:true} required to get a final usage chunk.
 *   - Param mapping: Standard→{reasoning_effort:'none', temperature}; Thinking→effort; Fallback→'none'.
 *   - NO cache_control (OpenAI caches automatically ≥1024 tokens; no write premium).
 *   - #1 billing gate: inputTokens = prompt_tokens − cached_tokens (Decision 3).
 */
import type { CanonicalUsage, Message, ProviderAdapter, ResolvedConfig } from "./types";

// ── State shape (internal) ────────────────────────────────────────────────────

interface OpenAIUsageState {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

// ── OpenAIAdapter ─────────────────────────────────────────────────────────────

export class OpenAIAdapter implements ProviderAdapter {
  readonly provider = "openai" as const;

  buildRequest(a: {
    messages: Message[];
    config: ResolvedConfig;
    system?: string;
    apiKey: string;
  }): { url: string; headers: Record<string, string>; body: unknown } {
    const { messages, config, system, apiKey } = a;

    // Fold system into a leading {role:'system'} message — Chat Completions has no
    // top-level system parameter (unlike Anthropic Messages API).
    const allMessages: Array<{ role: string; content: string }> = [];
    if (system) allMessages.push({ role: "system", content: system });
    allMessages.push(...messages);

    const body: Record<string, unknown> = {
      model: config.model,
      max_completion_tokens: config.maxTokens, // max_tokens is deprecated for GPT-5+ (Decision 5)
      stream: true,
      stream_options: { include_usage: true },  // required for the final usage-bearing chunk
      messages: allMessages,
    };

    // Param mapping (Decision 5): mirror the Anthropic thinking/temperature guard.
    // GPT-5 reasoning models reject temperature while reasoning is active (400).
    if (config.thinking) {
      if (config.thinking.type === "adaptive") {
        body["reasoning_effort"] = config.thinking.effort;
      } else {
        // type:'enabled' → map to 'high' (documented approximation per Decision 5)
        body["reasoning_effort"] = "high";
      }
      // temperature intentionally omitted — would cause 400 alongside reasoning
    } else if (config.temperature !== undefined) {
      // Standard verb: temperature accepted when reasoning_effort:'none'
      body["reasoning_effort"] = "none";
      body["temperature"] = config.temperature;
    } else {
      // FallbackVerbConfig (no temperature, no thinking)
      body["reasoning_effort"] = "none";
    }

    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body,
    };
  }

  /** Parse one SSE line; emit text delta via writeToken; capture usage into state. */
  private async processLine(
    line: string,
    state: OpenAIUsageState,
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
      prompt_tokens_details?: { cached_tokens?: number };
    } | undefined;
    if (usage) {
      state.promptTokens = usage.prompt_tokens ?? 0;
      state.completionTokens = usage.completion_tokens ?? 0;
      state.cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
    }
  }

  async pump(
    upstreamBody: ReadableStream<Uint8Array>,
    writeToken: (text: string) => Promise<void>,
  ): Promise<CanonicalUsage> {
    const reader = upstreamBody.getReader();
    const decoder = new TextDecoder();
    const state: OpenAIUsageState = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 };
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
    // #1 billing gate (Decision 3): OpenAI's prompt_tokens INCLUDES cached_tokens.
    // Subtract before passing to actualCredits or cached input is billed twice.
    // Floor at 0: an off-spec response where cached_tokens > prompt_tokens must never
    // produce a negative inputTokens, which would invert the billing sign.
    return {
      inputTokens: Math.max(0, state.promptTokens - state.cachedTokens),
      outputTokens: state.completionTokens,
      cacheCreationTokens: 0,        // OpenAI has no cache-write bucket
      cacheReadTokens: state.cachedTokens,
    };
  }
}
