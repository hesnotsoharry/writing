import { makeSqlJsDb, type SqlJsTestDb } from "@writersnook/test/support/sqljsDb";
import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../shared/migrations";
import { MobileGoalsStore } from "./mobileGoalsStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

let db: SqlJsTestDb;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
});

describe("mobile goals store — per-goal enable/disable and delete", () => {
  it("flips enabled on the same row instead of creating a duplicate", async () => {
    const store = new MobileGoalsStore(db);
    const created = await store.upsertGoal({
      projectId: "p1", goalType: "daily", target: 750, enabled: true, config: { words: 750 },
    });
    const disabled = await store.upsertGoal({
      projectId: "p1", goalType: "daily", target: created.target, enabled: false, config: created.config,
    });
    expect(disabled.id).toBe(created.id);
    expect(disabled.enabled).toBe(false);
    const rows = await store.getGoals("p1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: created.id, enabled: false, target: 750 });
  });

  it("re-enables a disabled goal without losing its target or config", async () => {
    const store = new MobileGoalsStore(db);
    await store.upsertGoal({ projectId: "p1", goalType: "streak", target: 30, enabled: false, config: { milestone: 30 } });
    const reEnabled = await store.upsertGoal({ projectId: "p1", goalType: "streak", target: 30, enabled: true });
    expect(reEnabled.enabled).toBe(true);
    expect(reEnabled.target).toBe(30);
    expect(reEnabled.config).toEqual({ milestone: 30 });
  });

  it("deletes the row and notifies local-write subscribers with deleted: true", async () => {
    const store = new MobileGoalsStore(db);
    const goal = await store.upsertGoal({ projectId: "p1", goalType: "session", target: 800, enabled: true });
    const writes: unknown[] = [];
    const unsubscribe = mobileLocalWrites.subscribe((write) => writes.push(write));
    await store.deleteGoal(goal.id);
    unsubscribe();
    expect(await store.getGoals("p1")).toEqual([]);
    expect(writes).toEqual([{ domain: "goals", projectId: "p1", rowId: goal.id, deleted: true }]);
  });
});
