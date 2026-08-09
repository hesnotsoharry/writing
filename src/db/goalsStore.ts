export interface Goal {
  id: string;
  project_id: string;
  goal_type: string;
  target: number;
  enabled: boolean;
  created_at: number;
}

export interface GoalsStore {
  getGoals(projectId: string): Promise<Goal[]>;
  upsertGoal(input: {
    projectId: string;
    goalType: string;
    target: number;
    enabled: boolean;
  }): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
}
