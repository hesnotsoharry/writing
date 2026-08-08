import { getMobileDb } from "../../db/database";
import type { BinderTree, RawFolderRow, RawSceneRow } from "./binderTree";
import { buildBinderTree } from "./binderTree";

export type ProjectBadge = "synced" | "local";

export interface ProjectListItem {
  id: string;
  title: string;
  type: string;
  badge: ProjectBadge;
  wordCount: number;
}

/**
 * Read-only binder queries over `getMobileDb()`. Mirrors the desktop
 * SqliteBinderStore's SQL shapes (src/db/sqliteBinderStore.ts) but returns
 * mobile's own read models rather than the desktop BinderStore interface —
 * this screen never writes, so it has no need for the full write contract.
 *
 * The "synced / this device only" badge mirrors ProjectSwitcher's
 * hasProjectMeta check (src/binder/ProjectSwitcher.tsx) — a project_meta_docs
 * row means the project has been bootstrapped into sync at least once. Unlike
 * desktop's per-project lookup, this reads the whole table in one query
 * (listProjects renders the full project list at once, so batching avoids
 * N+1 round trips through expo-sqlite's async bridge).
 */
export async function listProjects(): Promise<ProjectListItem[]> {
  const db = await getMobileDb();
  const [projectRows, metaRows] = await Promise.all([
    db.select<Array<{ id: string; title: string; type: string; word_count: number }>>(
      `SELECT p.id, p.title, p.type, COALESCE(SUM(s.word_count), 0) AS word_count
       FROM projects p
       LEFT JOIN scenes s ON s.project_id = p.id
       GROUP BY p.id
       ORDER BY p.sort_order ASC`
    ),
    db.select<Array<{ project_id: string }>>("SELECT project_id FROM project_meta_docs"),
  ]);
  const syncedIds = new Set(metaRows.map((row) => row.project_id));
  return projectRows.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    badge: syncedIds.has(row.id) ? "synced" : "local",
    wordCount: row.word_count,
  }));
}

/** Chapters (folders) with ordered scenes, plus the folder_id=NULL short
 *  pieces bucket — grouped by the pure buildBinderTree. */
export async function listBinder(projectId: string): Promise<BinderTree> {
  const db = await getMobileDb();
  const [folders, scenes] = await Promise.all([
    db.select<RawFolderRow[]>(
      "SELECT id, title, sort_order FROM folders WHERE project_id = $1 ORDER BY sort_order ASC",
      [projectId]
    ),
    db.select<RawSceneRow[]>(
      `SELECT id, folder_id, title, synopsis, sort_order, word_count, status
       FROM scenes WHERE project_id = $1 ORDER BY sort_order ASC`,
      [projectId]
    ),
  ]);
  return buildBinderTree(folders, scenes);
}

export type { BinderChapter, BinderSceneItem, BinderTree } from "./binderTree";
