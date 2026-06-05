/** goalsEditorHelpers.ts — pure-data helpers for the Goals adaptive editor. */
import type { GoalRecord } from "./goalModel";
import type { GoalTypeId } from "./goalTypes";
import { GOAL_META } from "./goalTypes";

// ── Date helpers ──────────────────────────────────────────────────────────────

export function isoOf(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export const MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmtDate(iso: string): string {
  if (!iso) return "No date yet";
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? "No date yet" : `${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// ── GoalDraft type + save helpers ─────────────────────────────────────────────

export interface GoalDraft {
  amount: number; scope: string; finalWords: number; date: string;
  startWords: number; startDate: string; current: number;
  qualifies: "any" | "daily" | "time"; qualifyAmount: number; milestone: number;
}

export function blankDraft(type: GoalTypeId, projWords: number): GoalDraft {
  const amtMap: Record<string, number> = { daily: 500, session: 800, time: 30 };
  const amount = amtMap[type] ?? Math.max(80_000, projWords);
  return {
    amount, scope: "project", finalWords: Math.max(80_000, projWords), date: "",
    startWords: projWords, startDate: isoOf(new Date()), current: projWords,
    qualifies: "any", qualifyAmount: 30, milestone: 30,
  };
}

type DraftStringKey = "scope" | "date" | "startDate";
type DraftNumKey = "finalWords" | "startWords" | "current" | "qualifyAmount" | "milestone";

export function draftFromGoal(goal: GoalRecord, projWords: number): GoalDraft {
  const d = blankDraft(goal.type, projWords);
  if (goal.words != null) d.amount = goal.words;
  else if (goal.minutes != null) d.amount = goal.minutes;
  if (goal.qualifies != null) d.qualifies = goal.qualifies;
  const strKeys: DraftStringKey[] = ["scope", "date", "startDate"];
  for (const k of strKeys) { const v = goal[k as keyof GoalRecord]; if (v != null) (d as unknown as Record<string, unknown>)[k] = v; }
  const numKeys: DraftNumKey[] = ["finalWords", "startWords", "current", "qualifyAmount", "milestone"];
  for (const k of numKeys) { const v = goal[k as keyof GoalRecord]; if (v != null) (d as unknown as Record<string, unknown>)[k] = v; }
  return d;
}

export function buildAmountGoal(base: GoalRecord, draft: GoalDraft, type: GoalTypeId): GoalRecord {
  const meta = GOAL_META[type]; const g: GoalRecord = { ...base };
  if (meta.unit === "minutes") g.minutes = Number(draft.amount) || 0;
  else g.words = Number(draft.amount) || 0;
  if (["daily", "session", "time"].includes(type)) g.scope = draft.scope;
  g.current = base.current ?? 0;
  return g;
}

export function buildDeadlineGoal(base: GoalRecord, draft: GoalDraft, projWords: number): GoalRecord {
  return { ...base, finalWords: Number(draft.finalWords) || 0, date: draft.date,
    startWords: base.startWords ?? projWords, startDate: base.startDate ?? isoOf(new Date()),
    current: base.current ?? projWords };
}

export function buildStreakGoal(base: GoalRecord, draft: GoalDraft): GoalRecord {
  return { ...base, qualifies: draft.qualifies, qualifyAmount: Number(draft.qualifyAmount) || 0,
    milestone: draft.milestone || null, streakDays: base.streakDays ?? 0, best: base.best ?? 0,
    week: base.week ?? [false, false, false, false, false, false, false] };
}

export const STREAK_QUALIFIERS: Array<{ id: "any" | "daily" | "time"; title: string; desc: string; needs?: string }> = [
  { id: "any", title: "Just show up", desc: "Any writing that day keeps it alive" },
  { id: "daily", title: "Hit my daily words", desc: "Counts a day only if the daily goal is met", needs: "daily" },
  { id: "time", title: "Time at the desk", desc: "A minimum number of minutes" },
];

export function buildGoal(goal: GoalRecord | null, type: GoalTypeId, draft: GoalDraft, projWords: number): GoalRecord {
  const meta = GOAL_META[type];
  const base: GoalRecord = { id: goal ? goal.id : `g-${Date.now().toString(36)}`, type };
  if (meta.family === "amount") return buildAmountGoal(base, draft, type);
  if (meta.family === "deadline") return buildDeadlineGoal(base, draft, projWords);
  return buildStreakGoal(base, draft);
}
