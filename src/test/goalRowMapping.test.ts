import { describe, expect, it } from "vitest";

import type { Goal } from "../db/goalsStore";
import type { GoalRecord } from "../features/goals/goalModel";
import { goalConfigForRow, goalRecordFromRow } from "../features/goals/goalRowMapping";

/**
 * goalRowMapping — round-trip contract between the `goals` table row and the
 * desktop GoalRecord UI model. Problem B item 3: before this module, both
 * desktop readers reduced a row to `{ id, type, words: target }`, so a
 * mobile-created streak goal rendered as an empty "Not started yet" and a
 * deadline goal had no date. mobile/src/features/goals/newGoalModel.ts is the
 * read-only reference for the config_json shape mobile writes.
 */

function row(overrides: Partial<Goal>): Goal {
  return {
    id: "g1", project_id: "p1", goal_type: "daily", target: 500,
    enabled: true, created_at: 0, config_json: "{}", ...overrides,
  };
}

describe("goalRecordFromRow", () => {
  it("amount family: reads words from config_json, falls back to target when absent", () => {
    expect(goalRecordFromRow(row({ goal_type: "daily", target: 750, config_json: "{}" })))
      .toMatchObject({ type: "daily", words: 750 });
    expect(goalRecordFromRow(row({ goal_type: "daily", target: 500, config_json: JSON.stringify({ words: 800 }) })))
      .toMatchObject({ type: "daily", words: 800 });
  });

  it("amount family (minutes unit): reads minutes, not words, for the time type", () => {
    const g = goalRecordFromRow(row({ goal_type: "time", target: 30, config_json: JSON.stringify({ minutes: 45 }) }));
    expect(g).toMatchObject({ type: "time", minutes: 45 });
    expect(g.words).toBeUndefined();
  });

  it("deadline family: reads finalWords/date/startWords/startDate from config_json — mobile-created goal renders meaningfully", () => {
    const config = { finalWords: 90_000, date: "2026-12-01", startWords: 12_000, startDate: "2026-06-01" };
    const g = goalRecordFromRow(row({ goal_type: "deadline", target: 90_000, config_json: JSON.stringify(config) }));
    expect(g).toMatchObject({ type: "deadline", ...config });
  });

  it("deadline family falls back to the target column for finalWords when config_json is empty (legacy row)", () => {
    const g = goalRecordFromRow(row({ goal_type: "deadline", target: 60_000, config_json: "{}" }));
    expect(g.finalWords).toBe(60_000);
    expect(g.date).toBeUndefined();
  });

  it("streak family: reads milestone/qualifies/qualifyAmount/countDaysOff — the mobile-created streak fix", () => {
    const config = { milestone: 30, qualifies: "time", qualifyAmount: 20, countDaysOff: true };
    const g = goalRecordFromRow(row({ goal_type: "streak", target: 30, config_json: JSON.stringify(config) }));
    expect(g).toMatchObject({ type: "streak", milestone: 30, qualifies: "time", qualifyAmount: 20, countDaysOff: true });
  });

  it("streak family device-local counters (streakDays/best/week) are never read from config_json", () => {
    const config = { milestone: 30, streakDays: 999, best: 999, week: [true, true, true, true, true, true, true] };
    const g = goalRecordFromRow(row({ goal_type: "streak", target: 30, config_json: JSON.stringify(config) }));
    expect(g.streakDays).toBeUndefined();
    expect(g.best).toBeUndefined();
    expect(g.week).toBeUndefined();
  });

  it("carries enabled through, tolerating a raw 0/1", () => {
    expect(goalRecordFromRow(row({ enabled: true }))).toMatchObject({ enabled: true });
    expect(goalRecordFromRow(row({ enabled: false }))).toMatchObject({ enabled: false });
    expect(goalRecordFromRow(row({ enabled: 1 as unknown as boolean }))).toMatchObject({ enabled: true });
    expect(goalRecordFromRow(row({ enabled: 0 as unknown as boolean }))).toMatchObject({ enabled: false });
  });

  it("tolerates malformed config_json by falling back to the target column", () => {
    const g = goalRecordFromRow(row({ goal_type: "daily", target: 500, config_json: "not json" }));
    expect(g).toMatchObject({ type: "daily", words: 500 });
  });

  it("tolerates a missing config_json (undefined) — legacy pre-migration row", () => {
    const g = goalRecordFromRow(row({ goal_type: "daily", target: 500, config_json: undefined }));
    expect(g).toMatchObject({ type: "daily", words: 500 });
  });
});

describe("goalConfigForRow — write side, the inverse of goalRecordFromRow", () => {
  it("strips id/type/enabled and the device-local streak counters", () => {
    const g: GoalRecord = {
      id: "g1", type: "streak", milestone: 30, qualifies: "any", enabled: true,
      streakDays: 5, best: 10, week: [true, false, true, false, true, false, true],
    };
    expect(goalConfigForRow(g)).toEqual({ milestone: 30, qualifies: "any" });
  });

  it("round-trips a deadline goal through write then read", () => {
    const g: GoalRecord = {
      id: "g1", type: "deadline", finalWords: 80_000, date: "2026-11-01",
      startWords: 1_000, startDate: "2026-01-01", enabled: true,
    };
    const configJson = JSON.stringify(goalConfigForRow(g));
    const back = goalRecordFromRow(row({ goal_type: "deadline", target: 80_000, config_json: configJson }));
    expect(back).toMatchObject({
      type: "deadline", finalWords: 80_000, date: "2026-11-01",
      startWords: 1_000, startDate: "2026-01-01",
    });
  });
});
