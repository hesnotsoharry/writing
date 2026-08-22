import { computeReorder } from "../binder/computeReorder";
import { normalizeStatus } from "../lib/status";
import { bootstrapProjectBible } from "../sync/bible/desktopBibleBridge";
import { bootstrapProjectMeta } from "../sync/meta/bridge";
import {
  bridgeFolder,
  bridgeRemoved,
  bridgeScene,
} from "../sync/meta/localBridge";
import type { ArchivedItem, BinderStore, Folder, Project, Scene, SceneStatus } from "./binderStore";
import { getDb } from "./schema";
import {
  sqliteArchiveChapter,
  sqliteArchivedCount,
  sqliteArchiveScene,
  sqliteListArchived,
  sqlitePurgeArchived,
  sqliteRestoreArchived,
} from "./sqliteArchiveHelpers";
import {
  bridgeFolderById,
  bridgeRootMoves,
  bridgeSceneById,
  captureFolderDelete,
  captureSceneDelete,
} from "./sqliteBinderMeta";

/**
 * SQLite-backed BinderStore over tauri-plugin-sql.
 * Mirrors SqliteSceneDocStore's pattern: getDb(), $1-style params, no transactions
 * (tauri-plugin-sql exposes none — tauri-apps/plugins-workspace#886).
 */
export class SqliteBinderStore implements BinderStore {
  async listProjects(): Promise<Project[]> {
    const db = await getDb();
    return db.select<Project[]>(
      "SELECT id, title, type, sort_order, created_at, updated_at FROM projects ORDER BY sort_order ASC"
    );
  }

  async createProject(args: { title: string; type: string }): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Gap-based sort_order: count existing projects, then (count + 1) * 1000.
    const rows = await db.select<{ cnt: number }[]>(
      "SELECT COUNT(*) as cnt FROM projects"
    );
    const count = rows[0]?.cnt ?? 0;
    const sort_order = (count + 1) * 1000;
    await db.execute(
      "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, args.title, args.type, sort_order, now, now]
    );
    // Mirrors mobileBinderStore.createProject: a project without a bootstrapped
    // meta/bible doc appears in no hello docs[] and never replicates.
    await Promise.all([bootstrapProjectMeta(id), bootstrapProjectBible(id)]);
    return id;
  }

  async createFolder(args: {
    projectId: string;
    title: string;
  }): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const rows = await db.select<Array<{ id: string }>>(
      "SELECT id FROM folders WHERE project_id = $1 ORDER BY sort_order ASC",
      [args.projectId]
    );
    const count = rows.length;
    const sort_order = (count + 1) * 1000;
    await db.execute(
      "INSERT INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
      [id, args.projectId, args.title, sort_order]
    );
    bridgeFolder(
      { id, projectId: args.projectId, title: args.title },
      [...rows.map((row) => row.id), id]
    );
    return id;
  }

  async createScene(args: {
    projectId: string;
    folderId: string | null;
    title: string;
  }): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    // Sort_order scoped to the container (folder or null-folder bucket).
    let rows: { id: string }[];
    if (args.folderId !== null) {
      rows = await db.select<Array<{ id: string }>>(
        "SELECT id FROM scenes WHERE project_id = $1 AND folder_id = $2 ORDER BY sort_order ASC",
        [args.projectId, args.folderId]
      );
    } else {
      rows = await db.select<Array<{ id: string }>>(
        "SELECT id FROM scenes WHERE project_id = $1 AND folder_id IS NULL ORDER BY sort_order ASC",
        [args.projectId]
      );
    }
    const count = rows.length;
    const sort_order = (count + 1) * 1000;
    await db.execute(
      "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status) VALUES ($1, $2, $3, $4, NULL, $5, 0, 'blank')",
      [id, args.projectId, args.folderId, args.title, sort_order]
    );
    bridgeScene({
      id, projectId: args.projectId, folderId: args.folderId, title: args.title,
      synopsis: null, status: "blank",
    }, [...rows.map((row) => row.id), id]);
    return id;
  }

  async loadProject(
    projectId: string
  ): Promise<{ folders: Folder[]; scenes: Scene[] }> {
    const db = await getDb();
    const folders = await db.select<Folder[]>(
      "SELECT id, project_id, title, sort_order FROM folders WHERE project_id = $1 ORDER BY sort_order ASC",
      [projectId]
    );
    const rawScenes = await db.select<(Omit<Scene, "status" | "excludeFromAi"> & { status: string; exclude_from_ai: number })[]>(
      "SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status, exclude_from_ai FROM scenes WHERE project_id = $1 ORDER BY sort_order ASC",
      [projectId]
    );
    // Normalize raw DB status strings (handles legacy "done" → "final") and map
    // integer exclude_from_ai column to boolean excludeFromAi.
    const scenes: Scene[] = rawScenes.map((s) => ({
      ...s,
      status: normalizeStatus(s.status),
      excludeFromAi: s.exclude_from_ai === 1,
    }));
    return { folders, scenes };
  }

  async deleteFolder(folderId: string): Promise<void> {
    const db = await getDb();
    const captured = await captureFolderDelete(folderId);
    // Move scenes to Short pieces (folder_id = NULL) — never delete prose.
    await db.execute(
      "UPDATE scenes SET folder_id = NULL WHERE folder_id = $1",
      [folderId]
    );
    // Delete the folder row.
    await db.execute("DELETE FROM folders WHERE id = $1", [folderId]);
    if (captured) {
      bridgeRemoved(captured.projectId, [{ kind: "folder", id: folderId }], "folder delete");
      bridgeRootMoves(captured.projectId, captured.sceneIds);
    }
  }

  async renameFolder(folderId: string, title: string): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE folders SET title=$1 WHERE id=$2", [
      title,
      folderId,
    ]);
    bridgeFolderById(folderId, "folder rename");
  }

  async renameScene(sceneId: string, title: string): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE scenes SET title=$1 WHERE id=$2", [
      title,
      sceneId,
    ]);
    bridgeSceneById(sceneId, "scene rename");
  }

  async setSceneStatus(sceneId: string, status: SceneStatus): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE scenes SET status=$1 WHERE id=$2", [
      status,
      sceneId,
    ]);
    bridgeSceneById(sceneId, "scene status");
  }

  async setSceneExcludedFromAi(sceneId: string, exclude: boolean): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE scenes SET exclude_from_ai=$1 WHERE id=$2", [
      exclude ? 1 : 0,
      sceneId,
    ]);
  }

  async setSceneSynopsis(sceneId: string, synopsis: string | null): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE scenes SET synopsis=$1 WHERE id=$2", [
      synopsis,
      sceneId,
    ]);
    bridgeSceneById(sceneId, "scene synopsis");
  }

  async setSceneWordCount(sceneId: string, wordCount: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute("UPDATE scenes SET word_count=$1 WHERE id=$2", [
      wordCount,
      sceneId,
    ]);
    return result.rowsAffected > 0;
  }

  async deleteScene(sceneId: string): Promise<void> {
    const db = await getDb();
    const projectId = await captureSceneDelete(sceneId);
    await db.execute("DELETE FROM scenes WHERE id=$1", [sceneId]);
    if (projectId) bridgeRemoved(projectId, [{ kind: "scene", id: sceneId }], "scene delete");
  }

  async moveScene(sceneId: string, toFolderId: string | null, toIndex: number): Promise<void> {
    const db = await getDb();
    const rows = await db.select<Scene[]>(
      "SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status FROM scenes WHERE id=$1",
      [sceneId]
    );
    if (rows.length === 0) return;
    const { project_id } = rows[0];
    await db.execute("UPDATE scenes SET folder_id=$1 WHERE id=$2", [
      toFolderId,
      sceneId,
    ]);
    let container: { id: string }[];
    if (toFolderId !== null) {
      container = await db.select<{ id: string }[]>(
        "SELECT id FROM scenes WHERE project_id=$1 AND folder_id=$2 ORDER BY sort_order ASC",
        [project_id, toFolderId]
      );
    } else {
      container = await db.select<{ id: string }[]>(
        "SELECT id FROM scenes WHERE project_id=$1 AND folder_id IS NULL ORDER BY sort_order ASC",
        [project_id]
      );
    }
    // Renormalize sort_orders.
    const updates = computeReorder(container, sceneId, toIndex);
    for (const u of updates) {
      await db.execute("UPDATE scenes SET sort_order=$1 WHERE id=$2", [
        u.sort_order,
        u.id,
      ]);
    }
    const scene = rows[0];
    bridgeScene({
      id: scene.id, projectId: scene.project_id, folderId: toFolderId, title: scene.title,
      synopsis: scene.synopsis, status: normalizeStatus(scene.status),
    }, updates.map(({ id }) => id));
  }

  async moveFolder(folderId: string, toIndex: number): Promise<void> {
    const db = await getDb();
    const folderRows = await db.select<Folder[]>(
      "SELECT id, project_id, title, sort_order FROM folders WHERE id=$1",
      [folderId]
    );
    if (folderRows.length === 0) return;
    const { project_id } = folderRows[0];
    // Load all folders for this project in current sort_order.
    const siblings = await db.select<{ id: string }[]>(
      "SELECT id FROM folders WHERE project_id=$1 ORDER BY sort_order ASC",
      [project_id]
    );
    // Renormalize sort_orders.
    const updates = computeReorder(siblings, folderId, toIndex);
    for (const u of updates) {
      await db.execute("UPDATE folders SET sort_order=$1 WHERE id=$2", [
        u.sort_order,
        u.id,
      ]);
    }
    const folder = folderRows[0];
    bridgeFolder({ id: folder.id, projectId: folder.project_id, title: folder.title },
      updates.map(({ id }) => id));
  }

  // -------------------------------------------------------------------------
  // Archive methods (Wave 22 — Phase 2) — delegated to sqliteArchiveHelpers
  // -------------------------------------------------------------------------

  async archiveScene(sceneId: string, projectId: string): Promise<void> {
    return sqliteArchiveScene(sceneId, projectId);
  }

  async archiveChapter(folderId: string, projectId: string): Promise<void> {
    return sqliteArchiveChapter(folderId, projectId);
  }

  async listArchived(projectId: string): Promise<ArchivedItem[]> {
    return sqliteListArchived(projectId);
  }

  async restoreArchived(archiveId: string): Promise<void> {
    return sqliteRestoreArchived(archiveId);
  }

  async purgeArchived(archiveId: string): Promise<void> {
    return sqlitePurgeArchived(archiveId);
  }

  async archivedCount(projectId: string): Promise<number> {
    return sqliteArchivedCount(projectId);
  }
}
