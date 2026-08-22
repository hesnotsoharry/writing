export interface Goal {
  id: string;
  project_id: string;
  goal_type: string;
  target: number;
  enabled: boolean;
  created_at: number;
  /** Raw JSON string of the type-specific fields (streak milestone/qualifiers,
   *  deadline date/startWords, …) that don't fit the flat target column.
   *  Mirrors mobile's `goals.config_json`. Absent/empty on legacy rows. */
  config_json?: string;
}

export interface GoalsStore {
  getGoals(projectId: string): Promise<Goal[]>;
  upsertGoal(input: {
    projectId: string;
    goalType: string;
    target: number;
    enabled: boolean;
    /** Type-specific fields to persist into config_json (streak
     *  milestone/qualifiers, deadline date/startWords, …). When omitted the
     *  store preserves the row's existing config_json unchanged — mirrors
     *  mobile's MobileGoalsStore, so an enable/disable-only write (no
     *  `config`) doesn't wipe fields it never touched. */
    config?: Record<string, unknown>;
  }): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
}
