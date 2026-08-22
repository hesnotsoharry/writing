/**
 * goalRowMapping.ts — Goal (DB row) ↔ GoalRecord (UI model) conversion.
 *
 * The `goals` table stores one flat `target` column plus a `config_json`
 * blob for whatever a goal type needs beyond that (mobile writes it via
 * `newGoalModel.goalWrite` — see mobile/src/features/goals/newGoalModel.ts,
 * read-only reference). Before this module, both desktop readers reduced a
 * row to `{ id, type, words: target }`, so a mobile-created streak goal
 * rendered as an empty "Not started yet" and deadline goals had no date —
 * `target` alone isn't enough to reconstruct those families.
 *
 * `goalRecordFromRow` is the read side (row → GoalRecord, config_json wins
 * over the legacy `target` column when both are present). `goalConfigForRow`
 * is the write side — the inverse of mobile's `goalWrite`, stripping the
 * fields that already have their own column (id, type, enabled) or that are
 * device-local and never sync (current, streakDays, best, week).
 */
import type { Goal } from "../../db/goalsStore";
import type { GoalRecord } from "./goalModel";
import type { GoalTypeId } from "./goalTypes";
import { GOAL_META } from "./goalTypes";

function parseConfig(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function qualifiesOf(value: unknown): GoalRecord["qualifies"] {
  return value === "any" || value === "daily" || value === "time" ? value : undefined;
}

/** Amount family (daily/session/project/time): words or minutes + optional scope. */
function applyAmountConfig(base: GoalRecord, config: Record<string, unknown>, type: GoalTypeId, target: number): void {
  if (GOAL_META[type].unit === "minutes") base.minutes = num(config.minutes) ?? target;
  else base.words = num(config.words) ?? target;
  const scope = str(config.scope);
  if (scope) base.scope = scope;
}

/** Deadline family: finish line, finish-by date, starting point. */
function applyDeadlineConfig(base: GoalRecord, config: Record<string, unknown>, target: number): void {
  base.finalWords = num(config.finalWords) ?? target;
  const date = str(config.date); if (date) base.date = date;
  const startWords = num(config.startWords); if (startWords !== undefined) base.startWords = startWords;
  const startDate = str(config.startDate); if (startDate) base.startDate = startDate;
}

/** Streak family: milestone + what keeps it alive. Streak COUNTS (streakDays/
 *  best/week) are device-local and deliberately never read from config_json. */
function applyStreakConfig(base: GoalRecord, config: Record<string, unknown>, target: number): void {
  base.milestone = num(config.milestone) ?? (target || null);
  const qualifies = qualifiesOf(config.qualifies); if (qualifies) base.qualifies = qualifies;
  const qualifyAmount = num(config.qualifyAmount); if (qualifyAmount !== undefined) base.qualifyAmount = qualifyAmount;
}

/** Row → UI model. config_json (when present) wins over the flat `target`
 *  column for family-specific fields; `target` is the fallback for legacy
 *  rows written before config_json existed. */
export function goalRecordFromRow(row: Goal): GoalRecord {
  const type = row.goal_type as GoalTypeId;
  const config = parseConfig(row.config_json);
  // Tolerate a raw 0/1 slipping through (SQLite driver quirks, loosely-typed
  // test fixtures) rather than trusting `boolean` at the type level only.
  const enabled = row.enabled == null ? true : Boolean(row.enabled);
  const base: GoalRecord = { id: row.id, type, enabled };
  const meta = GOAL_META[type];
  if (!meta) { base.words = row.target; return base; }
  if (meta.family === "amount") applyAmountConfig(base, config, type, row.target);
  else if (meta.family === "deadline") applyDeadlineConfig(base, config, row.target);
  else applyStreakConfig(base, config, row.target);
  const countDaysOff = config.countDaysOff;
  if (typeof countDaysOff === "boolean") base.countDaysOff = countDaysOff;
  return base;
}

/** UI model → config_json payload. Strips the fields that already have a
 *  dedicated column (id, type, enabled) and the device-local streak counters
 *  (current, streakDays, best, week) — mirrors mobile's `goalWrite`. */
export function goalConfigForRow(g: GoalRecord): Record<string, unknown> {
  const config: Record<string, unknown> = { ...g };
  delete config.id;
  delete config.type;
  delete config.enabled;
  delete config.current;
  delete config.streakDays;
  delete config.best;
  delete config.week;
  return config;
}
