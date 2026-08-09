import { makeSqlJsDb, type SqlJsTestDb } from "@writersnook/test/support/sqljsDb";
import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../shared/migrations";
import { MobileGoalLocalStateStore } from "./mobileGoalLocalStateStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

let db: SqlJsTestDb;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
});

describe("durable device-local goal state", () => {
  it("round-trips every field and survives a store restart", async () => {
    const state = {
      baseline: 123, metDays: ["2026-08-08"],
      streak: { count: 4, lastMetDate: "2026-08-08" },
      sessionStartedAt: 42, sessionWords: 88,
    };
    await new MobileGoalLocalStateStore(db).write("goal-1", state);
    expect(await new MobileGoalLocalStateStore(db).read("goal-1")).toEqual(state);
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
