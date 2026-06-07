/**
 * goalsP6.acceptance.test.ts — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 6.
 *
 * ⚠️ Implementers: DO NOT MODIFY THIS FILE. Make it pass without editing it.
 *
 * Locks the unit-testable P6 contracts:
 *   1. deleteGoal: the GoalsStore can delete a goal (needed by the inspector right-click "Delete goal").
 *   2. Q-GOALRING (LOCKED: keep the features/goals ring, delete the inspector/ duplicate): GoalRing is
 *      exported from the consolidated module src/features/goals/InspectorGoalRings.tsx.
 *
 * Runtime/visual effects verified by the live CDP smoke for this phase (not here):
 *   - inspector goal card right-click → Edit / Manage all / Delete menu,
 *   - a new deadline goal's "already written" default reflects the real manuscript word count (not 0).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteGoalsStore } from "../db/sqliteGoalsStore";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

vi.mock("../db/schema", () => ({ getDb: vi.fn() }));

import { getDb } from "../db/schema";

const GOALS_DDL = `
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    goal_type TEXT NOT NULL,
    target INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )
`;

let db: SqlJsTestDb;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await db.execute(GOALS_DDL);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
});

afterEach(() => {
  db.close();
  vi.clearAllMocks();
});

describe("Wave 28 P6 — GoalsStore.deleteGoal", () => {
  it("removes the goal row so getGoals no longer returns it", async () => {
    const store = new SqliteGoalsStore();
    const goal = await store.upsertGoal({ projectId: "p1", goalType: "daily", target: 500, enabled: true });
    expect((await store.getGoals("p1")).length).toBe(1);

    await store.deleteGoal(goal.id);

    expect(await store.getGoals("p1")).toEqual([]);
  });

  it("is a no-op for an unknown id (does not throw, leaves other goals)", async () => {
    const store = new SqliteGoalsStore();
    await store.upsertGoal({ projectId: "p1", goalType: "daily", target: 500, enabled: true });
    await store.deleteGoal("does-not-exist");
    expect((await store.getGoals("p1")).length).toBe(1);
  });
});

describe("Wave 28 P6 — Q-GOALRING consolidation", () => {
  it("GoalRing is exported from the consolidated features/goals module", async () => {
    const mod = await import("../features/goals/InspectorGoalRings");
    expect(typeof (mod as Record<string, unknown>).GoalRing).toBe("function");
  });
});
