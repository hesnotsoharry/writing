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

import { REASONING_HEADROOM_TOKENS, resolveMaxTokens } from "../effort";
import type { StandardVerbConfig } from "../verb-config";
import { VERB_CONFIG } from "../verb-config";
import { resolveModelConfig } from "../../api/ai/chat";
import { AnthropicAdapter } from "./anthropic";
import { OpenAIAdapter } from "./openai";

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

  // Anthropic thinking also draws from max_tokens, but `medium` reduces thinking against
  // the implicit `high` these models already ran at — so no headroom, and no reserve
  // inflation for a problem that does not exist on this provider.
  it("does not add reasoning headroom to an Anthropic model's budget", () => {
    expect(resolveMaxTokens("claude-sonnet-5", 2048)).toBe(2048);
    expect(resolveMaxTokens("claude-opus-5", 2048)).toBe(2048);
  });
});

describe("OpenAIAdapter.buildRequest — effort policy", () => {
  const openai = new OpenAIAdapter();

  function openAiBody(model: string): Record<string, unknown> {
    const { body } = openai.buildRequest({
      messages,
      config: configFor(model),
      system: undefined,
      apiKey: API_KEY,
    });
    return body as Record<string, unknown>;
  }

  it.each(["gpt-5.4-mini", "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"])(
    "sends reasoning_effort 'medium' for %s",
    (model) => {
      expect(openAiBody(model)["reasoning_effort"]).toBe("medium");
    },
  );

  // OpenAI rejects a non-default temperature once reasoning is active — the two can
  // never both be sent, so the effort policy must displace the verb's temperature.
  it("omits temperature when a reasoning effort is active (would 400 alongside it)", () => {
    const body = openAiBody("gpt-5.6-terra");
    expect(body["reasoning_effort"]).toBe("medium");
    expect(body).not.toHaveProperty("temperature");
  });

  // Legacy GPT models keep reasoning_effort 'none' + temperature — the behaviour every
  // existing user of those models has already been getting.
  it.each(["gpt-5.4", "gpt-5.5"])(
    "keeps legacy %s on reasoning_effort 'none' with temperature intact",
    (model) => {
      const body = openAiBody(model);
      expect(body["reasoning_effort"]).toBe("none");
      expect(body["temperature"]).toBe(1.0);
    },
  );
});

describe("reasoning headroom — output budget vs credit reserve", () => {
  // On OpenAI, reasoning tokens come out of max_completion_tokens, the same budget the
  // visible reply uses. Without headroom a 2048-cap verb can spend its budget thinking
  // and return an empty message with finish_reason 'length'.
  it.each(["gpt-5.4-mini", "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"])(
    "grants %s reasoning headroom on top of the verb cap",
    (model) => {
      expect(resolveMaxTokens(model, 2048)).toBe(2048 + REASONING_HEADROOM_TOKENS);
    },
  );

  it("grants no headroom to legacy GPT models (no reasoning effort applied)", () => {
    expect(resolveMaxTokens("gpt-5.4", 2048)).toBe(2048);
    expect(resolveMaxTokens("gpt-5.5", 2048)).toBe(2048);
  });

  // The headroom must reach the reserve, not just the wire request. resolveModelConfig is
  // the single chokepoint: the handler sizes the reserve from the config it returns, so if
  // these two ever diverge the operator silently eats the shortfall on every GPT request.
  it("resolveModelConfig returns the headroomed budget so the reserve matches the request", () => {
    const r = resolveModelConfig("brainstorm", VERB_CONFIG.brainstorm, "gpt-5.6-terra");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.maxTokens).toBe(VERB_CONFIG.brainstorm.maxTokens + REASONING_HEADROOM_TOKENS);
    }
  });

  it("resolveModelConfig leaves the verb budget untouched for a non-reasoning model", () => {
    const r = resolveModelConfig("brainstorm", VERB_CONFIG.brainstorm, "gpt-5.4");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.maxTokens).toBe(VERB_CONFIG.brainstorm.maxTokens);
  });

  // proofread is Haiku-locked and Haiku carries no effort — its budget must not move.
  it("leaves the proofread budget untouched (Haiku-locked, no effort)", () => {
    const r = resolveModelConfig("proofread", VERB_CONFIG.proofread, "gpt-5.6-sol");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.maxTokens).toBe(VERB_CONFIG.proofread.maxTokens);
  });
});
