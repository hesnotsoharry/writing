/**
 * Tests for applyHouseStyle — the W42 house-style composition function.
 *
 * Contracts verified:
 * - null config appends HOUSE_STYLE_BLOCK after SHARED_PRINCIPLES
 * - system without SHARED_PRINCIPLES anchor is returned unchanged (defensive no-op)
 * - enabled:false suppresses the block (SHARED_PRINCIPLES stays, block not appended)
 * - whitespace-only block is treated as empty (no append)
 * - $& / $` / $' in block content appear verbatim — no regex expansion [$-pattern safety]
 * - double-applying is a no-op (idempotent)
 * - perModelAddenda reached when model arg matches; absent when no model arg
 */
import { describe, expect, it } from "vitest";

import {
  applyHouseStyle,
  HOUSE_STYLE_BLOCK,
  HOUSE_STYLE_DEFAULT,
  type HouseStyleConfig,
  SHARED_PRINCIPLES,
} from "../features/ai/prompts/shared";

// ── Fixture ───────────────────────────────────────────────────────────────────

/** Representative system prompt that contains SHARED_PRINCIPLES (as all verb builders do). */
const SYSTEM_WITH_PRINCIPLES = `You are a writing assistant.\n${SHARED_PRINCIPLES}\nFocus on the provided excerpt.`;

const SYSTEM_WITHOUT_PRINCIPLES = "You are a writing assistant with no principles block.";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("applyHouseStyle", () => {
  it("null config appends HOUSE_STYLE_BLOCK after SHARED_PRINCIPLES", () => {
    const result = applyHouseStyle(SYSTEM_WITH_PRINCIPLES, null);
    const expected = SHARED_PRINCIPLES + "\n" + HOUSE_STYLE_BLOCK;
    expect(result).toContain(expected);
  });

  it("returns system unchanged when SHARED_PRINCIPLES anchor is absent", () => {
    const result = applyHouseStyle(SYSTEM_WITHOUT_PRINCIPLES, null);
    expect(result).toBe(SYSTEM_WITHOUT_PRINCIPLES);
  });

  it("returns system unchanged when enabled is false (block suppressed)", () => {
    const cfg: HouseStyleConfig = { ...HOUSE_STYLE_DEFAULT, enabled: false };
    const result = applyHouseStyle(SYSTEM_WITH_PRINCIPLES, cfg);
    expect(result).not.toContain(HOUSE_STYLE_BLOCK);
    expect(result).toContain(SHARED_PRINCIPLES);
    expect(result).toBe(SYSTEM_WITH_PRINCIPLES);
  });

  it("treats a whitespace-only block as empty and returns system unchanged", () => {
    const cfg: HouseStyleConfig = { ...HOUSE_STYLE_DEFAULT, block: "   " };
    const result = applyHouseStyle(SYSTEM_WITH_PRINCIPLES, cfg);
    expect(result).toBe(SYSTEM_WITH_PRINCIPLES);
  });

  it("$-pattern safety: $& / $` / $' in block appear verbatim in output", () => {
    const dangerousBlock = "Rules: $& and $` and $' must survive";
    const cfg: HouseStyleConfig = { ...HOUSE_STYLE_DEFAULT, block: dangerousBlock };
    const result = applyHouseStyle(SYSTEM_WITH_PRINCIPLES, cfg);
    expect(result).toContain("$&");
    expect(result).toContain("$`");
    expect(result).toContain("$'");
    expect(result).toContain(dangerousBlock);
  });

  it("idempotency: applying twice yields the same result as applying once", () => {
    const once = applyHouseStyle(SYSTEM_WITH_PRINCIPLES, HOUSE_STYLE_DEFAULT);
    const twice = applyHouseStyle(once, HOUSE_STYLE_DEFAULT);
    expect(twice).toBe(once);
  });

  it("perModelAddendum is appended when model arg matches the key", () => {
    const cfg: HouseStyleConfig = {
      ...HOUSE_STYLE_DEFAULT,
      perModelAddenda: { "claude-sonnet-4-6": "EXTRA" },
    };
    const result = applyHouseStyle(SYSTEM_WITH_PRINCIPLES, cfg, "claude-sonnet-4-6");
    expect(result).toContain("EXTRA");
  });

  it("perModelAddendum is NOT appended when model arg is omitted", () => {
    const cfg: HouseStyleConfig = {
      ...HOUSE_STYLE_DEFAULT,
      perModelAddenda: { "claude-sonnet-4-6": "EXTRA" },
    };
    const result = applyHouseStyle(SYSTEM_WITH_PRINCIPLES, cfg);
    expect(result).not.toContain("EXTRA");
  });
});
