/**
 * goalModel.ts — daily goal progress model (localStorage-only; no migration).
 *
 * Wave 27 additions: GoalRecord, GoalProgress, goalProgress(), goalSummary(),
 * readMonthlyMetDays() — family-aware progress derivation for the adaptive
 * Goals editor + inspector visualizations.
 */

import {
  baselineKey,
  goalStreakFrom,
  metKey,
  readDailyWordsFrom,
  readMonthlyMetDaysFrom,
  type ScopedGoalKey,
} from "./goalProgress";

export * from "./goalProgress";

function today(): string {
  return new Date().toLocaleDateString("sv");
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
  return readMonthlyMetDaysFrom(localStorage, key, year, month);
}

// ── Scope-aware public API ────────────────────────────────────────────────────

export function ensureDailyBaselineScoped(key: ScopedGoalKey, currentTotal: number): void {
  const storageKey = baselineKey(key, today());
  if (localStorage.getItem(storageKey) === null) {
    localStorage.setItem(storageKey, String(currentTotal));
  }
}

export function readDailyWordsScoped(key: ScopedGoalKey, currentTotal: number): number {
  return readDailyWordsFrom(localStorage, key, currentTotal, today());
}

export function dailyWordsScoped(key: ScopedGoalKey, currentTotal: number): number {
  ensureDailyBaselineScoped(key, currentTotal);
  return readDailyWordsScoped(key, currentTotal);
}

export function recordGoalMetScoped(key: ScopedGoalKey): void {
  localStorage.setItem(metKey(key, today()), "1");
}

export function goalStreakScoped(key: ScopedGoalKey): number {
  return goalStreakFrom(localStorage, key, Date.now());
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
