import { type GoalProgress, goalProgress, type GoalRecord } from "../../shared/goalProgress";
import type { GoalTypeId } from "../../shared/goalTypes";
import type { GoalLocalState } from "./goalLocalState";

export interface GoalDefinition {
  id: string;
  type: GoalTypeId;
  target: number;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface GoalLocalProgress {
  current: number;
  streakDays?: number;
  best?: number;
  week?: boolean[];
}

const AMOUNT_TYPES: GoalTypeId[] = ["daily", "session", "project"];

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function toGoalRecord(goal: GoalDefinition, local: GoalLocalProgress): GoalRecord {
  const config = goal.config;
  const record: GoalRecord = { id: goal.id, type: goal.type, current: local.current };
  if (goal.type === "time") record.minutes = goal.target;
  else if (AMOUNT_TYPES.includes(goal.type)) record.words = goal.target;
  applyDeadline(record, goal, config);
  applyStreak(record, goal, local, config);
  return record;
}

function applyDeadline(record: GoalRecord, goal: GoalDefinition, config: Record<string, unknown>): void {
  if (goal.type !== "deadline") return;
  record.finalWords = goal.target;
  record.date = stringValue(config.date);
  record.startDate = stringValue(config.startDate);
  record.startWords = numberValue(config.startWords);
}

function applyStreak(record: GoalRecord, goal: GoalDefinition, local: GoalLocalProgress, config: Record<string, unknown>): void {
  if (goal.type !== "streak") return;
  record.qualifies = config.qualifies === "daily" || config.qualifies === "time" ? config.qualifies : "any";
  record.qualifyAmount = numberValue(config.qualifyAmount);
  record.milestone = numberValue(config.milestone) ?? null;
  record.streakDays = local.streakDays ?? 0;
  record.best = local.best ?? 0;
  record.week = local.week ?? [];
}

export function progressFor(goal: GoalDefinition, local: GoalLocalProgress): GoalProgress {
  return goalProgress(toGoalRecord(goal, local));
}

export function localProgress(
  goal: GoalDefinition,
  state: GoalLocalState | undefined,
  manuscriptWords: number,
): number {
  if (goal.type === "project" || goal.type === "deadline") return manuscriptWords;
  if (goal.type === "daily") return Math.max(0, manuscriptWords - (state?.baseline ?? manuscriptWords));
  return state?.sessionWords ?? 0;
}

export function goalCardKind(type: GoalTypeId): "amount" | "deadline" | "streak" {
  if (type === "deadline") return "deadline";
  if (type === "streak") return "streak";
  return "amount";
}

export function remainderCopy(goal: GoalDefinition, local: GoalLocalProgress): string {
  const progress = progressFor(goal, local);
  if (progress.family === "amount") return amountRemainder(progress);
  if (progress.family === "deadline") {
    if (!progress.valid) return "Choose a finish date to see your pace.";
    if (progress.current >= progress.finalWords) return "Draft target met.";
    return `${progress.perDay.toLocaleString()} words a day keeps you on pace.`;
  }
  if (progress.days <= 0) return "Write today to begin your streak.";
  const milestone = progress.milestone ? ` · ${Math.max(0, progress.milestone - progress.days)} to your milestone` : "";
  return `${progress.days}-day streak${milestone}.`;
}

function amountRemainder(progress: Extract<GoalProgress, { family: "amount" }>): string {
  if (progress.target <= 0) return "Set a target to begin.";
  const unit = progress.unit === "minutes" ? "minutes" : "words";
  if (progress.current === progress.target) return `Goal met — ${progress.target.toLocaleString()} ${unit}.`;
  if (progress.current > progress.target) return `${(progress.current - progress.target).toLocaleString()} ${unit} beyond your goal.`;
  return `${progress.remaining.toLocaleString()} ${unit} to go.`;
}

export function deadlinePaceLabel(progress: Extract<GoalProgress, { family: "deadline" }>): string {
  if (!progress.valid) return "Date needed";
  if (Math.abs(progress.delta) < Math.max(1, progress.perDay)) return "On track";
  return progress.delta > 0 ? "Ahead" : "Behind";
}
