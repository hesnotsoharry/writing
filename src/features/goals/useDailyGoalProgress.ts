/**
 * useDailyGoalProgress — derived goal state for Lane 20 (inspector ring) and
 * Lane 21 (status-bar goal section + Goals modal).
 *
 * Returns:
 *   words   — words written today (max 0)
 *   target  — goal target word count (0 = not set)
 *   pct     — progress as 0–1 fraction (capped at 1.0)
 *   on      — whether the user has goals enabled
 *   streak  — consecutive days the goal was met
 *
 * React 19 correctness: localStorage writes (baseline snapshot + goal-met stamp)
 * live in `useEffect`s; `useMemo` contains only pure reads.
 */

import { useEffect, useMemo } from "react";

import {
  ensureDailyBaseline,
  goalStreak,
  readDailyWords,
  recordGoalMet,
} from "./goalModel";
import { readGoalsOn,readGoalTarget } from "./goalStorage";

export function useDailyGoalProgress(args: {
  projectId: string;
  currentTotal: number;
}): { words: number; target: number; pct: number; on: boolean; streak: number } {
  const { projectId, currentTotal } = args;

  // Write side-effect 1: ensure today's baseline is recorded.
  // Idempotent — only writes on the first call for a new calendar day.
  useEffect(() => {
    ensureDailyBaseline(projectId, currentTotal);
  }, [projectId, currentTotal]);

  // Pure derived state — no writes.
  const result = useMemo(() => {
    const on = readGoalsOn();
    const target = readGoalTarget();
    const words = readDailyWords(projectId, currentTotal);
    const pct = target > 0 ? Math.min(1, words / target) : 0;
    const streak = goalStreak(projectId);
    return { words, target, pct, on, streak };
  }, [projectId, currentTotal]);

  // Write side-effect 2: stamp goal-met when threshold is crossed.
  // Idempotent — safe to run on every render once met.
  useEffect(() => {
    if (result.on && result.target > 0 && result.words >= result.target) {
      recordGoalMet(projectId);
    }
  }, [projectId, result.on, result.target, result.words]);

  return result;
}
