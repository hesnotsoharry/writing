import { advanceStreak, type Streak } from "../../shared/streakLogic";

export interface GoalLocalState {
  baseline: number;
  metDays: string[];
  streak: Streak;
  sessionStartedAt: number | null;
  sessionWords: number;
}

export interface GoalLocalPersistence {
  read(goalId: string): Promise<GoalLocalState | null>;
  write(goalId: string, state: GoalLocalState): Promise<void>;
}

export const EMPTY_LOCAL_STATE: GoalLocalState = {
  baseline: 0,
  metDays: [],
  streak: { count: 0, lastMetDate: "" },
  sessionStartedAt: null,
  sessionWords: 0,
};

export async function recordGoalDay(
  persistence: GoalLocalPersistence,
  goalId: string,
  today: string,
  met: boolean,
): Promise<GoalLocalState> {
  const current = await persistence.read(goalId) ?? EMPTY_LOCAL_STATE;
  const metDays = met && !current.metDays.includes(today) ? [...current.metDays, today] : current.metDays;
  const next = { ...current, metDays, streak: advanceStreak(current.streak, today, met) };
  await persistence.write(goalId, next);
  return next;
}
