import { describe, expect, it } from "vitest";

import type { GoalTypeId } from "../../shared/goalTypes";
import { type GoalDefinition,progressFor, remainderCopy } from "./goalModel";
import { targetSectionFor } from "./newGoalModel";

function goal(type: GoalTypeId, target: number, config: Record<string, unknown> = {}): GoalDefinition {
  return { id: type, type, target, enabled: true, config };
}

describe("goal progress copy", () => {
  it.each([
    ["daily", 750, 612, "138 words to go."], ["session", 800, 200, "600 words to go."],
    ["project", 90_000, 41_208, "48,792 words to go."], ["time", 30, 18, "12 minutes to go."],
  ] as const)("formats %s remainder", (type, target, current, copy) => {
    expect(remainderCopy(goal(type, target), { current })).toBe(copy);
    expect(progressFor(goal(type, target), { current }).family).toBe("amount");
  });

  it("formats deadline and streak families", () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 10);
    const start = new Date(); start.setDate(start.getDate() - 10);
    const deadline = goal("deadline", 90_000, { date: tomorrow.toLocaleDateString("sv"), startDate: start.toLocaleDateString("sv"), startWords: 30_000 });
    expect(remainderCopy(deadline, { current: 60_000 })).toMatch(/words a day keeps you on pace\.$/);
    expect(remainderCopy(goal("streak", 30, { milestone: 30 }), { current: 0, streakDays: 14 })).toBe("14-day streak · 16 to your milestone.");
  });

  it("distinguishes met and overshot goals", () => {
    expect(remainderCopy(goal("daily", 750), { current: 750 })).toBe("Goal met — 750 words.");
    expect(remainderCopy(goal("daily", 750), { current: 900 })).toBe("150 words beyond your goal.");
  });
});

describe("new goal target sections", () => {
  it.each([
    ["daily", "amount", [250, 500, 750, 1_000, 2_000], true],
    ["session", "amount", [250, 500, 800, 1_000, 2_000], false],
    ["project", "amount", [50_000, 80_000, 90_000, 100_000, 120_000], false],
    ["deadline", "deadline", [50_000, 80_000, 90_000, 100_000, 120_000], true],
    ["time", "amount", [15, 30, 45, 60, 90], false],
    ["streak", "streak", [7, 14, 30, 60, 100], true],
  ] as const)("uses real controls and presets for %s", (type, family, presets, daysOff) => {
    const section = targetSectionFor(type);
    expect(section.family).toBe(family); expect(section.presets).toEqual(presets); expect(section.showCountDaysOff).toBe(daysOff);
    expect(section.showDate).toBe(type === "deadline"); expect(section.showQualifiers).toBe(type === "streak");
  });
});
