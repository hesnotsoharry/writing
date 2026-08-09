import { describe, expect, it } from "vitest";

import { type GoalLocalState,localCalendarDate, recordGoalDay } from "./goalLocalState";

describe("device-local goal state", () => {
  it("formats an injected instant as a local calendar date", () => {
    expect(localCalendarDate(new Date(2026, 7, 9, 23, 59))).toBe("2026-08-09");
  });

  it("delegates streak math to shared streakLogic and persists locally", async () => {
    const saved: GoalLocalState[] = [];
    const persistence = {
      read: async () => saved.at(-1) ?? null,
      write: async (_id: string, value: GoalLocalState) => { saved.push(value); },
    };
    await recordGoalDay(persistence, "goal", "2026-08-08", true);
    await recordGoalDay(persistence, "goal", "2026-08-09", true);
    expect(saved.at(-1)?.streak).toEqual({ count: 2, lastMetDate: "2026-08-09" });
    expect(saved.at(-1)?.metDays).toEqual(["2026-08-08", "2026-08-09"]);
  });
});
