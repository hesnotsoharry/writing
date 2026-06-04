import { getDb } from "./schema";

/** A goal row as it exists in the database. */
export interface Goal {
  id: string;
  project_id: string;
  goal_type: string;
  target: number;
  /** Mapped from SQLite INTEGER 0/1. */
  enabled: boolean;
  created_at: number;
}

/** Persistence contract for project goals. */
export interface GoalsStore {
  getGoals(projectId: string): Promise<Goal[]>;
  upsertGoal(input: {
    projectId: string;
    goalType: string;
    target: number;
    enabled: boolean;
  }): Promise<Goal>;
}

/** Raw row shape returned by tauri-plugin-sql before boolean mapping. */
interface GoalRow {
  id: string;
  project_id: string;
  goal_type: string;
  target: number;
  enabled: number;
  created_at: number;
}

function mapRow(row: GoalRow): Goal {
  return {
    id: row.id,
    project_id: row.project_id,
    goal_type: row.goal_type,
    target: row.target,
    enabled: row.enabled !== 0,
    created_at: row.created_at,
  };
}

/**
 * SQLite-backed GoalsStore over tauri-plugin-sql.
 * Mirrors SqliteBinderStore: getDb(), $1-style params.
 *
 * One-row-per-(project_id, goal_type) invariant is enforced here because the
 * goals table has no UNIQUE constraint — we SELECT before INSERT and UPDATE
 * in place when a row already exists.
 */
export class SqliteGoalsStore implements GoalsStore {
  async getGoals(projectId: string): Promise<Goal[]> {
    const db = await getDb();
    const rows = await db.select<GoalRow[]>(
      "SELECT id, project_id, goal_type, target, enabled, created_at FROM goals WHERE project_id = $1",
      [projectId]
    );
    return rows.map(mapRow);
  }

  async upsertGoal(input: {
    projectId: string;
    goalType: string;
    target: number;
    enabled: boolean;
  }): Promise<Goal> {
    const db = await getDb();
    const existing = await db.select<GoalRow[]>(
      "SELECT id, project_id, goal_type, target, enabled, created_at FROM goals WHERE project_id = $1 AND goal_type = $2",
      [input.projectId, input.goalType]
    );

    if (existing.length > 0) {
      const row = existing[0];
      await db.execute(
        "UPDATE goals SET target = $1, enabled = $2 WHERE id = $3",
        [input.target, input.enabled ? 1 : 0, row.id]
      );
      return mapRow({ ...row, target: input.target, enabled: input.enabled ? 1 : 0 });
    }

    const id = crypto.randomUUID();
    const created_at = Date.now();
    await db.execute(
      "INSERT INTO goals (id, project_id, goal_type, target, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, input.projectId, input.goalType, input.target, input.enabled ? 1 : 0, created_at]
    );
    return {
      id,
      project_id: input.projectId,
      goal_type: input.goalType,
      target: input.target,
      enabled: input.enabled,
      created_at,
    };
  }
}
