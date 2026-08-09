import type { DbClient } from "../shared/dbClient";
import type { Goal, GoalsStore } from "../shared/goalsStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

export interface MobileGoal extends Goal {
  config: Record<string, unknown>;
  updatedAt: string | null;
}
interface GoalRow extends Omit<Goal, "enabled"> {
  enabled: number;
  config_json: string;
  updated_at: string | null;
}
function parseConfig(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}
function mapGoal(row: GoalRow): MobileGoal {
  return { ...row, enabled: row.enabled !== 0, config: parseConfig(row.config_json), updatedAt: row.updated_at };
}

export class MobileGoalsStore implements GoalsStore {
  constructor(private readonly db: DbClient) {}

  async getGoals(projectId: string): Promise<MobileGoal[]> {
    const rows = await this.db.select<GoalRow[]>(
      `SELECT id, project_id, goal_type, target, enabled, created_at, config_json, updated_at
       FROM goals WHERE project_id = ?`, [projectId],
    );
    return rows.map(mapGoal);
  }

  async upsertGoal(input: {
    projectId: string; goalType: string; target: number; enabled: boolean;
    config?: Record<string, unknown>;
  }): Promise<MobileGoal> {
    const rows = await this.db.select<GoalRow[]>(
      `SELECT id, project_id, goal_type, target, enabled, created_at, config_json, updated_at
       FROM goals WHERE project_id = ? AND goal_type = ?`, [input.projectId, input.goalType],
    );
    const existing = rows[0];
    const id = existing?.id ?? crypto.randomUUID();
    const createdAt = existing?.created_at ?? Date.now();
    const config = input.config ?? (existing ? parseConfig(existing.config_json) : {});
    const updatedAt = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO goals (id, project_id, goal_type, target, enabled, created_at, config_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET target=excluded.target, enabled=excluded.enabled,
       config_json=excluded.config_json, updated_at=excluded.updated_at`,
      [id, input.projectId, input.goalType, input.target, input.enabled ? 1 : 0, createdAt, JSON.stringify(config), updatedAt],
    );
    mobileLocalWrites.notify({ domain: "goals", projectId: input.projectId, rowId: id, deleted: false });
    return {
      id, project_id: input.projectId, goal_type: input.goalType, target: input.target,
      enabled: input.enabled, created_at: createdAt, config, updatedAt,
    };
  }

  async deleteGoal(id: string): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM goals WHERE id = ?", [id]);
    await this.db.execute("DELETE FROM goals WHERE id = ?", [id]);
    if (rows[0]) mobileLocalWrites.notify({ domain: "goals", projectId: rows[0].project_id, rowId: id, deleted: true });
  }
}
