/**
 * useDailyGoalProgress — derived goal state for Lane 20 (inspector ring) and
 * Lane 21 (status-bar goal section + Goals modal).
 *
 * Signature (Wave 25 — scope-aware):
 *   useDailyGoalProgress({ projectId, scope, targetId, currentScopeTotal })
 *
 * The caller supplies `currentScopeTotal` for the chosen scope:
 *   - manuscript → sum of all scenes
 *   - chapter    → sum of scenes in the chapter
 *   - scene      → word count of that scene
 *
 * Returns:
 *   words   — words written today in the scope (max 0)
 *   target  — goal target word count (0 = not set)
 *   pct     — progress as 0–1 fraction (capped at 1.0, rounded to 4dp)
 *   on      — whether goals are enabled for this scope
 *   streak  — consecutive days the goal was met for this scope
 *
 * React 19 correctness: localStorage writes (baseline snapshot + goal-met stamp)
 * live in `useEffect`s; `useMemo` contains only pure reads.
 */

import { useEffect, useMemo } from "react";

import type { GoalScope } from "./goalModel";
import {
  ensureDailyBaselineScoped,
  goalStreakScoped,
  readDailyWordsScoped,
  recordGoalMetScoped,
} from "./goalModel";
import { readGoalConfig } from "./goalStorage";

// ── Public arg type ───────────────────────────────────────────────────────────

export interface DailyGoalProgressArgs {
  projectId: string;
  scope: GoalScope;
  /** null for manuscript; folderId for chapter; sceneId for scene. */
  targetId: string | null;
  currentScopeTotal: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDailyGoalProgress(
  args: DailyGoalProgressArgs,
): { words: number; target: number; pct: number; on: boolean; streak: number } {
  const { projectId, scope, targetId, currentScopeTotal } = args;

  const key = useMemo(
    () => ({ projectId, scope, targetId }),
    [projectId, scope, targetId],
  );

  // Write side-effect 1: ensure today's baseline is recorded.
  // Idempotent — only writes on the first call for a new calendar day.
  useEffect(() => {
    ensureDailyBaselineScoped(key, currentScopeTotal);
  }, [key, currentScopeTotal]);

  // Pure derived state — no writes.
  const result = useMemo(() => {
    const config = readGoalConfig(projectId, scope);
    const { on, target } = config;
    const words = readDailyWordsScoped(key, currentScopeTotal);
    const rawPct = target > 0 ? Math.min(1, words / target) : 0;
    // Round to 4 decimal places to eliminate float artifacts (e.g. 0.8999999999999999).
    const pct = Math.round(rawPct * 10000) / 10000;
    const streak = goalStreakScoped(key);
    return { words, target, pct, on, streak };
  }, [key, projectId, scope, currentScopeTotal]);

  // Write side-effect 2: stamp goal-met when threshold is crossed.
  // Idempotent — safe to run on every render once met.
  useEffect(() => {
    if (result.on && result.target > 0 && result.words >= result.target) {
      recordGoalMetScoped(key);
    }
  }, [key, result.on, result.target, result.words]);

  return result;
}
