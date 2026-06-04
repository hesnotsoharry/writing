import { computeReorder } from "../binder/computeReorder";
import type { BinderStore, Folder, Project, Scene, SceneStatus } from "./binderStore";
import { getDb } from "./schema";

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
    return id;
  }

  async createFolder(args: {
    projectId: string;
    title: string;
  }): Promise<string> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const rows = await db.select<{ cnt: number }[]>(
      "SELECT COUNT(*) as cnt FROM folders WHERE project_id = $1",
      [args.projectId]
    );
    const count = rows[0]?.cnt ?? 0;
    const sort_order = (count + 1) * 1000;
    await db.execute(
      "INSERT INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
      [id, args.projectId, args.title, sort_order]
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
    let rows: { cnt: number }[];
    if (args.folderId !== null) {
      rows = await db.select<{ cnt: number }[]>(
        "SELECT COUNT(*) as cnt FROM scenes WHERE project_id = $1 AND folder_id = $2",
        [args.projectId, args.folderId]
      );
    } else {
      rows = await db.select<{ cnt: number }[]>(
        "SELECT COUNT(*) as cnt FROM scenes WHERE project_id = $1 AND folder_id IS NULL",
        [args.projectId]
      );
    }
    const count = rows[0]?.cnt ?? 0;
    const sort_order = (count + 1) * 1000;
    await db.execute(
      "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status) VALUES ($1, $2, $3, $4, NULL, $5, 0, 'blank')",
      [id, args.projectId, args.folderId, args.title, sort_order]
    );
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
    const scenes = await db.select<Scene[]>(
      "SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status FROM scenes WHERE project_id = $1 ORDER BY sort_order ASC",
      [projectId]
    );
    return { folders, scenes };
  }

  async deleteFolder(folderId: string): Promise<void> {
    const db = await getDb();
    // Move scenes to Short pieces (folder_id = NULL) — never delete prose.
    await db.execute(
      "UPDATE scenes SET folder_id = NULL WHERE folder_id = $1",
      [folderId]
    );
    // Delete the folder row.
    await db.execute("DELETE FROM folders WHERE id = $1", [folderId]);
  }

  async renameFolder(folderId: string, title: string): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE folders SET title=$1 WHERE id=$2", [
      title,
      folderId,
    ]);
  }

  async renameScene(sceneId: string, title: string): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE scenes SET title=$1 WHERE id=$2", [
      title,
      sceneId,
    ]);
  }

  async setSceneStatus(sceneId: string, status: SceneStatus): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE scenes SET status=$1 WHERE id=$2", [
      status,
      sceneId,
    ]);
  }

  async deleteScene(sceneId: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM scenes WHERE id=$1", [sceneId]);
  }

  async moveScene(
    sceneId: string,
    toFolderId: string | null,
    toIndex: number
  ): Promise<void> {
    const db = await getDb();
    // Look up scene to get project_id before mutating.
    const rows = await db.select<Pick<Scene, "id" | "project_id">[]>(
      "SELECT id, project_id FROM scenes WHERE id=$1",
      [sceneId]
    );
    if (rows.length === 0) return;
    const { project_id } = rows[0];
    // Move the scene to the target folder.
    await db.execute("UPDATE scenes SET folder_id=$1 WHERE id=$2", [
      toFolderId,
      sceneId,
    ]);
    // Load the destination container (includes moved item now).
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
  }

  async moveFolder(folderId: string, toIndex: number): Promise<void> {
    const db = await getDb();
    const folderRows = await db.select<Pick<Folder, "id" | "project_id">[]>(
      "SELECT id, project_id FROM folders WHERE id=$1",
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
  }
}
