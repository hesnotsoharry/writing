import { describe, expect, it } from "vitest";

import { estimateRepliesLeft } from "../features/ai/ai.helpers";
import type { ManagedModel } from "../features/ai/ai.types";

describe("estimateRepliesLeft", () => {
  describe("trial balance (150,000 units)", () => {
    it.each<[ManagedModel, number]>([
      ["claude-haiku-4-5-20251001", 150],
      ["claude-sonnet-4-6", 50],
      ["claude-opus-4-8", 30],
      ["gpt-5.4-mini", 185],
      ["gpt-5.4", 55],
      ["gpt-5.5", 27],
    ])("returns %s replies for %s", (model, expected) => {
      expect(estimateRepliesLeft(150000, model)).toBe(expected);
    });
  });

  describe("monthly balance (1,000,000 units)", () => {
    it.each<[ManagedModel, number]>([
      ["claude-haiku-4-5-20251001", 1000],
      ["claude-sonnet-4-6", 333],
      ["claude-opus-4-8", 200],
      ["gpt-5.4-mini", 1234],
      ["gpt-5.4", 370],
      ["gpt-5.5", 185],
    ])("returns %s replies for %s", (model, expected) => {
      expect(estimateRepliesLeft(1000000, model)).toBe(expected);
    });
  });

  describe("edge cases", () => {
    it("returns 0 when balance is zero", () => {
      expect(estimateRepliesLeft(0, "claude-haiku-4-5-20251001")).toBe(0);
    });

    it("returns 0 when balance is negative", () => {
      expect(estimateRepliesLeft(-500, "claude-haiku-4-5-20251001")).toBe(0);
    });

    it("returns 0 when model is unknown", () => {
      expect(estimateRepliesLeft(150000, "not-a-real-model" as ManagedModel)).toBe(0);
    });

    it("returns 0 when balance is Infinity", () => {
      expect(estimateRepliesLeft(Infinity, "claude-haiku-4-5-20251001")).toBe(0);
    });

    it("returns 0 when balance is NaN", () => {
      expect(estimateRepliesLeft(NaN, "claude-haiku-4-5-20251001")).toBe(0);
    });
  });
});
