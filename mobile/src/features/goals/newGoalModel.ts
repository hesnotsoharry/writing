import { blankDraft, buildGoal, type GoalDraft } from "../../shared/goalsEditorHelpers";
import { GOAL_META, type GoalFamily, type GoalTypeId } from "../../shared/goalTypes";

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

export function goalWrite(
  type: GoalTypeId,
  draft: GoalDraft,
  projectWords: number,
  countDaysOff: boolean,
): GoalWrite {
  const goal = buildGoal(null, type, draft, projectWords);
  const config: Record<string, unknown> = { ...goal, countDaysOff };
  delete config.id;
  delete config.type;
  delete config.current;
  delete config.streakDays;
  delete config.best;
  delete config.week;
  return { goalType: type, target: finiteTarget(targetOf(type, draft)), enabled: true, config };
}
