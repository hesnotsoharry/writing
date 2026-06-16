/**
 * Unit tests for createAdapter() — exercises the adapter against a fake ProviderTransport.
 *
 * Tests: complete() mapping, stream() token forwarding, error propagation,
 * partial-usage passthrough (A4), and stop-reason normalization (A3/A1b).
 * Also: NodeSdkTransport lazy-construction regression guard (empty key must not throw).
 *
 * No live API calls. The fake transport is the boundary — the adapter itself is real.
 * Node test environment (default for this project; no jsdom needed).
 */

import { describe, expect, it } from "vitest";

import { createAdapter } from "../features/ai/adapter";
import { NodeSdkTransport } from "../features/ai/adapter/node.transport";
import { ProviderAdapterError, type ProviderTransport, type WireRequest, type WireResponse } from "../features/ai/adapter/types";

// ── Fake transport factory ────────────────────────────────────────────────────

const DEFAULT_WIRE_RESPONSE: WireResponse = {
  text: "test response",
  inputTokens: 10,
  outputTokens: 5,
  model: "test-model",
  stopReason: "end_turn",
};

function makeFakeTransport(overrides?: Partial<ProviderTransport>): ProviderTransport {
  return {
    complete: async (): Promise<WireResponse> => DEFAULT_WIRE_RESPONSE,
    stream: async (
      req: WireRequest,
      onToken: (text: string) => void,
    ): Promise<WireResponse> => {
      onToken("hello ");
      onToken("world");
      return { ...DEFAULT_WIRE_RESPONSE, text: "hello world", stopReason: "stop" };
    },
    ...overrides,
  };
}

const CALL_PARAMS = {
  modelId: "claude-haiku-4-5-20251001",
  system: "You are a writing assistant.",
  messages: [{ role: "user" as const, content: "Write a haiku." }],
  maxTokens: 1024,
  temperature: 0.3,
};

// ── complete() ────────────────────────────────────────────────────────────────

describe("createAdapter — complete()", () => {
  it("returns AdapterResult with text and usage from WireResponse", async () => {
    const adapter = createAdapter(makeFakeTransport());
    const result = await adapter.complete(CALL_PARAMS);
    expect(result.text).toBe("test response");
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
    expect(result.model).toBe("test-model");
  });

  it("normalizes Anthropic end_turn → stopReason 'end_turn'", async () => {
    const adapter = createAdapter(makeFakeTransport());
    const result = await adapter.complete(CALL_PARAMS);
    expect(result.stopReason).toBe("end_turn");
  });

  it("normalizes OpenAI 'length' → stopReason 'max_tokens'", async () => {
    const transport = makeFakeTransport({
      complete: async () => ({ ...DEFAULT_WIRE_RESPONSE, stopReason: "length" }),
    });
    const result = await createAdapter(transport).complete(CALL_PARAMS);
    expect(result.stopReason).toBe("max_tokens");
  });

  it("maps Anthropic pause_turn → stopReason 'other' (never end_turn, per A3)", async () => {
    const transport = makeFakeTransport({
      complete: async () => ({ ...DEFAULT_WIRE_RESPONSE, stopReason: "pause_turn" }),
    });
    const result = await createAdapter(transport).complete(CALL_PARAMS);
    expect(result.stopReason).toBe("other");
  });

  it("throws ProviderAdapterError when transport throws", async () => {
    const transport = makeFakeTransport({
      complete: async () => {
        throw new ProviderAdapterError({
          code: "rate-limit",
          message: "429 Too Many Requests",
          retryable: true,
        });
      },
    });
    await expect(createAdapter(transport).complete(CALL_PARAMS)).rejects.toThrow(
      ProviderAdapterError,
    );
  });

  it("ProviderAdapterError.normalized.partialUsage passes through unchanged (A4)", async () => {
    const partialUsage = { inputTokens: 7, outputTokens: 3, cacheReadTokens: 2 };
    const transport = makeFakeTransport({
      complete: async () => {
        throw new ProviderAdapterError({
          code: "overloaded",
          message: "529 Overloaded",
          retryable: true,
          partialUsage,
        });
      },
    });
    let caught: ProviderAdapterError | undefined;
    try {
      await createAdapter(transport).complete(CALL_PARAMS);
    } catch (e) {
      if (e instanceof ProviderAdapterError) caught = e;
    }
    expect(caught?.normalized.code).toBe("overloaded");
    expect(caught?.normalized.partialUsage?.inputTokens).toBe(7);
    expect(caught?.normalized.partialUsage?.cacheReadTokens).toBe(2);
  });
});

// ── stream() ─────────────────────────────────────────────────────────────────

describe("createAdapter — stream()", () => {
  it("forwards tokens to onToken in order and resolves with full text", async () => {
    const tokens: string[] = [];
    const result = await createAdapter(makeFakeTransport()).stream(
      CALL_PARAMS,
      (t) => tokens.push(t),
    );
    expect(tokens).toEqual(["hello ", "world"]);
    expect(result.text).toBe("hello world");
  });

  it("normalizes OpenAI 'stop' → stopReason 'end_turn'", async () => {
    const result = await createAdapter(makeFakeTransport()).stream(CALL_PARAMS, () => {});
    expect(result.stopReason).toBe("end_turn");
  });

  it("resolves with usage from WireResponse", async () => {
    const result = await createAdapter(makeFakeTransport()).stream(CALL_PARAMS, () => {});
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
  });

  it("ProviderAdapterError.normalized.partialText passes through from a failed stream (A4)", async () => {
    const transport = makeFakeTransport({
      stream: async (_req, onToken) => {
        onToken("partial");
        throw new ProviderAdapterError({
          code: "network",
          message: "Connection lost",
          retryable: true,
          partialText: "partial",
        });
      },
    });
    let caught: ProviderAdapterError | undefined;
    try {
      await createAdapter(transport).stream(CALL_PARAMS, () => {});
    } catch (e) {
      if (e instanceof ProviderAdapterError) caught = e;
    }
    expect(caught?.normalized.code).toBe("network");
    expect(caught?.normalized.partialText).toBe("partial");
  });
});

// ── NodeSdkTransport — lazy construction regression guard ─────────────────────

describe("NodeSdkTransport — lazy construction", () => {
  it("does not throw when openaiKey or openrouterKey is empty string", () => {
    // Regression guard: before the lazy-construction fix, the OpenAI SDK threw
    // OpenAIError: Missing credentials at new OpenAI({ apiKey: "" }) during the
    // NodeSdkTransport constructor — crashing runs that only used Anthropic.
    expect(
      () => new NodeSdkTransport({ anthropicKey: "k", openaiKey: "", openrouterKey: "" }),
    ).not.toThrow();
  });

  it("does not throw when all keys are empty strings", () => {
    expect(
      () => new NodeSdkTransport({ anthropicKey: "", openaiKey: "", openrouterKey: "" }),
    ).not.toThrow();
  });
});
