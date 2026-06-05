/**
 * goalModel.ts — daily goal progress model (localStorage-only; no migration).
 *
 * Wave 27 additions: GoalRecord, GoalProgress, goalProgress(), goalSummary(),
 * readMonthlyMetDays() — family-aware progress derivation for the adaptive
 * Goals editor + inspector visualizations.
 */

import type { GoalFamily, GoalTypeId } from "./goalTypes";
import { GOAL_META } from "./goalTypes";

// ── Scope types ───────────────────────────────────────────────────────────────

/** The three supported goal scopes. */
export type GoalScope = "manuscript" | "chapter" | "scene";

/** Args that uniquely identify a scoped goal target. */
export interface ScopedGoalKey {
  projectId: string;
  scope: GoalScope;
  /** null for manuscript scope; folderId for chapter; sceneId for scene. */
  targetId: string | null;
}

// ── Key helpers ───────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toLocaleDateString("sv"); // "YYYY-MM-DD" in local time
}

/** Encode targetId for use in a localStorage key — null → "_". */
function encodeTargetId(targetId: string | null): string {
  return targetId ?? "_";
}

function baselineKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.baseline.${key.projectId}.${key.scope}.${encodeTargetId(key.targetId)}.${date}`;
}

function metKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.met.${key.projectId}.${key.scope}.${encodeTargetId(key.targetId)}.${date}`;
}

// ── Goal record types (Wave 27) ───────────────────────────────────────────────

export interface GoalRecord {
  id: string;
  type: GoalTypeId;
  words?: number;
  minutes?: number;
  scope?: string;
  current?: number;
  finalWords?: number;
  date?: string;
  startWords?: number;
  startDate?: string;
  qualifies?: "any" | "daily" | "time";
  qualifyAmount?: number;
  milestone?: number | null;
  streakDays?: number;
  best?: number;
  week?: boolean[];
}

export type GoalProgress =
  | {
      family: "amount";
      unit: "words" | "minutes";
      current: number;
      target: number;
      pct: number;
      remaining: number;
      period: string;
    }
  | {
      family: "deadline";
      valid: boolean;
      daysLeft: number;
      perDay: number;
      wordPct: number;
      timePct: number;
      delta: number;
      current: number;
      finalWords: number;
      due: Date;
    }
  | {
      family: "streak";
      days: number;
      best: number;
      week: boolean[];
      milestone: number | null;
    };

const GOAL_PERIOD: Record<string, string> = {
  daily: "each day", session: "each sitting", project: "total", time: "each day",
};

function amountProgress(g: GoalRecord): Extract<GoalProgress, { family: "amount" }> {
  const meta = GOAL_META[g.type];
  const target = g.words != null ? g.words : (g.minutes ?? 0);
  const current = g.current ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return {
    family: "amount",
    unit: (meta?.unit ?? "words") as "words" | "minutes",
    current,
    target,
    pct,
    remaining: Math.max(0, target - current),
    period: GOAL_PERIOD[g.type] ?? "",
  };
}

interface DeadlineDateCalc {
  valid: boolean; totalDays: number; elapsed: number; daysLeft: number;
}

function calcDeadlineDates(g: GoalRecord): DeadlineDateCalc {
  const DAY = 86_400_000;
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const due = new Date((g.date ?? "") + "T00:00:00");
  const start = new Date((g.startDate ?? g.date ?? "") + "T00:00:00");
  const valid = !isNaN(due.getTime()) && !isNaN(start.getTime());
  const totalDays = valid ? Math.max(1, Math.round((due.getTime() - start.getTime()) / DAY)) : 1;
  const elapsed = valid
    ? Math.min(totalDays, Math.max(0, Math.round((todayDate.getTime() - start.getTime()) / DAY)))
    : 0;
  const daysLeft = valid ? Math.max(0, Math.round((due.getTime() - todayDate.getTime()) / DAY)) : 0;
  return { valid, totalDays, elapsed, daysLeft };
}

function calcDeadlineRates(
  g: GoalRecord, daysLeft: number, totalDays: number, elapsed: number,
): { perDay: number; wordPct: number; timePct: number; delta: number } {
  const remaining = Math.max(0, (g.finalWords ?? 0) - (g.current ?? 0));
  const perDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
  const wordPct = g.finalWords
    ? Math.min(100, Math.round(((g.current ?? 0) / g.finalWords) * 100)) : 0;
  const timePct = Math.round((elapsed / totalDays) * 100);
  const base = g.startWords ?? 0;
  const expected = Math.round(base + ((g.finalWords ?? 0) - base) * (elapsed / totalDays));
  return { perDay, wordPct, timePct, delta: (g.current ?? 0) - expected };
}

function deadlineProgress(g: GoalRecord): Extract<GoalProgress, { family: "deadline" }> {
  const { valid, totalDays, elapsed, daysLeft } = calcDeadlineDates(g);
  const due = new Date((g.date ?? "") + "T00:00:00");
  const { perDay, wordPct, timePct, delta } = calcDeadlineRates(g, daysLeft, totalDays, elapsed);
  return {
    family: "deadline", valid, daysLeft, perDay, wordPct, timePct, delta,
    current: g.current ?? 0, finalWords: g.finalWords ?? 0, due,
  };
}

/**
 * Derive normalized, display-ready progress for any GoalRecord.
 * Pure — no side-effects. Mirrors design-reference/data.jsx goalProgress().
 */
export function goalProgress(g: GoalRecord): GoalProgress {
  const meta = GOAL_META[g.type];
  const fam: GoalFamily = meta ? meta.family : "amount";
  if (fam === "amount") return amountProgress(g);
  if (fam === "deadline") return deadlineProgress(g);
  return {
    family: "streak",
    days: g.streakDays ?? 0,
    best: g.best ?? 0,
    week: g.week ?? [],
    milestone: g.milestone ?? null,
  };
}

/** One-line summary. Mirrors design-reference/data.jsx goalSummary(). */
export function goalSummary(g: GoalRecord): string {
  const p = goalProgress(g);
  if (p.family === "amount") {
    const u = p.unit === "minutes" ? "min" : "words";
    return p.target > 0 ? `${p.target.toLocaleString()} ${u} ${p.period}` : "No target set";
  }
  if (p.family === "deadline") {
    return `${p.perDay.toLocaleString()} words/day · ${p.daysLeft} days left`;
  }
  return (
    (p.days > 0 ? `${p.days}-day streak` : "Not started yet") +
    (p.milestone ? ` · aiming for ${p.milestone}` : "")
  );
}

/**
 * Read which days of the given month the goal was met for a scope target.
 * Returns a Set of 1-based day numbers. Used by CalHeatMap.
 */
export function readMonthlyMetDays(
  key: ScopedGoalKey,
  year: number,
  month: number,
): Set<number> {
  const met = new Set<number>();
  const daysIn = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysIn; d++) {
    const dateStr = [year, String(month + 1).padStart(2, "0"), String(d).padStart(2, "0")].join("-");
    const k = `writing.goal.met.${key.projectId}.${key.scope}.${encodeTargetId(key.targetId)}.${dateStr}`;
    if (localStorage.getItem(k) === "1") met.add(d);
  }
  return met;
}

// ── Scope-aware public API ────────────────────────────────────────────────────

export function ensureDailyBaselineScoped(key: ScopedGoalKey, currentTotal: number): void {
  const storageKey = baselineKey(key, today());
  if (localStorage.getItem(storageKey) === null) {
    localStorage.setItem(storageKey, String(currentTotal));
  }
}

export function readDailyWordsScoped(key: ScopedGoalKey, currentTotal: number): number {
  const stored = localStorage.getItem(baselineKey(key, today()));
  if (stored === null) return 0;
  const baseline = parseInt(stored, 10);
  return Math.max(0, currentTotal - (Number.isFinite(baseline) ? baseline : currentTotal));
}

export function dailyWordsScoped(key: ScopedGoalKey, currentTotal: number): number {
  ensureDailyBaselineScoped(key, currentTotal);
  return readDailyWordsScoped(key, currentTotal);
}

export function recordGoalMetScoped(key: ScopedGoalKey): void {
  localStorage.setItem(metKey(key, today()), "1");
}

export function goalStreakScoped(key: ScopedGoalKey): number {
  let streak = 0;
  const msPerDay = 86_400_000;
  const now = Date.now();
  for (let i = 0; i < 3650; i++) {
    const date = new Date(now - i * msPerDay).toLocaleDateString("sv");
    if (localStorage.getItem(metKey(key, date)) === "1") streak++;
    else break;
  }
  return streak;
}

// ── Backward-compat shims (manuscript scope) ──────────────────────────────────

const manuscriptKey = (projectId: string): ScopedGoalKey => ({
  projectId, scope: "manuscript", targetId: null,
});

/** @deprecated Use ensureDailyBaselineScoped. */
export function ensureDailyBaseline(projectId: string, currentTotal: number): void {
  ensureDailyBaselineScoped(manuscriptKey(projectId), currentTotal);
}

/** @deprecated Use readDailyWordsScoped. */
export function readDailyWords(projectId: string, currentTotal: number): number {
  return readDailyWordsScoped(manuscriptKey(projectId), currentTotal);
}

/** @deprecated Use dailyWordsScoped. */
export function dailyWords(projectId: string, currentTotal: number): number {
  return dailyWordsScoped(manuscriptKey(projectId), currentTotal);
}

/** @deprecated Use recordGoalMetScoped. */
export function recordGoalMet(projectId: string): void {
  recordGoalMetScoped(manuscriptKey(projectId));
}

/** @deprecated Use goalStreakScoped. */
export function goalStreak(projectId: string): number {
  return goalStreakScoped(manuscriptKey(projectId));
}
