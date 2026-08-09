import { makeSqlJsDb, type SqlJsTestDb } from "@writersnook/test/support/sqljsDb";
import { beforeEach, describe, expect, it } from "vitest";

import { recordGoalDay } from "../features/goals/goalLocalState";
import { type GoalDefinition, localProgress } from "../features/goals/goalModel";
import { runMigrations } from "../shared/migrations";
import { MobileGoalLocalStateStore } from "./mobileGoalLocalStateStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

let db: SqlJsTestDb;

const dailyGoal: GoalDefinition = {
  id: "daily", type: "daily", target: 250, enabled: true, config: {},
};

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
});

describe("durable device-local goal state", () => {
  it("round-trips every field and survives a store restart", async () => {
    const state = {
      baseline: 123, baselineDate: "2026-08-09", metDays: ["2026-08-08"],
      streak: { count: 4, lastMetDate: "2026-08-08" },
      sessionStartedAt: 42, sessionWords: 88,
    };
    await new MobileGoalLocalStateStore(db).write("goal-1", state);
    expect(await new MobileGoalLocalStateStore(db).read("goal-1")).toEqual(state);
  });

  it("keeps a daily baseline on the same local day", async () => {
    const store = new MobileGoalLocalStateStore(db);
    await store.ensure("daily", 100, "2026-08-09");
    const state = await store.ensure("daily", 175, "2026-08-09");
    expect(state).toMatchObject({
      baseline: 100, baselineDate: "2026-08-09",
    });
    expect(localProgress(dailyGoal, state, 175)).toBe(75);
  });

  it("re-arms a daily baseline when the local day changes", async () => {
    const store = new MobileGoalLocalStateStore(db);
    await store.ensure("daily", 100, "2026-08-09");
    const state = await store.ensure("daily", 175, "2026-08-10");
    expect(state).toMatchObject({
      baseline: 175, baselineDate: "2026-08-10",
    });
    expect(localProgress(dailyGoal, state, 175)).toBe(0);
  });

  it("re-arms a legacy record that has no baseline date", async () => {
    const legacy = {
      baseline: 100, metDays: [], streak: { count: 0, lastMetDate: "" },
      sessionStartedAt: null, sessionWords: 0,
    };
    await db.execute(
      "INSERT INTO app_meta (key, value) VALUES (?, ?)",
      ["goal_local_state:daily", JSON.stringify(legacy)],
    );
    const store = new MobileGoalLocalStateStore(db);
    expect(await store.read("daily")).toEqual(legacy);
    const state = await store.ensure("daily", 175, "2026-08-10");
    expect(state).toMatchObject({ baseline: 175, baselineDate: "2026-08-10" });
  });

  it("preserves streak and met-day bookkeeping across rollover", async () => {
    const store = new MobileGoalLocalStateStore(db);
    await store.write("daily", {
      baseline: 100, baselineDate: "2026-08-09", metDays: ["2026-08-09"],
      streak: { count: 4, lastMetDate: "2026-08-09" },
      sessionStartedAt: null, sessionWords: 0,
    });
    const rolled = await store.ensure("daily", 175, "2026-08-10");
    expect(rolled).toMatchObject({
      metDays: ["2026-08-09"], streak: { count: 4, lastMetDate: "2026-08-09" },
    });
    expect(await recordGoalDay(store, "daily", "2026-08-10", true)).toMatchObject({
      metDays: ["2026-08-09", "2026-08-10"],
      streak: { count: 5, lastMetDate: "2026-08-10" },
    });
  });

  it("never emits a synced-domain write", async () => {
    const writes: unknown[] = [];
    const unsubscribe = mobileLocalWrites.subscribe((write) => writes.push(write));
    await new MobileGoalLocalStateStore(db).write("goal-1", {
      baseline: 1, metDays: [], streak: { count: 0, lastMetDate: "" },
      sessionStartedAt: null, sessionWords: 0,
    });
    unsubscribe();
    expect(writes).toEqual([]);
    expect(await db.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM sync_lww_rows WHERE row_id = 'goal-1'",
    )).toEqual([{ count: 0 }]);
  });
});
