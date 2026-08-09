import {
  EMPTY_LOCAL_STATE,
  type GoalLocalPersistence,
  type GoalLocalState,
} from "../features/goals/goalLocalState";
import type { DbClient } from "../shared/dbClient";

const KEY_PREFIX = "goal_local_state:";

function validState(value: unknown): value is GoalLocalState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.baseline === "number" && Array.isArray(row.metDays)
    && (row.baselineDate === undefined || typeof row.baselineDate === "string")
    && row.metDays.every((day) => typeof day === "string")
    && validStreak(row.streak) && validSession(row);
}

function validStreak(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.count === "number" && typeof row.lastMetDate === "string";
}

function validSession(row: Record<string, unknown>): boolean {
  const validStart = row.sessionStartedAt === null || typeof row.sessionStartedAt === "number";
  return validStart && typeof row.sessionWords === "number";
}

/** Device-local by D8: app_meta persistence, with no LWW/local-write notification. */
export class MobileGoalLocalStateStore implements GoalLocalPersistence {
  constructor(private readonly db: DbClient) {}

  async read(goalId: string): Promise<GoalLocalState | null> {
    const rows = await this.db.select<{ value: string }[]>(
      "SELECT value FROM app_meta WHERE key = ?", [`${KEY_PREFIX}${goalId}`],
    );
    if (!rows[0]) return null;
    try {
      const parsed: unknown = JSON.parse(rows[0].value);
      return validState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async write(goalId: string, state: GoalLocalState): Promise<void> {
    await this.db.execute(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      [`${KEY_PREFIX}${goalId}`, JSON.stringify(state)],
    );
  }

  async ensure(goalId: string, baseline: number, today?: string): Promise<GoalLocalState> {
    const current = await this.read(goalId);
    if (current && (today === undefined || current.baselineDate === today)) return current;
    const initial = current
      ? { ...current, baseline, baselineDate: today }
      : { ...EMPTY_LOCAL_STATE, baseline, ...(today === undefined ? {} : { baselineDate: today }) };
    await this.write(goalId, initial);
    return initial;
  }
}
