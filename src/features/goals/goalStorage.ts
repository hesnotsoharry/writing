/**
 * localStorage mirror helpers for goal UI state.
 *
 * Global keys (legacy — back-compat shims map these to scope='manuscript'):
 *   writing.goalTarget — the active word-count target
 *   writing.goalsOn    — whether goals are enabled for the current session
 *
 * Per-scope keys (Wave 25):
 *   writing.goal.config.<projectId>.<scope> — JSON { on: boolean, target: number }
 *
 * Back-compat: readGoalTarget / readGoalsOn / writeGoalTarget / writeGoalsOn
 * continue to work exactly as before — they delegate to the global keys.
 * New code should use readGoalConfig / writeGoalConfig.
 */

import type { GoalScope } from "./goalModel";

const GOAL_TARGET_KEY = "writing.goalTarget";
const GOALS_ON_KEY = "writing.goalsOn";

/** { on, target } config stored per project+scope. */
export interface GoalConfig {
  on: boolean;
  target: number;
}

// ── Per-scope API (Wave 25) ───────────────────────────────────────────────────

function goalConfigKey(projectId: string, scope: GoalScope): string {
  return `writing.goal.config.${projectId}.${scope}`;
}

/**
 * Read the goal config for a given project + scope.
 * Falls back to the global target/on keys when scope is 'manuscript' and no
 * per-scope record exists yet, ensuring back-compat for existing sessions.
 */
export function readGoalConfig(projectId: string, scope: GoalScope): GoalConfig {
  const raw = localStorage.getItem(goalConfigKey(projectId, scope));
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as Partial<GoalConfig>;
      const on = typeof parsed.on === "boolean" ? parsed.on : false;
      const target = typeof parsed.target === "number" && Number.isFinite(parsed.target)
        ? parsed.target
        : 0;
      return { on, target };
    } catch {
      // malformed — fall through to defaults
    }
  }

  // Back-compat: for manuscript scope, fall back to the global keys
  if (scope === "manuscript") {
    return { on: readGoalsOn(), target: readGoalTarget() };
  }

  // Other scopes default to off / 0
  return { on: false, target: 0 };
}

/**
 * Write the goal config for a given project + scope.
 * For manuscript scope, also writes the legacy global keys to keep existing
 * consumers (e.g. goalStorage shims, old code reading GOALS_ON_KEY directly)
 * consistent.
 */
export function writeGoalConfig(projectId: string, scope: GoalScope, config: GoalConfig): void {
  localStorage.setItem(goalConfigKey(projectId, scope), JSON.stringify(config));
  // Mirror manuscript scope to legacy global keys for back-compat
  if (scope === "manuscript") {
    localStorage.setItem(GOAL_TARGET_KEY, String(config.target));
    localStorage.setItem(GOALS_ON_KEY, String(config.on));
  }
}

// ── Legacy global API (back-compat shims) ────────────────────────────────────

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
