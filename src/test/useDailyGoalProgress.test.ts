// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { writeGoalsOn,writeGoalTarget } from "../features/goals/goalStorage";
import { useDailyGoalProgress } from "../features/goals/useDailyGoalProgress";

/**
 * useDailyGoalProgress — unit tests.
 *
 * Contract (coordination doc § WAVE 17):
 *   { words, target, pct, on, streak }
 *   - words = max(0, currentTotal − today's baseline)
 *   - pct   = min(1, words / target) when target > 0; else 0
 *   - on    = readGoalsOn()
 *   - streak = consecutive days met
 *   - baseline write happens once per day (effect, not memo)
 */

const PROJECT = "test-proj-daily";

afterEach(() => {
  localStorage.clear();
});

// Helper: local date string matching goalModel.ts today()
function localToday(): string {
  return new Date().toLocaleDateString("sv");
}

describe("useDailyGoalProgress", () => {
  it("returns words=0 before baseline is set (first render, effect not yet fired)", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    // Synchronous render — effect not fired yet, no baseline in storage
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 1000 })
    );
    // Before the effect fires, readDailyWords returns 0 (no baseline stored)
    expect(result.current.words).toBe(0);
  });

  it("baseline is written to localStorage after effect fires", () => {
    writeGoalsOn(false);
    writeGoalTarget(0);
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 800 })
    );
    // After act(), effects have flushed
    act(() => {}); // flush effects
    const stored = localStorage.getItem(`writing.goal.baseline.${PROJECT}.${localToday()}`);
    expect(stored).toBe("800");
  });

  it("pct is clamped to 1.0 when words exceed target", () => {
    writeGoalsOn(true);
    writeGoalTarget(100);
    // Pre-seed a baseline so readDailyWords returns a positive delta
    localStorage.setItem(`writing.goal.baseline.${PROJECT}.${localToday()}`, "0");
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 200 })
    );
    // words = 200 - 0 = 200; target = 100; pct should be 1.0 (capped)
    expect(result.current.pct).toBe(1);
    expect(result.current.words).toBe(200);
  });

  it("pct is 0 when target is 0 (no division by zero)", () => {
    writeGoalsOn(true);
    writeGoalTarget(0);
    localStorage.setItem(`writing.goal.baseline.${PROJECT}.${localToday()}`, "0");
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 500 })
    );
    expect(result.current.pct).toBe(0);
  });

  it("pct is fractional when words < target", () => {
    writeGoalsOn(true);
    writeGoalTarget(400);
    localStorage.setItem(`writing.goal.baseline.${PROJECT}.${localToday()}`, "0");
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 100 })
    );
    expect(result.current.pct).toBeCloseTo(0.25);
  });

  it("on reflects readGoalsOn — false when goals disabled", () => {
    writeGoalsOn(false);
    writeGoalTarget(500);
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 1000 })
    );
    expect(result.current.on).toBe(false);
  });

  it("on reflects readGoalsOn — true when goals enabled", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 1000 })
    );
    expect(result.current.on).toBe(true);
  });

  it("streak is 0 when no days have been marked met", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    const { result } = renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 100 })
    );
    expect(result.current.streak).toBe(0);
  });

  it("goal-met is stamped after effect fires when words >= target", () => {
    writeGoalsOn(true);
    writeGoalTarget(100);
    localStorage.setItem(`writing.goal.baseline.${PROJECT}.${localToday()}`, "0");
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 150 })
    );
    act(() => {});
    const metKey = `writing.goal.met.${PROJECT}.${localToday()}`;
    expect(localStorage.getItem(metKey)).toBe("1");
  });

  it("goal-met is NOT stamped when words < target", () => {
    writeGoalsOn(true);
    writeGoalTarget(500);
    localStorage.setItem(`writing.goal.baseline.${PROJECT}.${localToday()}`, "0");
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 100 })
    );
    act(() => {});
    const metKey = `writing.goal.met.${PROJECT}.${localToday()}`;
    expect(localStorage.getItem(metKey)).toBeNull();
  });

  it("goal-met is NOT stamped when goalsOn is false even if words >= target", () => {
    writeGoalsOn(false);
    writeGoalTarget(100);
    localStorage.setItem(`writing.goal.baseline.${PROJECT}.${localToday()}`, "0");
    renderHook(() =>
      useDailyGoalProgress({ projectId: PROJECT, currentTotal: 200 })
    );
    act(() => {});
    const metKey = `writing.goal.met.${PROJECT}.${localToday()}`;
    expect(localStorage.getItem(metKey)).toBeNull();
  });
});
