import { normalizeStatus } from "../lib/status";
import type { MetaApplyTarget } from "../sync/meta/applyExec";
import type {
  DeleteOp, LabelOp, SortOrderRewrite, SqlProjectionSnapshot,
} from "../sync/meta/applyPlan";
import type { MetaProject } from "../sync/meta/metaDoc";
import type { DbClient } from "./dbClient";
import type { LabelColor } from "./labelStore";
import { getDb } from "./schema";

async function loadProjection(db: DbClient, projectId: string): Promise<SqlProjectionSnapshot> {
  const folders = await db.select<SqlProjectionSnapshot["folders"]>(
    "SELECT id, project_id, title, sort_order FROM folders WHERE project_id = $1", [projectId]
  );
  const scenes = await db.select<Array<Omit<SqlProjectionSnapshot["scenes"][number], "status"> & { status: string }>>(
    `SELECT id, project_id, folder_id, title, synopsis, status, sort_order
     FROM scenes WHERE project_id = $1`, [projectId]
  );
  const labels = await db.select<Array<Omit<SqlProjectionSnapshot["labels"][number], "color"> & { color: string }>>(
    "SELECT id, project_id, name, color, sort FROM labels WHERE project_id = $1", [projectId]
  );
  const sceneLabels = await db.select<SqlProjectionSnapshot["sceneLabels"]>(
    `SELECT sl.scene_id, sl.label_id FROM scene_labels sl
     INNER JOIN scenes s ON s.id = sl.scene_id WHERE s.project_id = $1`, [projectId]
  );
  return {
    folders,
    scenes: scenes.map((row) => ({ ...row, status: normalizeStatus(row.status) })),
    labels: labels.map((row) => ({ ...row, color: row.color as LabelColor })),
    sceneLabels,
  };
}

async function applyDelete(db: DbClient, op: DeleteOp): Promise<void> {
  if (op.kind === "sceneLabel") {
    const separator = op.id.indexOf(":");
    if (separator >= 0) await db.execute(
      "DELETE FROM scene_labels WHERE scene_id = $1 AND label_id = $2",
      [op.id.slice(0, separator), op.id.slice(separator + 1)]
    );
    return;
  }
  const table = op.kind === "folder" ? "folders" : op.kind === "scene" ? "scenes" : "labels";
  await db.execute(`DELETE FROM ${table} WHERE id = $1`, [op.id]);
}

export class SqliteMetaApplyTarget implements MetaApplyTarget {
  async ensureProject(project: MetaProject): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    const rows = await db.select<Array<{ sort_order: number }>>(
      "SELECT COALESCE(MAX(sort_order), 0) + 1000 AS sort_order FROM projects"
    );
    await db.execute(
      `INSERT INTO projects (id, title, type, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, type=excluded.type,
       updated_at=excluded.updated_at`,
      [project.id, project.title, project.type, rows[0]?.sort_order ?? 1000, now]
    );
  }
  async load(projectId: string): Promise<SqlProjectionSnapshot> {
    return loadProjection(await getDb(), projectId);
  }
  async upsertFolder(row: SqlProjectionSnapshot["folders"][number]): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)
       ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,
       title=excluded.title, sort_order=excluded.sort_order`,
      [row.id, row.project_id, row.title, row.sort_order]
    );
  }
  async upsertScene(row: SqlProjectionSnapshot["scenes"][number]): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
       ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id, folder_id=excluded.folder_id,
       title=excluded.title, synopsis=excluded.synopsis, status=excluded.status`,
      [row.id, row.project_id, row.folder_id, row.title, row.synopsis, row.sort_order, row.status]
    );
  }
  async applyLabel(op: LabelOp): Promise<void> {
    const db = await getDb();
    if (op.type === "upsert") await db.execute(
      `INSERT INTO labels (id, project_id, name, color, sort) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id, name=excluded.name,
       color=excluded.color, sort=excluded.sort`,
      [op.row.id, op.row.project_id, op.row.name, op.row.color, op.row.sort]
    );
    else if (op.type === "assign") await db.execute(
      "INSERT OR IGNORE INTO scene_labels (scene_id, label_id) VALUES ($1, $2)",
      [op.sceneId, op.labelId]
    );
    else await db.execute(
      "DELETE FROM scene_labels WHERE scene_id = $1 AND label_id = $2", [op.sceneId, op.labelId]
    );
  }
  async delete(op: DeleteOp): Promise<void> { await applyDelete(await getDb(), op); }
  async rewriteSort(op: SortOrderRewrite): Promise<void> {
    const db = await getDb();
    const table = op.kind === "folder" ? "folders" : op.kind === "scene" ? "scenes" : "labels";
    const column = op.kind === "label" ? "sort" : "sort_order";
    await db.execute(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [op.sortOrder, op.id]);
  }
}
