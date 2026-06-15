/**
 * W48 P3 — AnthropicAdapter.buildRequest: 1h cache TTL + beta header.
 *
 * Asserts that when a system string is long enough to clear the model's
 * cache floor, buildRequest attaches:
 *   (a) cache_control = { type: "ephemeral", ttl: "1h" } on the system block
 *   (b) headers["anthropic-beta"] === "extended-cache-ttl-2025-04-11"
 *
 * Uses a Sonnet config (floor: 1024 tokens = ~4096 chars); the system string
 * is 5000 chars — well above the floor.
 */
import { describe, expect, it } from "vitest";

import type { StandardVerbConfig } from "../verb-config";
import { AnthropicAdapter } from "./anthropic";

const adapter = new AnthropicAdapter();
const API_KEY = "test-key";

const sonnetConfig: StandardVerbConfig = {
  model: "claude-sonnet-4-6",
  maxTokens: 2048,
  temperature: 1.0,
};

// 5000 chars — clears Sonnet's 1024-token (4096-char) cache floor.
const LONG_SYSTEM = "A".repeat(5000);

const messages = [{ role: "user" as const, content: "Hello" }];

describe("AnthropicAdapter.buildRequest — 1h cache TTL (W48 P3)", () => {
  it("attaches cache_control { type:'ephemeral', ttl:'1h' } when system clears the cache floor", () => {
    const { body } = adapter.buildRequest({
      messages,
      config: sonnetConfig,
      system: LONG_SYSTEM,
      apiKey: API_KEY,
    });
    const b = body as Record<string, unknown>;
    const systemBlocks = b["system"] as Array<{ cache_control?: unknown }>;
    expect(systemBlocks[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("sets anthropic-beta header to 'extended-cache-ttl-2025-04-11' when system clears the cache floor", () => {
    const { headers } = adapter.buildRequest({
      messages,
      config: sonnetConfig,
      system: LONG_SYSTEM,
      apiKey: API_KEY,
    });
    expect(headers["anthropic-beta"]).toBe("extended-cache-ttl-2025-04-11");
  });

  it("does NOT set anthropic-beta when system is absent", () => {
    const { headers } = adapter.buildRequest({
      messages,
      config: sonnetConfig,
      apiKey: API_KEY,
    });
    expect(headers["anthropic-beta"]).toBeUndefined();
  });

  it("does NOT set anthropic-beta when system is too short to clear the cache floor", () => {
    // 100 chars ≈ 25 tokens — below Sonnet's 1024-token floor.
    const { headers } = adapter.buildRequest({
      messages,
      config: sonnetConfig,
      system: "A".repeat(100),
      apiKey: API_KEY,
    });
    expect(headers["anthropic-beta"]).toBeUndefined();
  });

  it("header and cache_control body form move together (header iff array system block)", () => {
    // Long system: ARRAY body form (cache_control attached) AND beta header present.
    const long = adapter.buildRequest({
      messages,
      config: sonnetConfig,
      system: LONG_SYSTEM,
      apiKey: API_KEY,
    });
    expect(Array.isArray((long.body as Record<string, unknown>)["system"])).toBe(true);
    expect(long.headers["anthropic-beta"]).toBe("extended-cache-ttl-2025-04-11");

    // Short system: PLAIN-STRING body form (no cache_control) AND no beta header.
    // The two sides must never diverge — a ttl:"1h" block without the beta header 400s.
    const short = adapter.buildRequest({
      messages,
      config: sonnetConfig,
      system: "A".repeat(100),
      apiKey: API_KEY,
    });
    expect(typeof (short.body as Record<string, unknown>)["system"]).toBe("string");
    expect(short.headers["anthropic-beta"]).toBeUndefined();
  });
});
