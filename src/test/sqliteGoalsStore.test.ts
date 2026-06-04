import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteGoalsStore } from "../db/sqliteGoalsStore";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * Unit tests for SqliteGoalsStore.
 *
 * Strategy: mock `getDb` (from ../db/schema) to return a real sql.js in-process
 * database. The goals table is created before each test, mirroring the schema
 * in migrations.ts. This verifies the SELECT → INSERT/UPDATE logic without
 * any Tauri runtime.
 *
 * Contract:
 *  - upsertGoal INSERTs a new row when no row exists for (project_id, goal_type).
 *  - upsertGoal UPDATEs target+enabled when a row already exists for that pair.
 *  - One row per (project_id, goal_type) invariant is maintained.
 *  - getGoals returns all goals for the given project_id, with enabled mapped boolean.
 *  - getGoals returns an empty array when no rows exist.
 */

vi.mock("../db/schema", () => ({
  getDb: vi.fn(),
}));

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

describe("SqliteGoalsStore.getGoals", () => {
  it("returns an empty array when no goals exist for the project", async () => {
    const store = new SqliteGoalsStore();
    const result = await store.getGoals("project-1");
    expect(result).toEqual([]);
  });

  it("returns only goals for the requested project_id", async () => {
    const store = new SqliteGoalsStore();
    await store.upsertGoal({ projectId: "project-1", goalType: "daily", target: 500, enabled: true });
    await store.upsertGoal({ projectId: "project-2", goalType: "daily", target: 200, enabled: false });

    const result = await store.getGoals("project-1");
    expect(result).toHaveLength(1);
    expect(result[0].project_id).toBe("project-1");
  });

  it("maps SQLite INTEGER enabled (1) to boolean true", async () => {
    const store = new SqliteGoalsStore();
    await store.upsertGoal({ projectId: "p1", goalType: "daily", target: 500, enabled: true });

    const goals = await store.getGoals("p1");
    expect(goals[0].enabled).toBe(true);
  });

  it("maps SQLite INTEGER enabled (0) to boolean false", async () => {
    const store = new SqliteGoalsStore();
    await store.upsertGoal({ projectId: "p1", goalType: "daily", target: 500, enabled: false });

    const goals = await store.getGoals("p1");
    expect(goals[0].enabled).toBe(false);
  });
});

describe("SqliteGoalsStore.upsertGoal — INSERT path", () => {
  it("inserts a new row when no goal exists for (project_id, goal_type)", async () => {
    const store = new SqliteGoalsStore();
    const goal = await store.upsertGoal({
      projectId: "project-1",
      goalType: "daily",
      target: 500,
      enabled: true,
    });

    expect(goal.project_id).toBe("project-1");
    expect(goal.goal_type).toBe("daily");
    expect(goal.target).toBe(500);
    expect(goal.enabled).toBe(true);
    expect(typeof goal.id).toBe("string");
    expect(goal.id.length).toBeGreaterThan(0);
    expect(typeof goal.created_at).toBe("number");

    const persisted = await store.getGoals("project-1");
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe(goal.id);
  });

  it("creates separate rows for different goal_types in the same project", async () => {
    const store = new SqliteGoalsStore();
    await store.upsertGoal({ projectId: "p1", goalType: "daily", target: 500, enabled: true });
    await store.upsertGoal({ projectId: "p1", goalType: "session", target: 300, enabled: false });

    const goals = await store.getGoals("p1");
    expect(goals).toHaveLength(2);
    expect(goals.map((g) => g.goal_type).sort()).toEqual(["daily", "session"]);
  });
});

describe("SqliteGoalsStore.upsertGoal — UPDATE path", () => {
  it("updates target and enabled in-place when a row already exists for (project_id, goal_type)", async () => {
    const store = new SqliteGoalsStore();
    const first = await store.upsertGoal({
      projectId: "p1",
      goalType: "daily",
      target: 500,
      enabled: true,
    });

    const updated = await store.upsertGoal({
      projectId: "p1",
      goalType: "daily",
      target: 1000,
      enabled: false,
    });

    expect(updated.id).toBe(first.id);
    expect(updated.target).toBe(1000);
    expect(updated.enabled).toBe(false);

    const goals = await store.getGoals("p1");
    expect(goals).toHaveLength(1);
    expect(goals[0].target).toBe(1000);
    expect(goals[0].enabled).toBe(false);
  });

  it("maintains one-row-per-(project_id, goal_type) after multiple upserts", async () => {
    const store = new SqliteGoalsStore();
    await store.upsertGoal({ projectId: "p1", goalType: "streak", target: 7, enabled: true });
    await store.upsertGoal({ projectId: "p1", goalType: "streak", target: 14, enabled: true });
    await store.upsertGoal({ projectId: "p1", goalType: "streak", target: 30, enabled: false });

    const goals = await store.getGoals("p1");
    expect(goals).toHaveLength(1);
    expect(goals[0].target).toBe(30);
    expect(goals[0].enabled).toBe(false);
  });
});
