/**
 * AnthropicAdapter.buildRequest — temperature is only sent to models that accept it.
 *
 * Claude 4.7+ models return a 400 for a non-default temperature on API version
 * 2023-06-01, which broke Ask / Beta read (temperature 0.7) whenever a writer picked
 * Sonnet 5, Opus 5, Fable 5 or Opus 4.8. Those requests must omit the parameter.
 */
import { describe, expect, it } from "vitest";

import type { StandardVerbConfig } from "../verb-config";
import { AnthropicAdapter } from "./anthropic";

const adapter = new AnthropicAdapter();
const messages = [{ role: "user" as const, content: "Hello" }];

function bodyFor(model: string, temperature = 0.7): Record<string, unknown> {
  const config: StandardVerbConfig = { model, maxTokens: 2048, temperature };
  return adapter.buildRequest({ messages, config, apiKey: "test-key" }).body as Record<string, unknown>;
}

describe("AnthropicAdapter.buildRequest — temperature support per model", () => {
  it.each(["claude-haiku-4-5-20251001", "claude-sonnet-4-6"])(
    "keeps temperature for %s, which still accepts it",
    (model) => {
      expect(bodyFor(model)["temperature"]).toBe(0.7);
    },
  );

  it.each(["claude-sonnet-5", "claude-opus-5", "claude-fable-5", "claude-opus-4-8"])(
    "omits temperature for %s (4.7+ rejects a non-default value)",
    (model) => {
      expect(bodyFor(model)).not.toHaveProperty("temperature");
    },
  );

  it("omits temperature for a model not on the allowlist (new models fail safe)", () => {
    expect(bodyFor("claude-some-future-model", 0.1)).not.toHaveProperty("temperature");
  });
});
