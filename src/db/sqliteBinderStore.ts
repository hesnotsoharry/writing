import { computeReorder } from "../binder/computeReorder";
import { normalizeStatus } from "../lib/status";
import { bootstrapProjectBible } from "../sync/bible/desktopBibleBridge";
import { bootstrapProjectMeta, runLocalMetaWrite } from "../sync/meta/bridge";
import {
  applyFolderMutation,
  applyRemoved,
  applySceneMutation,
} from "../sync/meta/localMutators";
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
  boundFolderSql,
  boundSceneDelete,
  boundSceneSql,
  captureFolderDelete,
  loadRootScenes,
} from "./sqliteBinderMeta";
import {
  deleteSceneDependents,
  loadContainerScenes,
  nextSortOrder,
  relocateFolderScenes,
} from "./sqliteBinderWriteHelpers";

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
    const rows = await db.select<Array<{ id: string; sort_order: number }>>(
      "SELECT id, sort_order FROM folders WHERE project_id = $1 ORDER BY sort_order ASC, id ASC",
      [args.projectId]
    );
    const sort_order = nextSortOrder(rows);
    const orderedIds = [...rows.map((row) => row.id), id];
    await runLocalMetaWrite(args.projectId, async () => {
      await db.execute(
        "INSERT INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
        [id, args.projectId, args.title, sort_order]
      );
    }, (doc) => applyFolderMutation(doc, {
      id, projectId: args.projectId, title: args.title,
    }, orderedIds));
    return id;
  }

  async createScene(args: {
    projectId: string;
    folderId: string | null;
    title: string;
  }): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const rows = await loadContainerScenes(db, args.projectId, args.folderId);
    const sort_order = nextSortOrder(rows);
    const orderedIds = [...rows.map((row) => row.id), id];
    await runLocalMetaWrite(args.projectId, async () => {
      await db.execute(
        "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status) VALUES ($1, $2, $3, $4, NULL, $5, 0, 'blank')",
        [id, args.projectId, args.folderId, args.title, sort_order]
      );
    }, (doc) => applySceneMutation(doc, {
      id, projectId: args.projectId, folderId: args.folderId, title: args.title,
      synopsis: null, status: "blank",
    }, orderedIds));
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
    if (!captured) {
      await db.execute("UPDATE scenes SET folder_id = NULL WHERE folder_id = $1", [folderId]);
      await db.execute("DELETE FROM folders WHERE id = $1", [folderId]);
      return;
    }
    await runLocalMetaWrite(captured.projectId, async () => {
      await relocateFolderScenes(db, folderId, captured.projectId, captured.sceneIds);
      await db.execute("DELETE FROM folders WHERE id = $1", [folderId]);
      return loadRootScenes(captured.projectId);
    }, (doc, scenes) => {
      applyRemoved(doc, [{ kind: "folder", id: folderId }]);
      const moved = new Set(captured.sceneIds);
      const order = scenes.map((scene) => scene.id);
      for (const scene of scenes) {
        if (moved.has(scene.id)) applySceneMutation(doc, scene, order);
      }
    });
  }

  async renameFolder(folderId: string, title: string): Promise<void> {
    const db = await getDb();
    await boundFolderSql(folderId, () => db.execute("UPDATE folders SET title=$1 WHERE id=$2", [
      title, folderId,
    ]));
  }

  async renameScene(sceneId: string, title: string): Promise<void> {
    const db = await getDb();
    await boundSceneSql(sceneId, () => db.execute("UPDATE scenes SET title=$1 WHERE id=$2", [
      title, sceneId,
    ]));
  }

  async setSceneStatus(sceneId: string, status: SceneStatus): Promise<void> {
    const db = await getDb();
    await boundSceneSql(sceneId, () => db.execute("UPDATE scenes SET status=$1 WHERE id=$2", [
      status, sceneId,
    ]));
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
    await boundSceneSql(sceneId, () => db.execute("UPDATE scenes SET synopsis=$1 WHERE id=$2", [
      synopsis, sceneId,
    ]));
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
    await boundSceneDelete(sceneId, async () => {
      await deleteSceneDependents(db, sceneId);
      await db.execute("DELETE FROM scenes WHERE id=$1", [sceneId]);
    });
  }

  async moveScene(sceneId: string, toFolderId: string | null, toIndex: number): Promise<void> {
    const db = await getDb();
    const rows = await db.select<Scene[]>(
      "SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status FROM scenes WHERE id=$1",
      [sceneId]
    );
    if (rows.length === 0) return;
    const scene = rows[0];
    await runLocalMetaWrite(scene.project_id, async () => {
      await db.execute("UPDATE scenes SET folder_id=$1 WHERE id=$2", [toFolderId, sceneId]);
      const container = await loadContainerScenes(db, scene.project_id, toFolderId);
      const updates = computeReorder(container, sceneId, toIndex);
      for (const update of updates) {
        await db.execute("UPDATE scenes SET sort_order=$1 WHERE id=$2", [update.sort_order, update.id]);
      }
      return updates.map(({ id }) => id);
    }, (doc, orderedIds) => applySceneMutation(doc, {
      id: scene.id, projectId: scene.project_id, folderId: toFolderId, title: scene.title,
      synopsis: scene.synopsis, status: normalizeStatus(scene.status),
    }, orderedIds));
  }

  async moveFolder(folderId: string, toIndex: number): Promise<void> {
    const db = await getDb();
    const folderRows = await db.select<Folder[]>(
      "SELECT id, project_id, title, sort_order FROM folders WHERE id=$1",
      [folderId]
    );
    if (folderRows.length === 0) return;
    const folder = folderRows[0];
    await runLocalMetaWrite(folder.project_id, async () => {
      const siblings = await db.select<{ id: string }[]>(
        "SELECT id FROM folders WHERE project_id=$1 ORDER BY sort_order ASC",
        [folder.project_id]
      );
      const updates = computeReorder(siblings, folderId, toIndex);
      for (const update of updates) {
        await db.execute("UPDATE folders SET sort_order=$1 WHERE id=$2", [update.sort_order, update.id]);
      }
      return updates.map(({ id }) => id);
    }, (doc, orderedIds) => applyFolderMutation(doc, {
      id: folder.id, projectId: folder.project_id, title: folder.title,
    }, orderedIds));
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
