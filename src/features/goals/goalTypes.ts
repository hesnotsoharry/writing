import type { IconName } from "../../components/Icon";

/** Unique identifier for each goal type. */
export type GoalTypeId =
  | "daily"
  | "session"
  | "project"
  | "deadline"
  | "time"
  | "streak";

/** Measurement families that drive adaptive editor + inspector viz. */
export type GoalFamily = "amount" | "deadline" | "streak";

/** A single goal-type entry as shown in the Goals dialog. */
export interface GoalTypeEntry {
  id: GoalTypeId;
  /** Icon name (maps to <Icon name={ic} /> in the UI). */
  ic: IconName;
  name: string;
  desc: string;
}

/** Rich metadata per goal type, used by the adaptive editor and inspector. */
export interface GoalMeta {
  ic: IconName;
  name: string;
  blurb: string;
  family: GoalFamily;
  /** For "amount" family only — what unit the target is in. */
  unit?: "words" | "minutes";
}

/**
 * The six goal types, ordered as they appear in the Goals dialog
 * (design-reference/dialogs.jsx L123–130).
 */
export const GOAL_TYPES: GoalTypeEntry[] = [
  {
    id: "daily",
    ic: "type",
    name: "Daily word count",
    desc: "Words written each day",
  },
  {
    id: "session",
    ic: "feather",
    name: "Per session",
    desc: "A target for each sitting",
  },
  {
    id: "project",
    ic: "target",
    name: "Whole project",
    desc: "Total manuscript target",
  },
  {
    id: "deadline",
    ic: "calendar",
    name: "Deadline pace",
    desc: "Finish by a chosen date",
  },
  {
    id: "time",
    ic: "clock",
    name: "Time at the desk",
    desc: "Minutes written, not words",
  },
  {
    id: "streak",
    ic: "flame",
    name: "Writing streak",
    desc: "Show up day after day",
  },
];

/**
 * Rich metadata keyed by type — single source of truth for the adaptive editor
 * and per-family inspector viz. Mirrors design-reference/data.jsx GOAL_META.
 */
export const GOAL_META: Record<GoalTypeId, GoalMeta> = {
  daily: {
    ic: "type",
    name: "Daily word count",
    blurb: "Words written each day",
    family: "amount",
    unit: "words",
  },
  session: {
    ic: "feather",
    name: "Per session",
    blurb: "A target for each sitting",
    family: "amount",
    unit: "words",
  },
  project: {
    ic: "target",
    name: "Whole project",
    blurb: "Total manuscript target",
    family: "amount",
    unit: "words",
  },
  deadline: {
    ic: "calendar",
    name: "Deadline pace",
    blurb: "Finish by a chosen date",
    family: "deadline",
  },
  time: {
    ic: "clock",
    name: "Time at the desk",
    blurb: "Minutes written, not words",
    family: "amount",
    unit: "minutes",
  },
  streak: {
    ic: "flame",
    name: "Writing streak",
    blurb: "Show up day after day",
    family: "streak",
  },
};

/**
 * Picker order: word amounts, then time, then deadline, then streak.
 * Matches design-reference/data.jsx GOAL_ORDER.
 */
export const GOAL_ORDER: GoalTypeId[] = [
  "daily",
  "session",
  "project",
  "time",
  "deadline",
  "streak",
];

/** The default goal type when the Goals dialog opens. */
export const DEFAULT_GOAL_TYPE: GoalTypeId = "daily";
