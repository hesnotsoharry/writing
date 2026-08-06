/**
 * SqliteLabelStore — SQLite-backed LabelStore over tauri-plugin-sql.
 *
 * Mirrors SqliteSnapshotStore's pattern: getDb(), $1-style params.
 * color is stored as the palette token name, never a hex value.
 */
import {
  bridgeDeletedLabel,
  bridgeLabel,
  bridgeLabelOrder,
  bridgeSceneLabel,
} from "../sync/meta/localBridge";
import type { Label, LabelColor, LabelStore } from "./labelStore";
import { getDb } from "./schema";

/** Raw row shape returned by tauri-plugin-sql before domain mapping. */
interface LabelRow {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort: number;
}

function mapRow(row: LabelRow): Label {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color as LabelColor,
    sort: row.sort,
  };
}

function reportLookup(operation: string, task: Promise<void>): void {
  void task.catch((error: unknown) => console.error(`[sync-meta] ${operation}`, error));
}

async function loadLabel(id: string): Promise<Label | undefined> {
  const db = await getDb();
  const rows = await db.select<LabelRow[]>(
    "SELECT id, project_id, name, color, sort FROM labels WHERE id=$1", [id]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

async function bridgeUpdatedLabel(id: string, fresh: boolean): Promise<void> {
  const label = await loadLabel(id);
  if (!label) return;
  let orderedIds: string[] | undefined;
  if (fresh) {
    const db = await getDb();
    const rows = await db.select<Array<{ id: string }>>(
      "SELECT id FROM labels WHERE project_id=$1 ORDER BY sort ASC", [label.projectId]
    );
    orderedIds = rows.map((row) => row.id);
  }
  bridgeLabel(label, orderedIds);
}

async function bridgeAssignment(sceneId: string, labelId: string, assigned: boolean): Promise<void> {
  const label = await loadLabel(labelId);
  if (label) bridgeSceneLabel(label.projectId, sceneId, labelId, assigned);
}

async function captureLabelDelete(id: string): Promise<{
  label: Label; sceneIds: string[];
} | undefined> {
  try {
    const db = await getDb();
    const label = await loadLabel(id);
    if (!label) return undefined;
    const rows = await db.select<Array<{ scene_id: string }>>(
      "SELECT scene_id FROM scene_labels WHERE label_id=$1", [id]
    );
    return { label, sceneIds: rows.map((row) => row.scene_id) };
  } catch (error) {
    console.error("[sync-meta] label delete capture", error);
    return undefined;
  }
}

export class SqliteLabelStore implements LabelStore {
  async createLabel(
    projectId: string,
    name = "Label",
    color: LabelColor = "clay"
  ): Promise<Label> {
    const db = await getDb();
    const countRows = await db.select<{ cnt: number }[]>(
      `SELECT COUNT(*) as cnt FROM labels WHERE project_id = $1`,
      [projectId]
    );
    if ((countRows[0]?.cnt ?? 0) >= 8) throw new Error("Label cap reached (8)");
    const id = crypto.randomUUID();
    const rows = await db.select<Array<{ id: string; sort: number }>>(
      `SELECT id, sort FROM labels WHERE project_id = $1 ORDER BY sort ASC`,
      [projectId]
    );
    const sort = Math.max(-1, ...rows.map((row) => row.sort)) + 1;
    await db.execute(
      `INSERT INTO labels (id, project_id, name, color, sort) VALUES ($1, $2, $3, $4, $5)`,
      [id, projectId, name, color, sort]
    );
    bridgeLabel({ id, projectId, name, color }, [...rows.map((row) => row.id), id]);
    return { id, projectId, name, color, sort };
  }

  async listLabels(projectId: string): Promise<Label[]> {
    const db = await getDb();
    const rows = await db.select<LabelRow[]>(
      `SELECT id, project_id, name, color, sort FROM labels
       WHERE project_id = $1
       ORDER BY sort ASC`,
      [projectId]
    );
    return rows.map(mapRow);
  }

  async updateLabel(
    id: string,
    patch: Partial<Pick<Label, "name" | "color" | "sort">>
  ): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    const db = await getDb();
    await db.execute(
      `UPDATE labels SET name = COALESCE($1, name), color = COALESCE($2, color), sort = COALESCE($3, sort) WHERE id = $4`,
      [patch.name ?? null, patch.color ?? null, patch.sort ?? null, id]
    );
    reportLookup("label update", bridgeUpdatedLabel(id, patch.sort !== undefined));
  }

  async deleteLabel(id: string): Promise<void> {
    const db = await getDb();
    const captured = await captureLabelDelete(id);
    await db.execute(`DELETE FROM scene_labels WHERE label_id = $1`, [id]);
    await db.execute(`DELETE FROM labels WHERE id = $1`, [id]);
    if (captured) bridgeDeletedLabel(captured.label.projectId, id, captured.sceneIds);
  }

  async assignLabel(sceneId: string, labelId: string): Promise<void> {
    const db = await getDb();
    // INSERT OR IGNORE — idempotent: the PK (scene_id, label_id) deduplicates.
    await db.execute(
      `INSERT OR IGNORE INTO scene_labels (scene_id, label_id) VALUES ($1, $2)`,
      [sceneId, labelId]
    );
    reportLookup("scene-label assign", bridgeAssignment(sceneId, labelId, true));
  }

  async unassignLabel(sceneId: string, labelId: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      `DELETE FROM scene_labels WHERE scene_id = $1 AND label_id = $2`,
      [sceneId, labelId]
    );
    reportLookup("scene-label unassign", bridgeAssignment(sceneId, labelId, false));
  }

  async getSceneLabels(sceneId: string): Promise<Label[]> {
    const db = await getDb();
    const rows = await db.select<LabelRow[]>(
      `SELECT l.id, l.project_id, l.name, l.color, l.sort
       FROM labels l
       INNER JOIN scene_labels sl ON sl.label_id = l.id
       WHERE sl.scene_id = $1
       ORDER BY l.sort ASC`,
      [sceneId]
    );
    return rows.map(mapRow);
  }

  async reorderLabels(ids: string[]): Promise<void> {
    const db = await getDb();
    for (let idx = 0; idx < ids.length; idx++) {
      await db.execute(`UPDATE labels SET sort = $1 WHERE id = $2`, [idx, ids[idx]]);
    }
    const first = ids[0];
    if (first) reportLookup("label reorder", (async () => {
      const label = await loadLabel(first);
      if (!label) return;
      const rows = await this.listLabels(label.projectId);
      bridgeLabelOrder(label.projectId, rows);
    })());
  }

  async getAllSceneLabels(): Promise<Record<string, Label[]>> {
    const db = await getDb();
    const rows = await db.select<(LabelRow & { scene_id: string })[]>(
      `SELECT sl.scene_id, l.id, l.project_id, l.name, l.color, l.sort
       FROM scene_labels sl
       INNER JOIN labels l ON l.id = sl.label_id
       ORDER BY l.sort ASC`
    );
    const result: Record<string, Label[]> = {};
    for (const row of rows) {
      const sceneId = row.scene_id;
      if (!result[sceneId]) result[sceneId] = [];
      result[sceneId].push(mapRow(row));
    }
    return result;
  }
}
