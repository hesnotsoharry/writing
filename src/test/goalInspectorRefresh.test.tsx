// @vitest-environment jsdom
/**
 * goalInspectorRefresh.test.tsx
 *
 * Regression: wave-28 P6 "Delete goal" fires a real DB delete from the
 * inspector context menu but nothing refreshed the inspector afterward.
 *
 * Contracts locked here:
 *   1. After deleteGoal + GOALS_CHANGED_EVENT dispatch, GoalGroup returns null
 *      (the "Today's goal" section disappears without a project switch).
 *   2. When goals still exist after a delete + event, the section stays visible.
 *
 * Oracle: jsdom + RTL — valid here because this is React state, not ProseMirror
 * editor content (see memory: editor-behavior-needs-cdp-smoke-not-jsdom).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteGoalsStore } from "../db/sqliteGoalsStore";
import { writeGoalConfig } from "../features/goals/goalStorage";
import { GoalGroup } from "../features/goals/InspectorGoalRings";
import { GOALS_CHANGED_EVENT } from "../lib/settings";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

vi.mock("../db/schema", () => ({ getDb: vi.fn() }));

import { getDb } from "../db/schema";

const GOALS_DDL = `
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    goal_type TEXT NOT NULL,
    target INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )
`;

let db: SqlJsTestDb;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await db.execute(GOALS_DDL);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  // Enable manuscript ring so GoalGroup renders via anyGoalOn / useDailyGoalProgress.
  writeGoalConfig("p1", "manuscript", { on: true, target: 500 });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  db.close();
});

describe("GoalGroup — useInspectorGoals refreshes after GOALS_CHANGED_EVENT", () => {
  it("hides 'Today's goal' section after deleteGoal + event (defect: dep was [projectId] only)", async () => {
    const store = new SqliteGoalsStore();
    const goal = await store.upsertGoal({
      projectId: "p1",
      goalType: "daily",
      target: 500,
      enabled: true,
    });

    render(
      <GoalGroup
        projectId="p1"
        sceneId={null}
        manuscriptTotal={200}
        chapterId={null}
        chapterTotal={null}
        sceneWordCount={0}
      />,
    );

    // Section is visible: loaded=false on first render so GoalGroup does not
    // early-return, and the DB load resolves with the goal present.
    await screen.findByText(/today's goal/i);

    // Simulate what App.content.tsx's fixed deleteGoal handler does:
    // delete from DB then dispatch the event.
    await store.deleteGoal(goal.id);
    window.dispatchEvent(new CustomEvent(GOALS_CHANGED_EVENT));

    // GoalGroup must return null once loaded=true and goals=[].
    await waitFor(() => {
      expect(screen.queryByText(/today's goal/i)).toBeNull();
    });
  });

  it("keeps 'Today's goal' section visible when at least one goal remains after the event", async () => {
    const store = new SqliteGoalsStore();
    const g1 = await store.upsertGoal({
      projectId: "p1",
      goalType: "daily",
      target: 500,
      enabled: true,
    });
    await store.upsertGoal({
      projectId: "p1",
      goalType: "streak",
      target: 0,
      enabled: true,
    });

    render(
      <GoalGroup
        projectId="p1"
        sceneId={null}
        manuscriptTotal={200}
        chapterId={null}
        chapterTotal={null}
        sceneWordCount={0}
      />,
    );

    await screen.findByText(/today's goal/i);

    // Delete only one of the two goals.
    await store.deleteGoal(g1.id);
    window.dispatchEvent(new CustomEvent(GOALS_CHANGED_EVENT));

    // One goal remains — section must still be present.
    await waitFor(() => {
      expect(screen.queryByText(/today's goal/i)).not.toBeNull();
    });
  });

  it("shows 'Today's goal' section after a goal is created and GOALS_CHANGED_EVENT fires (create / saveGoal path)", async () => {
    // Start with no goals — GoalGroup should hide once the initial empty DB load
    // resolves (loaded=true, goals=[]).
    render(
      <GoalGroup
        projectId="p1"
        sceneId={null}
        manuscriptTotal={0}
        chapterId={null}
        chapterTotal={null}
        sceneWordCount={0}
      />,
    );

    // Wait for the initial DB load to complete: loaded=true, goals=[] → null.
    await waitFor(() => {
      expect(screen.queryByText(/today's goal/i)).toBeNull();
    });

    // Simulate what Goals.tsx's fixed saveGoal / finishGoal does:
    // write to DB then dispatch the event.
    const store = new SqliteGoalsStore();
    await store.upsertGoal({ projectId: "p1", goalType: "daily", target: 500, enabled: true });
    window.dispatchEvent(new CustomEvent(GOALS_CHANGED_EVENT));

    // Inspector must now reflect the new goal (re-fetched and found it).
    await screen.findByText(/today's goal/i);
  });
});
