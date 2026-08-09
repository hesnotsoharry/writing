import { describe, expect, it } from "vitest";

import { AI_MODEL_ORDER, MODEL_RATES, TYPICAL_REQUEST } from "../../shared/aiCatalog";
import {
  estimateReplies, groupModels, parseLimitReason, presentBalance,
} from "./aiLogic";
import type { NormalizedEvent } from "./mobileAiClient";

describe("managed AI economics", () => {
  it("derives distinct denominators from live subscription and trial allowances", () => {
    const subscription = presentBalance({
      creditsBalance: 500_000, monthlyAllowance: 1_000_000,
      resetAt: "", status: "active",
    });
    const trial = presentBalance({
      creditsBalance: 50_000, monthlyAllowance: 150_000,
      resetAt: "", status: "trial",
    });
    expect(subscription.allowance).toBe(1_000_000);
    expect(trial.allowance).toBe(150_000);
    expect(subscription.remainingFraction).not.toBe(trial.remainingFraction);
  });

  it("estimates replies from MODEL_RATES for current and legacy models", () => {
    const balance = 100_000;
    const current = "claude-haiku-4-5-20251001" as const;
    const legacy = "gpt-5.4" as const;
    const expected = (model: typeof current | typeof legacy) => Math.floor(balance /
      (TYPICAL_REQUEST.inputTokens * MODEL_RATES[model].input
        + TYPICAL_REQUEST.outputTokens * MODEL_RATES[model].output));
    expect(estimateReplies(balance, current)).toBe(expected(current));
    expect(estimateReplies(balance, legacy)).toBe(expected(legacy));
  });

  it("groups models in catalog order with every legacy model dimmable at the bottom", () => {
    const groups = groupModels(1_000_000);
    const flattened = [...groups.standard, ...groups.premium, ...groups.superseded];
    const legacyIds = AI_MODEL_ORDER.filter((id) => groups.superseded.some((item) => item.id === id));
    expect(flattened).toHaveLength(AI_MODEL_ORDER.length);
    expect(groups.superseded.map((item) => item.id)).toEqual(legacyIds);
    expect(groups.superseded.every((item) => item.legacy)).toBe(true);
    expect([...groups.standard, ...groups.premium].every((item) => !item.legacy)).toBe(true);
  });
});

describe("limit state parsing", () => {
  it("uses normalized client event shapes", () => {
    const refusal: NormalizedEvent = { type: "content-blocked" };
    const exhausted: NormalizedEvent = { type: "credits-exhausted", resetAt: "later" };
    const other: NormalizedEvent = { type: "error", message: "no" };
    expect(parseLimitReason(refusal)).toBe("managed-refusal");
    expect(parseLimitReason(exhausted)).toBe("out-of-credit");
    expect(parseLimitReason(other)).toBeNull();
  });
});
