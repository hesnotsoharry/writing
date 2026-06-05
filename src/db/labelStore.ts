/**
 * LabelStore — abstraction over color-label management.
 *
 * Labels are project-scoped named color tokens (e.g. "Tension" / "clay").
 * scene_labels is a many-to-many join: a scene can have multiple labels,
 * and a label can appear on multiple scenes.
 *
 * color stores the token name ('clay', 'sea', …) — never a hex value. This
 * keeps re-theming cohesive: the UI reads `var(--label-<color>)` at render
 * time; the DB stores only the palette key.
 */

export type LabelColor =
  | "clay"
  | "sea"
  | "moss"
  | "plum"
  | "gold"
  | "slate"
  | "rose"
  | "ink";

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: LabelColor;
  sort: number;
}

export interface LabelStore {
  /**
   * Create a new label for the given project.
   * `name` defaults to "Label" if omitted; `color` defaults to "clay".
   * `sort` is assigned as max(existing) + 1.
   */
  createLabel(projectId: string, name?: string, color?: LabelColor): Promise<Label>;

  /** List all labels for a project in sort order. */
  listLabels(projectId: string): Promise<Label[]>;

  /**
   * Rename a label. No-op if id not found.
   */
  updateLabel(id: string, patch: Partial<Pick<Label, "name" | "color" | "sort">>): Promise<void>;

  /**
   * Delete a label and remove all its scene assignments.
   * No-op if id not found.
   */
  deleteLabel(id: string): Promise<void>;

  /**
   * Assign a label to a scene. Idempotent — no error if already assigned.
   */
  assignLabel(sceneId: string, labelId: string): Promise<void>;

  /**
   * Remove a label from a scene. No-op if not assigned.
   */
  unassignLabel(sceneId: string, labelId: string): Promise<void>;

  /**
   * Return all labels assigned to a scene, in label sort order.
   */
  getSceneLabels(sceneId: string): Promise<Label[]>;

  /**
   * Return a map of sceneId → Label[] for all scenes that have at least one label.
   * Used to hydrate the Outliner in a single query rather than N per-scene calls.
   */
  getAllSceneLabels(): Promise<Record<string, Label[]>>;
}
