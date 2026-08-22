import type { DbClient } from "../db/dbClient";
import { desktopLwwBridges } from "../sync/desktopLwwBridges";
import type { Goal, GoalsStore } from "./goalsStore";
import { getDb } from "./schema";

export type { Goal, GoalsStore } from "./goalsStore";

/** Raw row shape returned by tauri-plugin-sql before boolean mapping. */
interface GoalRow {
  id: string;
  project_id: string;
  goal_type: string;
  target: number;
  enabled: number;
  created_at: number;
  config_json?: string;
}

function mapRow(row: GoalRow): Goal {
  return {
    id: row.id,
    project_id: row.project_id,
    goal_type: row.goal_type,
    target: row.target,
    enabled: row.enabled !== 0,
    created_at: row.created_at,
    config_json: row.config_json,
  };
}

function parseConfig(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

/**
 * `config_json` was added by migration (migrations3.ts addFeatureColumns) —
 * every DB reached through the real app has it. A handful of older tests
 * build their own minimal `goals` table without it (one is a locked
 * acceptance fixture this store must keep working against unmodified), so
 * reads/writes of that column degrade gracefully instead of throwing
 * "no such column".
 */
async function hasConfigColumn(db: DbClient): Promise<boolean> {
  const rows = await db.select<Array<{ name: string }>>("PRAGMA table_info(goals)");
  return rows.some((row) => row.name === "config_json");
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
    const withConfig = await hasConfigColumn(db);
    const columns = withConfig
      ? "id, project_id, goal_type, target, enabled, created_at, config_json"
      : "id, project_id, goal_type, target, enabled, created_at";
    const rows = await db.select<GoalRow[]>(
      `SELECT ${columns} FROM goals WHERE project_id = $1`, [projectId]
    );
    return rows.map(mapRow);
  }

  async upsertGoal(input: {
    projectId: string;
    goalType: string;
    target: number;
    enabled: boolean;
    config?: Record<string, unknown>;
  }): Promise<Goal> {
    const db = await getDb();
    const withConfig = await hasConfigColumn(db);
    const columns = withConfig
      ? "id, project_id, goal_type, target, enabled, created_at, config_json"
      : "id, project_id, goal_type, target, enabled, created_at";
    const existing = await db.select<GoalRow[]>(
      `SELECT ${columns} FROM goals WHERE project_id = $1 AND goal_type = $2`,
      [input.projectId, input.goalType]
    );

    if (existing.length > 0) {
      const row = existing[0];
      const saved = withConfig
        ? await this.updateWithConfig(db, row, input)
        : await this.updateLegacy(db, row, input);
      await desktopLwwBridges.goals.saved(input.projectId, saved.id);
      return saved;
    }

    const saved = withConfig
      ? await this.insertWithConfig(db, input)
      : await this.insertLegacy(db, input);
    await desktopLwwBridges.goals.saved(input.projectId, saved.id);
    return saved;
  }

  private async updateWithConfig(
    db: DbClient, row: GoalRow,
    input: { target: number; enabled: boolean; config?: Record<string, unknown> },
  ): Promise<Goal> {
    // Omitted `config` preserves the existing config_json (an enable/disable-only
    // write must not wipe fields it never touched) — mirrors MobileGoalsStore.
    const configJson = JSON.stringify(input.config ?? parseConfig(row.config_json));
    const updatedAt = new Date().toISOString();
    await db.execute(
      "UPDATE goals SET target = $1, enabled = $2, config_json = $3, updated_at = $4 WHERE id = $5",
      [input.target, input.enabled ? 1 : 0, configJson, updatedAt, row.id]
    );
    return mapRow({ ...row, target: input.target, enabled: input.enabled ? 1 : 0, config_json: configJson });
  }

  private async updateLegacy(
    db: DbClient, row: GoalRow, input: { target: number; enabled: boolean },
  ): Promise<Goal> {
    await db.execute(
      "UPDATE goals SET target = $1, enabled = $2 WHERE id = $3",
      [input.target, input.enabled ? 1 : 0, row.id]
    );
    return mapRow({ ...row, target: input.target, enabled: input.enabled ? 1 : 0 });
  }

  private async insertWithConfig(
    db: DbClient,
    input: { projectId: string; goalType: string; target: number; enabled: boolean; config?: Record<string, unknown> },
  ): Promise<Goal> {
    const id = crypto.randomUUID();
    const created_at = Date.now();
    const configJson = JSON.stringify(input.config ?? {});
    const updatedAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO goals (id, project_id, goal_type, target, enabled, created_at, config_json, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, input.projectId, input.goalType, input.target, input.enabled ? 1 : 0, created_at, configJson, updatedAt]
    );
    return {
      id, project_id: input.projectId, goal_type: input.goalType, target: input.target,
      enabled: input.enabled, created_at, config_json: configJson,
    };
  }

  private async insertLegacy(
    db: DbClient,
    input: { projectId: string; goalType: string; target: number; enabled: boolean },
  ): Promise<Goal> {
    const id = crypto.randomUUID();
    const created_at = Date.now();
    await db.execute(
      "INSERT INTO goals (id, project_id, goal_type, target, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, input.projectId, input.goalType, input.target, input.enabled ? 1 : 0, created_at]
    );
    return {
      id, project_id: input.projectId, goal_type: input.goalType,
      target: input.target, enabled: input.enabled, created_at,
    };
  }

  async deleteGoal(id: string): Promise<void> {
    const db = await getDb();
    const rows = await db.select<Array<{ project_id: string }>>(
      "SELECT project_id FROM goals WHERE id = $1", [id],
    );
    await db.execute("DELETE FROM goals WHERE id = $1", [id]);
    if (rows?.[0]) await desktopLwwBridges.goals.deleted(rows[0].project_id, id);
  }
}
