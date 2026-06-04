// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ScopedGoalKey } from "../features/goals/goalModel";
import { writeGoalsOn, writeGoalTarget } from "../features/goals/goalStorage";
import { useDailyGoalProgress } from "../features/goals/useDailyGoalProgress";

/**
 * useDailyGoalProgress — unit tests.
 *
 * Contract (Wave 25):
 *   { words, target, pct, on, streak }
 *   - words = max(0, currentScopeTotal − today's scope baseline)
 *   - pct   = min(1, words / target) when target > 0; else 0; rounded to 4dp
 *   - on    = readGoalConfig(projectId, scope).on
 *   - streak = consecutive days met for this scope
 *   - baseline write happens once per day (effect, not memo)
 *
 * Call sites use { projectId, scope, targetId, currentScopeTotal }.
 * For manuscript scope, the legacy global keys (writeGoalTarget / writeGoalsOn)
 * still set the config because readGoalConfig falls back to them.
 */

const PROJECT = "test-proj-daily";

// Local date string matching goalModel.ts today()
function localToday(): string {
  return new Date().toLocaleDateString("sv");
}

// Canonical scoped baseline key used internally by goalModel.
function scopedBaselineKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.baseline.${key.projectId}.${key.scope}.${key.targetId ?? "_"}.${date}`;
}

function scopedMetKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.met.${key.projectId}.${key.scope}.${key.targetId ?? "_"}.${date}`;
}

const MS_KEY: ScopedGoalKey = { projectId: PROJECT, scope: "manuscript", targetId: null };

afterEach(() => {
  localStorage.clear();
});

describe("useDailyGoalProgress — manuscript scope (back-compat via global keys)", () => {
  it("returns words=0 before baseline is set (first render, effect not yet fired)", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 1000 }),
    );
    // Before the effect fires, readDailyWordsScoped returns 0 (no baseline stored)
    expect(result.current.words).toBe(0);
  });

  it("baseline is written to localStorage (scoped key) after effect fires", () => {
    writeGoalsOn(false);
    writeGoalTarget(0);
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 800 }),
    );
    act(() => {}); // flush effects
    const stored = localStorage.getItem(scopedBaselineKey(MS_KEY, localToday()));
    expect(stored).toBe("800");
  });

  it("pct is clamped to 1.0 when words exceed target", () => {
    writeGoalsOn(true);
    writeGoalTarget(100);
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "0");
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 200 }),
    );
    expect(result.current.pct).toBe(1);
    expect(result.current.words).toBe(200);
  });

  it("pct is 0 when target is 0 (no division by zero)", () => {
    writeGoalsOn(true);
    writeGoalTarget(0);
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "0");
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 500 }),
    );
    expect(result.current.pct).toBe(0);
  });

  it("pct is fractional when words < target", () => {
    writeGoalsOn(true);
    writeGoalTarget(400);
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "0");
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 100 }),
    );
    expect(result.current.pct).toBeCloseTo(0.25);
  });

  it("pct has no float artifact — 300/400 = 0.75 exactly, not 0.7499…", () => {
    writeGoalsOn(true);
    writeGoalTarget(400);
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "0");
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 300 }),
    );
    // 300/400 = 0.75 exactly — no float artifact. Rounded to 4dp.
    expect(result.current.pct).toBe(0.75);
  });

  it("on reflects readGoalsOn — false when goals disabled", () => {
    writeGoalsOn(false);
    writeGoalTarget(500);
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 1000 }),
    );
    expect(result.current.on).toBe(false);
  });

  it("on reflects readGoalsOn — true when goals enabled", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 1000 }),
    );
    expect(result.current.on).toBe(true);
  });

  it("streak is 0 when no days have been marked met", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 100 }),
    );
    expect(result.current.streak).toBe(0);
  });

  it("goal-met is stamped (scoped key) after effect fires when words >= target", () => {
    writeGoalsOn(true);
    writeGoalTarget(100);
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "0");
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 150 }),
    );
    act(() => {});
    expect(localStorage.getItem(scopedMetKey(MS_KEY, localToday()))).toBe("1");
  });

  it("goal-met is NOT stamped when words < target", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "0");
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 100 }),
    );
    act(() => {});
    expect(localStorage.getItem(scopedMetKey(MS_KEY, localToday()))).toBeNull();
  });

  it("goal-met is NOT stamped when goalsOn is false even if words >= target", () => {
    writeGoalsOn(false);
    writeGoalTarget(100);
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "0");
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, scope: "manuscript", targetId: null, currentScopeTotal: 200 }),
    );
    act(() => {});
    expect(localStorage.getItem(scopedMetKey(MS_KEY, localToday()))).toBeNull();
  });
});

describe("useDailyGoalProgress — scene scope is independent from manuscript scope", () => {
  const SCENE_KEY: ScopedGoalKey = { projectId: PROJECT, scope: "scene", targetId: "scene-abc" };

  it("scene scope uses its own baseline, not the manuscript one", () => {
    // Pre-seed manuscript baseline to 1000
    localStorage.setItem(scopedBaselineKey(MS_KEY, localToday()), "1000");
    // Scene baseline is 200
    localStorage.setItem(scopedBaselineKey(SCENE_KEY, localToday()), "200");

    // Write per-scope config for scene
    localStorage.setItem(
      `writing.goal.config.${PROJECT}.scene`,
      JSON.stringify({ on: true, target: 50 }),
    );

    const { result } = renderHook(() =>
      useDailyGoalProgress({
        projectId: PROJECT,
        scope: "scene",
        targetId: "scene-abc",
        currentScopeTotal: 230, // 230 - 200 = 30 scene words
      }),
    );
    // scene words = 30, not manuscript delta
    expect(result.current.words).toBe(30);
    expect(result.current.target).toBe(50);
    expect(result.current.pct).toBeCloseTo(0.6);
  });

  it("scene scope pct is clean — no float artifact for 30/50", () => {
    localStorage.setItem(scopedBaselineKey(SCENE_KEY, localToday()), "200");
    localStorage.setItem(
      `writing.goal.config.${PROJECT}.scene`,
      JSON.stringify({ on: true, target: 50 }),
    );
    const { result } = renderHook(() =>
      useDailyGoalProgress({
        projectId: PROJECT,
        scope: "scene",
        targetId: "scene-abc",
        currentScopeTotal: 230,
      }),
    );
    // 30/50 = 0.6 exactly
    expect(result.current.pct).toBe(0.6);
  });
});
