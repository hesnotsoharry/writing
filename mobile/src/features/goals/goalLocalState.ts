import { advanceStreak, type Streak } from "../../shared/streakLogic";

export interface GoalLocalState {
  baseline: number;
  baselineDate?: string;
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

export function localCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
