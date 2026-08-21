import { describe, expect, it } from "vitest";

import { GOAL_TYPES, type GoalTypeId } from "../../shared/goalTypes";
import { goalCardKind, type GoalDefinition, localProgress, progressFor, remainderCopy } from "./goalModel";
import { goalWrite, makeDraft, targetSectionFor } from "./newGoalModel";

function goal(type: GoalTypeId, target: number, config: Record<string, unknown> = {}): GoalDefinition {
  return { id: type, type, target, enabled: true, config };
}

describe("goal progress copy", () => {
  it("derives daily progress from the persisted manuscript baseline", () => {
    const state = {
      baseline: 1_000, metDays: [], streak: { count: 0, lastMetDate: "" },
      sessionStartedAt: null, sessionWords: 0,
    };
    expect(localProgress(goal("daily", 250), state, 1_075)).toBe(75);
    expect(localProgress(goal("daily", 250), state, 900)).toBe(0);
  });

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

describe("new goal create path", () => {
  it("emits an enabled upsert payload with a finite target for every type", () => {
    for (const { id } of GOAL_TYPES) {
      const write = goalWrite(id, makeDraft(id, 12_000), 12_000, false);
      expect(write.enabled).toBe(true);
      expect(write.goalType).toBe(id);
      expect(write.target).toBeGreaterThan(0);
      expect(Number.isFinite(write.target)).toBe(true);
      expect(write.config).not.toHaveProperty("id");
      expect(write.config).not.toHaveProperty("type");
    }
  });

  it("keeps the default daily draft at 750 so Save persists a visible amount goal", () => {
    const write = goalWrite("daily", makeDraft("daily", 0), 0, false);
    expect(write).toMatchObject({ goalType: "daily", target: 750, enabled: true });
    expect(write.config.words).toBe(750);
  });

  it("treats a per-session goal as an amount card, not a hidden type", () => {
    expect(goalCardKind("session")).toBe("amount");
    expect(goalCardKind("daily")).toBe("amount");
    expect(goalCardKind("deadline")).toBe("deadline");
    expect(goalCardKind("streak")).toBe("streak");
    const write = goalWrite("session", makeDraft("session", 0), 0, true);
    expect(write).toMatchObject({ goalType: "session", target: 800, enabled: true });
  });
});
