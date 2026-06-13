/**
 * Unit tests for VERB_CONFIG invariants.
 *
 * Contract under test:
 *   - No VERB_CONFIG entry has both `thinking` and `temperature` defined — sending
 *     both to the Anthropic API returns 400 (research sidecar §8: temp+thinking = 400).
 *   - The TypeScript type system enforces this at compile time via `temperature?: never`
 *     on ThinkingVerbConfig; this test is the runtime regression gate.
 */
import { describe, expect, it } from "vitest";

import { VERB_CONFIG } from "./verb-config";

describe("VERB_CONFIG mutual exclusion invariant (thinking + temperature)", () => {
  it("no entry has both thinking and temperature defined", () => {
    Object.entries(VERB_CONFIG).forEach(([verb, config]) => {
      const raw = config as unknown as Record<string, unknown>;
      const hasThinking = raw["thinking"] !== undefined;
      const hasTemperature = raw["temperature"] !== undefined;
      if (hasThinking && hasTemperature) {
        throw new Error(
          `VERB_CONFIG['${verb}'] has both thinking and temperature — violates temp+thinking=400 invariant`,
        );
      }
      expect(hasThinking && hasTemperature).toBe(false);
    });
  });
});
