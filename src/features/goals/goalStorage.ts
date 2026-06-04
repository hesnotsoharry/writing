/**
 * localStorage mirror helpers for goal UI state.
 *
 * writing.goalTarget — the active word-count target; consumed by the wave-9
 *   SceneInspector ring. Key MUST NOT be renamed without updating that consumer.
 * writing.goalsOn    — whether goals are enabled for the current session.
 */

const GOAL_TARGET_KEY = "writing.goalTarget";
const GOALS_ON_KEY = "writing.goalsOn";

/** Persist the active goal target (word count). */
export function writeGoalTarget(target: number): void {
  localStorage.setItem(GOAL_TARGET_KEY, String(target));
}

/** Read back the active goal target; returns 0 if not set. */
export function readGoalTarget(): number {
  const raw = localStorage.getItem(GOAL_TARGET_KEY);
  if (raw === null) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Read whether goals are enabled. Defaults to false if not set. */
export function readGoalsOn(): boolean {
  return localStorage.getItem(GOALS_ON_KEY) === "true";
}

/** Persist whether goals are enabled. */
export function writeGoalsOn(on: boolean): void {
  localStorage.setItem(GOALS_ON_KEY, String(on));
}
