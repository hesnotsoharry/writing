/**
 * W44 Phase B — OpenAIAdapter unit tests.
 *
 * buildRequest contract: Standard config → max_completion_tokens (not max_tokens),
 * reasoning_effort:'none' + temperature, stream_options.include_usage, leading
 * system message, no cache_control. Thinking config → reasoning_effort from
 * effort, temperature absent.
 *
 * pump contract: inputTokens floor at 0 when cached_tokens > prompt_tokens
 * (off-spec API response must not invert billing sign).
 */
import { describe, expect, it } from "vitest";

import type { CanonicalUsage } from "./types";
import type { StandardVerbConfig, ThinkingVerbConfig } from "../verb-config";
import { OpenAIAdapter } from "./openai";

/** Build a ReadableStream<Uint8Array> from a raw SSE wire string. */
function sseStream(raw: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(raw);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function pumpAll(raw: string): Promise<CanonicalUsage> {
  return new OpenAIAdapter().pump(sseStream(raw), async () => {});
}

const adapter = new OpenAIAdapter();
const messages = [{ role: "user" as const, content: "Hello" }];
const API_KEY = "test-key";

const standardConfig: StandardVerbConfig = {
  model: "gpt-5.4",
  maxTokens: 2048,
  temperature: 1.0,
};

describe("OpenAIAdapter.buildRequest — Standard config shape", () => {
  it("uses max_completion_tokens, never max_tokens", () => {
    const { body } = adapter.buildRequest({ messages, config: standardConfig, apiKey: API_KEY });
    const b = body as Record<string, unknown>;
    expect(b["max_completion_tokens"]).toBe(2048);
    expect(b).not.toHaveProperty("max_tokens");
  });

  it("sets reasoning_effort:'none' and temperature for a Standard config", () => {
    const { body } = adapter.buildRequest({ messages, config: standardConfig, apiKey: API_KEY });
    const b = body as Record<string, unknown>;
    expect(b["reasoning_effort"]).toBe("none");
    expect(b["temperature"]).toBe(1.0);
  });

  it("sets stream_options.include_usage to true", () => {
    const { body } = adapter.buildRequest({ messages, config: standardConfig, apiKey: API_KEY });
    const opts = (body as Record<string, unknown>)["stream_options"] as Record<string, unknown>;
    expect(opts["include_usage"]).toBe(true);
  });

  it("prepends a {role:'system'} message when system is given", () => {
    const { body } = adapter.buildRequest({
      messages,
      config: standardConfig,
      system: "You are helpful",
      apiKey: API_KEY,
    });
    const msgs = (body as Record<string, unknown>)["messages"] as Array<{
      role: string;
      content: string;
    }>;
    expect(msgs[0]).toEqual({ role: "system", content: "You are helpful" });
    expect(msgs[1]).toEqual({ role: "user", content: "Hello" });
  });

  it("omits the leading system message when no system is given", () => {
    const { body } = adapter.buildRequest({ messages, config: standardConfig, apiKey: API_KEY });
    const msgs = (body as Record<string, unknown>)["messages"] as Array<{
      role: string;
      content: string;
    }>;
    expect(msgs[0]).toEqual({ role: "user", content: "Hello" });
    expect(msgs.every((m) => m.role !== "system")).toBe(true);
  });

  it("has no cache_control anywhere in the serialized request body", () => {
    const { body } = adapter.buildRequest({
      messages,
      config: standardConfig,
      system: "sys",
      apiKey: API_KEY,
    });
    expect(JSON.stringify(body)).not.toContain("cache_control");
  });
});

describe("OpenAIAdapter.pump — negative-input floor (billing defense)", () => {
  it("clamps inputTokens to 0 when cached_tokens > prompt_tokens (off-spec response)", async () => {
    // prompt_tokens:100 < cached_tokens:150 — would be negative without the floor.
    const wire = [
      'data: {"choices":[],"usage":{"prompt_tokens":100,"completion_tokens":5,"prompt_tokens_details":{"cached_tokens":150}}}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    const usage = await pumpAll(wire);
    expect(usage.inputTokens).toBe(0);          // floor holds — never negative
    expect(usage.cacheReadTokens).toBe(150);    // raw cached value preserved
    expect(usage.outputTokens).toBe(5);
    expect(usage.cacheCreationTokens).toBe(0);
  });
});

describe("OpenAIAdapter.buildRequest — Thinking config shape", () => {
  it("sets reasoning_effort from adaptive effort and omits temperature", () => {
    const thinkingConfig: ThinkingVerbConfig = {
      model: "gpt-5.4",
      maxTokens: 4096,
      thinking: { type: "adaptive", effort: "high" },
    };
    const { body } = adapter.buildRequest({ messages, config: thinkingConfig, apiKey: API_KEY });
    const b = body as Record<string, unknown>;
    expect(b["reasoning_effort"]).toBe("high");
    expect(b).not.toHaveProperty("temperature");
  });

  it("maps {type:'enabled'} thinking to reasoning_effort:'high' and omits temperature", () => {
    const thinkingConfig: ThinkingVerbConfig = {
      model: "gpt-5.4",
      maxTokens: 4096,
      thinking: { type: "enabled", budget_tokens: 1024 },
    };
    const { body } = adapter.buildRequest({ messages, config: thinkingConfig, apiKey: API_KEY });
    const b = body as Record<string, unknown>;
    expect(b["reasoning_effort"]).toBe("high");
    expect(b).not.toHaveProperty("temperature");
  });
});
