/**
 * AnthropicAdapter.buildRequest — per-model effort policy (output_config.effort).
 *
 * The Claude API defaults to `high` effort when the field is absent, and effort tokens
 * bill as output. So the absence of output_config is not a neutral state — it is the
 * most expensive one. These tests pin which models carry an explicit effort and, just as
 * importantly, which must NOT (Haiku 4.5 does not support the parameter).
 *
 * Roster decision 2026-07-30: Sonnet 5 and Opus 5 run at `medium`.
 */
import { describe, expect, it } from "vitest";

import type { StandardVerbConfig } from "../verb-config";
import { AnthropicAdapter } from "./anthropic";

const adapter = new AnthropicAdapter();
const API_KEY = "test-key";
const messages = [{ role: "user" as const, content: "Hello" }];

function configFor(model: string): StandardVerbConfig {
  return { model, maxTokens: 2048, temperature: 1.0 };
}

function bodyFor(model: string, system?: string): Record<string, unknown> {
  const { body } = adapter.buildRequest({
    messages,
    config: configFor(model),
    system,
    apiKey: API_KEY,
  });
  return body as Record<string, unknown>;
}

describe("AnthropicAdapter.buildRequest — effort policy", () => {
  it("sends effort 'medium' for claude-sonnet-5", () => {
    expect(bodyFor("claude-sonnet-5")["output_config"]).toEqual({ effort: "medium" });
  });

  it("sends effort 'medium' for claude-opus-5", () => {
    expect(bodyFor("claude-opus-5")["output_config"]).toEqual({ effort: "medium" });
  });

  // Haiku 4.5 is absent from the models that accept `effort`. Sending output_config
  // to it risks a 400 on every managed request, since Haiku is the default model AND
  // the un-bypassable model for the proofread verb.
  it("omits output_config for claude-haiku-4-5-20251001 (model does not support effort)", () => {
    expect(bodyFor("claude-haiku-4-5-20251001")).not.toHaveProperty("output_config");
  });

  // Legacy models keep the implicit `high` they have always run with — the roster
  // refresh must not silently change behaviour for a model a user already selected.
  it("omits output_config for legacy claude-sonnet-4-6 (unchanged implicit-high behaviour)", () => {
    expect(bodyFor("claude-sonnet-4-6")).not.toHaveProperty("output_config");
  });

  it("omits output_config for legacy claude-opus-4-8 (unchanged implicit-high behaviour)", () => {
    expect(bodyFor("claude-opus-4-8")).not.toHaveProperty("output_config");
  });

  // Effort is independent of the thinking/temperature mutual exclusion: a standard
  // verb carries a temperature, and effort must ride alongside it rather than replace it.
  it("sends effort alongside temperature on a standard verb config", () => {
    const body = bodyFor("claude-sonnet-5");
    expect(body["temperature"]).toBe(1.0);
    expect(body["output_config"]).toEqual({ effort: "medium" });
  });

  // Effort must stay constant per model or it invalidates the prompt cache. This pins
  // that the two features compose: a cached system block AND an effort setting.
  it("sends effort together with a cache-controlled system block", () => {
    const body = bodyFor("claude-sonnet-5", "A".repeat(5000));
    const systemBlocks = body["system"] as Array<{ cache_control?: unknown }>;
    expect(systemBlocks[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    expect(body["output_config"]).toEqual({ effort: "medium" });
  });
});
