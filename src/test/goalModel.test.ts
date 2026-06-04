// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dailyWords,
  dailyWordsScoped,
  goalStreak,
  goalStreakScoped,
  recordGoalMet,
  recordGoalMetScoped,
  type ScopedGoalKey,
} from "../features/goals/goalModel";

// ── Setup ─────────────────────────────────────────────────────────────────────

const PROJECT = "proj-test-123";

// Must match goalModel.ts today() — local calendar date, not UTC.
function dateKey(daysAgo: number): string {
  const ms = Date.now() - daysAgo * 86_400_000;
  return new Date(ms).toLocaleDateString("sv");
}

// Canonical scoped key for manuscript scope.
function msKey(projectId: string): ScopedGoalKey {
  return { projectId, scope: "manuscript", targetId: null };
}

// Canonical localStorage key format: writing.goal.baseline.<projectId>.<scope>.<targetId|_>.<date>
function baselineStorageKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.baseline.${key.projectId}.${key.scope}.${key.targetId ?? "_"}.${date}`;
}

function metStorageKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.met.${key.projectId}.${key.scope}.${key.targetId ?? "_"}.${date}`;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ── dailyWords (legacy shim — maps to manuscript scope) ───────────────────────

describe("dailyWords", () => {
  it("returns 0 on the first call of the day (baseline set to current total)", () => {
    const words = dailyWords(PROJECT, 1000);
    expect(words).toBe(0);
  });

  it("sets baseline in localStorage using scoped key on first call", () => {
    dailyWords(PROJECT, 1000);
    const today = dateKey(0);
    const raw = localStorage.getItem(baselineStorageKey(msKey(PROJECT), today));
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
    // Simulate yesterday's baseline under the new scoped key format.
    const yesterday = dateKey(1);
    localStorage.setItem(baselineStorageKey(msKey(PROJECT), yesterday), "900");

    // Today: first call sets today's baseline at current total
    dailyWords(PROJECT, 1000); // sets today's baseline = 1000
    const words = dailyWords(PROJECT, 1050);
    expect(words).toBe(50);
  });

  it("baseline key uses local calendar date (not UTC) — format YYYY-MM-DD", () => {
    dailyWords(PROJECT, 500);
    const localDate = new Date().toLocaleDateString("sv");
    expect(localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const raw = localStorage.getItem(baselineStorageKey(msKey(PROJECT), localDate));
    expect(raw).toBe("500");
  });
});

// ── dailyWordsScoped — scope keying ──────────────────────────────────────────

describe("dailyWordsScoped — scope dimension", () => {
  it("manuscript scope and scene scope are keyed independently for the same project", () => {
    const msGoalKey: ScopedGoalKey = { projectId: PROJECT, scope: "manuscript", targetId: null };
    const sceneGoalKey: ScopedGoalKey = { projectId: PROJECT, scope: "scene", targetId: "scene-1" };

    // Seed both with different baselines
    dailyWordsScoped(msGoalKey, 1000); // ms baseline = 1000
    dailyWordsScoped(sceneGoalKey, 200); // scene baseline = 200

    const msWords = dailyWordsScoped(msGoalKey, 1100); // ms delta = 100
    const sceneWords = dailyWordsScoped(sceneGoalKey, 250); // scene delta = 50

    expect(msWords).toBe(100);
    expect(sceneWords).toBe(50);
  });

  it("chapter scope with folderId is keyed independently from another chapter", () => {
    const ch1: ScopedGoalKey = { projectId: PROJECT, scope: "chapter", targetId: "ch-1" };
    const ch2: ScopedGoalKey = { projectId: PROJECT, scope: "chapter", targetId: "ch-2" };

    dailyWordsScoped(ch1, 300);
    dailyWordsScoped(ch2, 500);

    expect(dailyWordsScoped(ch1, 350)).toBe(50);
    expect(dailyWordsScoped(ch2, 600)).toBe(100);
  });

  it("baseline key for scene scope encodes targetId correctly", () => {
    const key: ScopedGoalKey = { projectId: "p1", scope: "scene", targetId: "s-abc" };
    dailyWordsScoped(key, 42);
    const today = dateKey(0);
    const raw = localStorage.getItem(baselineStorageKey(key, today));
    expect(raw).toBe("42");
  });

  it("baseline key for manuscript scope encodes targetId as '_'", () => {
    const key: ScopedGoalKey = { projectId: "p1", scope: "manuscript", targetId: null };
    dailyWordsScoped(key, 99);
    const today = dateKey(0);
    const raw = localStorage.getItem(baselineStorageKey(key, today));
    expect(raw).toBe("99");
  });

  it("returns 0 (clamped) when scope total drops below baseline", () => {
    const key: ScopedGoalKey = { projectId: PROJECT, scope: "scene", targetId: "s-1" };
    dailyWordsScoped(key, 500);
    expect(dailyWordsScoped(key, 400)).toBe(0);
  });
});

// ── recordGoalMet + goalStreak (legacy shim) ──────────────────────────────────

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
    localStorage.setItem(metStorageKey(msKey(PROJECT), yesterday), "1");
    recordGoalMet(PROJECT);
    expect(goalStreak(PROJECT)).toBe(2);
  });

  it("breaks the streak on a gap day — today met, 2 days ago met, yesterday NOT", () => {
    const twoDaysAgo = dateKey(2);
    localStorage.setItem(metStorageKey(msKey(PROJECT), twoDaysAgo), "1");
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

// ── goalStreakScoped — scope keying ───────────────────────────────────────────

describe("goalStreakScoped — scope dimension", () => {
  it("streak for scene scope is independent from manuscript scope", () => {
    const msGoalKey: ScopedGoalKey = { projectId: PROJECT, scope: "manuscript", targetId: null };
    const sceneGoalKey: ScopedGoalKey = { projectId: PROJECT, scope: "scene", targetId: "s-2" };

    recordGoalMetScoped(msGoalKey);
    // scene scope has NOT been marked met
    expect(goalStreakScoped(msGoalKey)).toBe(1);
    expect(goalStreakScoped(sceneGoalKey)).toBe(0);
  });

  it("returns 2 when two consecutive days met for a scene scope", () => {
    const key: ScopedGoalKey = { projectId: PROJECT, scope: "scene", targetId: "s-3" };
    const yesterday = dateKey(1);
    localStorage.setItem(metStorageKey(key, yesterday), "1");
    recordGoalMetScoped(key);
    expect(goalStreakScoped(key)).toBe(2);
  });
});
