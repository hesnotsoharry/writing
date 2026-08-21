import { describe, expect, it } from "vitest";

import {
  EMPTY_LOCAL_STATE,
  type GoalLocalPersistence,
  type GoalLocalState,
  localCalendarDate,
  persistSessionToggle,
  recordGoalDay,
  SESSION_STATE_ID,
  sessionGoalId,
} from "./goalLocalState";

function memoryPersistence(): GoalLocalPersistence & { saved: Map<string, GoalLocalState> } {
  const saved = new Map<string, GoalLocalState>();
  return {
    saved,
    read: async (id) => saved.get(id) ?? null,
    write: async (id, value) => { saved.set(id, value); },
  };
}

describe("device-local goal state", () => {
  it("formats an injected instant as a local calendar date", () => {
    expect(localCalendarDate(new Date(2026, 7, 9, 23, 59))).toBe("2026-08-09");
  });

  it("delegates streak math to shared streakLogic and persists locally", async () => {
    const saved: GoalLocalState[] = [];
    const persistence = {
      read: async () => saved.at(-1) ?? null,
      write: async (_id: string, value: GoalLocalState) => { saved.push(value); },
    };
    await recordGoalDay(persistence, "goal", "2026-08-08", true);
    await recordGoalDay(persistence, "goal", "2026-08-09", true);
    expect(saved.at(-1)?.streak).toEqual({ count: 2, lastMetDate: "2026-08-09" });
    expect(saved.at(-1)?.metDays).toEqual(["2026-08-08", "2026-08-09"]);
  });
});

describe("session-goal toggle persistence", () => {
  it("records the sitting so the switch survives leaving the screen", async () => {
    const store = memoryPersistence();
    const on = await persistSessionToggle(store, SESSION_STATE_ID, true, 1_700_000_000_000);
    expect(on.sessionStartedAt).toBe(1_700_000_000_000);
    expect((await store.read(SESSION_STATE_ID))?.sessionStartedAt).toBe(1_700_000_000_000);

    const off = await persistSessionToggle(store, SESSION_STATE_ID, false, 1_700_000_100_000);
    expect(off.sessionStartedAt).toBeNull();
    expect(off.sessionWords).toBe(0);
  });

  it("keeps a stable persistence id when no session-type goal exists", () => {
    expect(sessionGoalId([])).toBe(SESSION_STATE_ID);
    expect(sessionGoalId([{ id: "daily-1", type: "daily" }])).toBe(SESSION_STATE_ID);
    expect(sessionGoalId([{ id: "sess-1", type: "session" }])).toBe("sess-1");
  });

  it("round-trips the sitting flag even when no goal row exists yet", async () => {
    const persistence = memoryPersistence();
    const on = await persistSessionToggle(persistence, SESSION_STATE_ID, true, 99);
    expect(on.sessionStartedAt).toBe(99);
    expect(await persistence.read(SESSION_STATE_ID)).toEqual(on);
    const off = await persistSessionToggle(persistence, SESSION_STATE_ID, false, 100);
    expect(off).toMatchObject({ ...EMPTY_LOCAL_STATE, sessionStartedAt: null, sessionWords: 0 });
  });
});
