import type { DbClient } from "../shared/dbClient";
import type { Label, LabelColor, LabelStore } from "../shared/labelStore";
import {
  bridgeMobileLabel,
  bridgeMobileRemoved,
  bridgeMobileSceneLabel,
} from "./mobileMetaBridge";

interface LabelRow { id: string; project_id: string; name: string; color: string; sort: number }
function mapLabel(row: LabelRow): Label {
  return { id: row.id, projectId: row.project_id, name: row.name, color: row.color as LabelColor, sort: row.sort };
}

export class MobileLabelStore implements LabelStore {
  constructor(private readonly db: DbClient) {}

  async createLabel(projectId: string, name = "Label", color: LabelColor = "clay"): Promise<Label> {
    const existing = await this.listLabels(projectId);
    if (existing.length >= 8) throw new Error("Label cap reached (8)");
    const id = crypto.randomUUID();
    const sort = Math.max(-1, ...existing.map((label) => label.sort)) + 1;
    await this.db.execute(
      "INSERT INTO labels (id, project_id, name, color, sort) VALUES (?, ?, ?, ?, ?)",
      [id, projectId, name, color, sort],
    );
    const label = { id, projectId, name, color, sort };
    await bridgeMobileLabel(label, [...existing.map((row) => row.id), id]);
    return label;
  }

  async listLabels(projectId: string): Promise<Label[]> {
    const rows = await this.db.select<LabelRow[]>(
      "SELECT id, project_id, name, color, sort FROM labels WHERE project_id = ? ORDER BY sort", [projectId],
    );
    return rows.map(mapLabel);
  }

  async updateLabel(id: string, patch: Partial<Pick<Label, "name" | "color" | "sort">>): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.execute(
      `UPDATE labels SET name = COALESCE(?, name), color = COALESCE(?, color),
       sort = COALESCE(?, sort) WHERE id = ?`,
      [patch.name ?? null, patch.color ?? null, patch.sort ?? null, id],
    );
    const label = await this.loadLabel(id);
    if (label) await bridgeMobileLabel(label);
  }

  async deleteLabel(id: string): Promise<void> {
    const label = await this.loadLabel(id);
    if (!label) return;
    const scenes = await this.db.select<{ scene_id: string }[]>(
      "SELECT scene_id FROM scene_labels WHERE label_id = ?", [id],
    );
    await this.db.execute("DELETE FROM scene_labels WHERE label_id = ?", [id]);
    await this.db.execute("DELETE FROM labels WHERE id = ?", [id]);
    await bridgeMobileRemoved(label.projectId, [
      { kind: "label", id },
      ...scenes.map(({ scene_id }) => ({ kind: "sceneLabel" as const, id: `${scene_id}:${id}` })),
    ]);
  }

  async assignLabel(sceneId: string, labelId: string): Promise<void> {
    await this.db.execute("INSERT OR IGNORE INTO scene_labels (scene_id, label_id) VALUES (?, ?)", [sceneId, labelId]);
    const label = await this.loadLabel(labelId);
    if (label) await bridgeMobileSceneLabel(label.projectId, sceneId, labelId, true);
  }

  async unassignLabel(sceneId: string, labelId: string): Promise<void> {
    await this.db.execute("DELETE FROM scene_labels WHERE scene_id = ? AND label_id = ?", [sceneId, labelId]);
    const label = await this.loadLabel(labelId);
    if (label) await bridgeMobileSceneLabel(label.projectId, sceneId, labelId, false);
  }

  async getSceneLabels(sceneId: string): Promise<Label[]> {
    const rows = await this.db.select<LabelRow[]>(
      `SELECT l.id, l.project_id, l.name, l.color, l.sort FROM labels l
       JOIN scene_labels sl ON sl.label_id = l.id WHERE sl.scene_id = ? ORDER BY l.sort`, [sceneId],
    );
    return rows.map(mapLabel);
  }

  async getAllSceneLabels(): Promise<Record<string, Label[]>> {
    const rows = await this.db.select<Array<LabelRow & { scene_id: string }>>(
      `SELECT sl.scene_id, l.id, l.project_id, l.name, l.color, l.sort FROM scene_labels sl
       JOIN labels l ON l.id = sl.label_id ORDER BY l.sort`,
    );
    return rows.reduce<Record<string, Label[]>>((result, row) => {
      (result[row.scene_id] ??= []).push(mapLabel(row));
      return result;
    }, {});
  }

  async reorderLabels(ids: string[]): Promise<void> {
    for (let index = 0; index < ids.length; index += 1) {
      await this.db.execute("UPDATE labels SET sort = ? WHERE id = ?", [index, ids[index]]);
    }
    const first = ids[0] ? await this.loadLabel(ids[0]) : undefined;
    if (!first) return;
    const ordered = await this.listLabels(first.projectId);
    for (const label of ordered) await bridgeMobileLabel(label, ids);
  }

  private async loadLabel(id: string): Promise<Label | undefined> {
    const rows = await this.db.select<LabelRow[]>(
      "SELECT id, project_id, name, color, sort FROM labels WHERE id = ?", [id],
    );
    return rows[0] ? mapLabel(rows[0]) : undefined;
  }
}
