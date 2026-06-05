/**
 * InMemoryLabelStore — in-memory implementation for tests.
 * Matches the LabelStore interface without any SQLite dependency.
 */
import type { Label, LabelColor, LabelStore } from "./labelStore";

export class InMemoryLabelStore implements LabelStore {
  private labels: Map<string, Label> = new Map();
  /** scene_id → Set of labelIds */
  private assignments: Map<string, Set<string>> = new Map();

  async createLabel(
    projectId: string,
    name = "Label",
    color: LabelColor = "clay"
  ): Promise<Label> {
    const id = crypto.randomUUID();
    const maxSort = Math.max(-1, ...[...this.labels.values()]
      .filter((l) => l.projectId === projectId)
      .map((l) => l.sort));
    const sort = maxSort + 1;
    const label: Label = { id, projectId, name, color, sort };
    this.labels.set(id, label);
    return { ...label };
  }

  async listLabels(projectId: string): Promise<Label[]> {
    return [...this.labels.values()]
      .filter((l) => l.projectId === projectId)
      .sort((a, b) => a.sort - b.sort)
      .map((l) => ({ ...l }));
  }

  async updateLabel(
    id: string,
    patch: Partial<Pick<Label, "name" | "color" | "sort">>
  ): Promise<void> {
    const label = this.labels.get(id);
    if (!label) return;
    if (patch.name !== undefined) label.name = patch.name;
    if (patch.color !== undefined) label.color = patch.color;
    if (patch.sort !== undefined) label.sort = patch.sort;
  }

  async deleteLabel(id: string): Promise<void> {
    this.labels.delete(id);
    for (const set of this.assignments.values()) {
      set.delete(id);
    }
  }

  async assignLabel(sceneId: string, labelId: string): Promise<void> {
    if (!this.assignments.has(sceneId)) {
      this.assignments.set(sceneId, new Set());
    }
    this.assignments.get(sceneId)!.add(labelId);
  }

  async unassignLabel(sceneId: string, labelId: string): Promise<void> {
    this.assignments.get(sceneId)?.delete(labelId);
  }

  async getSceneLabels(sceneId: string): Promise<Label[]> {
    const ids = this.assignments.get(sceneId) ?? new Set<string>();
    return [...ids]
      .map((id) => this.labels.get(id))
      .filter((l): l is Label => l !== undefined)
      .sort((a, b) => a.sort - b.sort)
      .map((l) => ({ ...l }));
  }

  async getAllSceneLabels(): Promise<Record<string, Label[]>> {
    const result: Record<string, Label[]> = {};
    for (const [sceneId, ids] of this.assignments.entries()) {
      if (ids.size === 0) continue;
      const labels = [...ids]
        .map((id) => this.labels.get(id))
        .filter((l): l is Label => l !== undefined)
        .sort((a, b) => a.sort - b.sort)
        .map((l) => ({ ...l }));
      if (labels.length > 0) result[sceneId] = labels;
    }
    return result;
  }
}
