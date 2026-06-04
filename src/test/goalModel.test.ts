// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { dailyWords, goalStreak, recordGoalMet } from "../features/goals/goalModel";

// ── Setup ─────────────────────────────────────────────────────────────────────

const PROJECT = "proj-test-123";

// Must match goalModel.ts today() — local calendar date, not UTC.
function dateKey(daysAgo: number): string {
  const ms = Date.now() - daysAgo * 86_400_000;
  return new Date(ms).toLocaleDateString("sv");
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ── dailyWords ────────────────────────────────────────────────────────────────

describe("dailyWords", () => {
  it("returns 0 on the first call of the day (baseline set to current total)", () => {
    const words = dailyWords(PROJECT, 1000);
    expect(words).toBe(0);
  });

  it("sets baseline in localStorage on first call", () => {
    dailyWords(PROJECT, 1000);
    const today = dateKey(0);
    const raw = localStorage.getItem(`writing.goal.baseline.${PROJECT}.${today}`);
    expect(raw).toBe("1000");
  });

  it("returns delta on second call same day", () => {
    dailyWords(PROJECT, 1000); // sets baseline = 1000
    const words = dailyWords(PROJECT, 1320);
    expect(words).toBe(320);
  });

  it("returns max(0, …) — never negative when total drops below baseline", () => {
    dailyWords(PROJECT, 1000); // sets baseline = 1000
    const words = dailyWords(PROJECT, 800);
    expect(words).toBe(0);
  });

  it("returns 0 when total equals baseline (no change)", () => {
    dailyWords(PROJECT, 500);
    const words = dailyWords(PROJECT, 500);
    expect(words).toBe(0);
  });

  it("uses a separate baseline per project", () => {
    dailyWords("proj-a", 100);
    dailyWords("proj-b", 200);
    const aWords = dailyWords("proj-a", 150);
    const bWords = dailyWords("proj-b", 250);
    expect(aWords).toBe(50);
    expect(bWords).toBe(50);
  });

  it("a new day resets the baseline (different date key)", () => {
    // Simulate yesterday's baseline
    const yesterday = dateKey(1);
    localStorage.setItem(`writing.goal.baseline.${PROJECT}.${yesterday}`, "900");

    // Today: first call sets today's baseline at current total
    dailyWords(PROJECT, 1000); // sets today's baseline = 1000
    const words = dailyWords(PROJECT, 1050);
    expect(words).toBe(50);
  });

  it("baseline key uses local calendar date (not UTC) — format YYYY-MM-DD", () => {
    dailyWords(PROJECT, 500);
    // The local date matches toLocaleDateString('sv') — must match the key written.
    const localDate = new Date().toLocaleDateString("sv");
    expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const raw = localStorage.getItem(`writing.goal.baseline.${PROJECT}.${localDate}`);
    expect(raw).toBe("500");
  });
});

// ── recordGoalMet + goalStreak ─────────────────────────────────────────────────

describe("goalStreak", () => {
  it("returns 0 when no days are marked met", () => {
    expect(goalStreak(PROJECT)).toBe(0);
  });

  it("returns 1 when only today is marked met", () => {
    recordGoalMet(PROJECT);
    expect(goalStreak(PROJECT)).toBe(1);
  });

  it("returns 2 when today and yesterday are marked met", () => {
    const yesterday = dateKey(1);
    localStorage.setItem(`writing.goal.met.${PROJECT}.${yesterday}`, "1");
    recordGoalMet(PROJECT);
    expect(goalStreak(PROJECT)).toBe(2);
  });

  it("breaks the streak on a gap day — today met, 2 days ago met, yesterday NOT", () => {
    const twoDaysAgo = dateKey(2);
    localStorage.setItem(`writing.goal.met.${PROJECT}.${twoDaysAgo}`, "1");
    recordGoalMet(PROJECT);
    // streak should be 1 (only today), because yesterday breaks the chain
    expect(goalStreak(PROJECT)).toBe(1);
  });

  it("recordGoalMet is idempotent — calling twice still yields streak of 1", () => {
    recordGoalMet(PROJECT);
    recordGoalMet(PROJECT);
    expect(goalStreak(PROJECT)).toBe(1);
  });
});
