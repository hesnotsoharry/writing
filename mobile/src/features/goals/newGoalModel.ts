import { blankDraft, buildGoal, draftFromGoal, type GoalDraft } from "../../shared/goalsEditorHelpers";
import { GOAL_META, type GoalFamily, type GoalTypeId } from "../../shared/goalTypes";
import { type GoalDefinition, toGoalRecord } from "./goalModel";

export interface TargetSectionModel {
  family: GoalFamily;
  unit: string;
  presets: readonly number[];
  showCountDaysOff: boolean;
  showDate: boolean;
  showQualifiers: boolean;
}

const PRESETS: Record<GoalTypeId, readonly number[]> = {
  daily: [250, 500, 750, 1_000, 2_000],
  session: [250, 500, 800, 1_000, 2_000],
  project: [50_000, 80_000, 90_000, 100_000, 120_000],
  deadline: [50_000, 80_000, 90_000, 100_000, 120_000],
  time: [15, 30, 45, 60, 90],
  streak: [7, 14, 30, 60, 100],
};

export function targetSectionFor(type: GoalTypeId): TargetSectionModel {
  const family = GOAL_META[type].family;
  return {
    family,
    unit: type === "time" ? "minutes a day" : type === "project" || type === "deadline"
      ? "words total" : type === "streak" ? "day milestone" : type === "session" ? "words a session" : "words a day",
    presets: PRESETS[type],
    showCountDaysOff: type === "daily" || type === "deadline" || type === "streak",
    showDate: family === "deadline",
    showQualifiers: family === "streak",
  };
}

export function makeDraft(type: GoalTypeId, projectWords: number): GoalDraft {
  const draft = blankDraft(type, projectWords);
  if (type === "daily") draft.amount = 750;
  return draft;
}

export interface GoalWrite {
  goalType: GoalTypeId;
  target: number;
  enabled: boolean;
  config: Record<string, unknown>;
}

function targetOf(type: GoalTypeId, draft: GoalDraft): number {
  if (type === "deadline") return draft.finalWords;
  if (type === "streak") return draft.milestone;
  return draft.amount;
}

function finiteTarget(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export interface GoalWriteOptions {
  countDaysOff: boolean;
  /** Preserved from the existing row when editing; defaults to true for a brand-new goal. */
  enabled?: boolean;
}

export function goalWrite(
  type: GoalTypeId,
  draft: GoalDraft,
  projectWords: number,
  options: GoalWriteOptions,
): GoalWrite {
  const { countDaysOff, enabled = true } = options;
  const goal = buildGoal(null, type, draft, projectWords);
  const config: Record<string, unknown> = { ...goal, countDaysOff };
  delete config.id;
  delete config.type;
  delete config.current;
  delete config.streakDays;
  delete config.best;
  delete config.week;
  return { goalType: type, target: finiteTarget(targetOf(type, draft)), enabled, config };
}

/** The subset of a persisted goal row the edit-prefill mapping needs — deliberately
 *  narrower than `MobileGoal` so this stays a pure function callers can unit-test
 *  without a store or database. */
export interface ExistingGoalRow {
  goal_type: string;
  target: number;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ExistingGoalDraft {
  type: GoalTypeId;
  draft: GoalDraft;
  countDaysOff: boolean;
  enabled: boolean;
}

/** Maps a stored goal row back into editor state so NewGoalScreen can reopen an
 *  existing goal pre-filled, reusing the same `toGoalRecord`/`draftFromGoal`
 *  helpers the desktop editor and progress cards already rely on. */
export function draftForExistingGoal(row: ExistingGoalRow, projectWords: number): ExistingGoalDraft {
  const type = row.goal_type as GoalTypeId;
  const definition: GoalDefinition = { id: "editing", type, target: row.target, enabled: row.enabled, config: row.config };
  const record = toGoalRecord(definition, { current: projectWords });
  return {
    type, draft: draftFromGoal(record, projectWords),
    countDaysOff: row.config.countDaysOff === true, enabled: row.enabled,
  };
}
