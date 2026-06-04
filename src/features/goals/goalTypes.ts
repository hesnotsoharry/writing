import type { IconName } from "../../components/Icon";

/** Unique identifier for each goal type. */
export type GoalTypeId =
  | "daily"
  | "session"
  | "project"
  | "deadline"
  | "time"
  | "streak";

/** A single goal-type entry as shown in the Goals dialog. */
export interface GoalTypeEntry {
  id: GoalTypeId;
  /** Icon name (maps to <Icon name={ic} /> in the UI). */
  ic: IconName;
  name: string;
  desc: string;
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
    ic: "clock",
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
    desc: "Words/day to hit a date",
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
    desc: "Days in a row",
  },
];

/** The default goal type when the Goals dialog opens. */
export const DEFAULT_GOAL_TYPE: GoalTypeId = "daily";
