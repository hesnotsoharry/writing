import type { BinderStore, Folder, Project, Scene, SceneStatus } from "../shared/binderStore";
import { computeReorder } from "../shared/computeReorder";
import type { DbClient } from "../shared/dbClient";
import { normalizeStatus } from "../shared/status";
import { MobileArchiveStore } from "./mobileArchiveStore";
import { bootstrapMobileProjectBible } from "./mobileBibleLocalBridge";
import { MobileBoardsStore } from "./mobileBoardsStore";
import {
  bootstrapMobileProjectMeta,
  bridgeMobileFolder,
  bridgeMobileRemoved,
  bridgeMobileScene,
} from "./mobileMetaBridge";

interface RawScene extends Omit<Scene, "status" | "excludeFromAi"> {
  status: string;
  exclude_from_ai: number;
}

export class MobileBinderStore implements BinderStore {
  private readonly archive: MobileArchiveStore;
  private readonly boards: MobileBoardsStore;
  constructor(private readonly db: DbClient) {
    this.archive = new MobileArchiveStore(db);
    this.boards = new MobileBoardsStore(db);
  }

  listProjects(): Promise<Project[]> {
    return this.db.select("SELECT id, title, type, sort_order, created_at, updated_at FROM projects ORDER BY sort_order");
  }

  async createProject(args: { title: string; type: string }): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const rows = await this.db.select<{ count: number }[]>("SELECT COUNT(*) AS count FROM projects");
    await this.db.execute(
      `INSERT INTO projects (id, title, type, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, args.title, args.type, ((rows[0]?.count ?? 0) + 1) * 1000, now, now],
    );
    await Promise.all([
      bootstrapMobileProjectMeta({ id, title: args.title, type: args.type }),
      bootstrapMobileProjectBible(id),
      this.boards.ensureDefaultBoard(id),
    ]);
    return id;
  }

  async createFolder(args: { projectId: string; title: string }): Promise<string> {
    const id = crypto.randomUUID();
    const rows = await this.containerRows("folders", args.projectId, null);
    await this.db.execute(
      "INSERT INTO folders (id, project_id, title, sort_order) VALUES (?, ?, ?, ?)",
      [id, args.projectId, args.title, nextSortFrom(rows)],
    );
    await bridgeMobileFolder({ id, projectId: args.projectId, title: args.title }, [...idsOf(rows), id]);
    return id;
  }

  async createScene(args: { projectId: string; folderId: string | null; title: string }): Promise<string> {
    const id = crypto.randomUUID();
    const rows = await this.containerRows("scenes", args.projectId, args.folderId);
    await this.db.execute(
      `INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status)
       VALUES (?, ?, ?, ?, NULL, ?, 0, 'blank')`,
      [id, args.projectId, args.folderId, args.title, nextSortFrom(rows)],
    );
    await bridgeMobileScene({
      id, projectId: args.projectId, folderId: args.folderId,
      title: args.title, synopsis: null, status: "blank",
    }, [...idsOf(rows), id]);
    return id;
  }

  private async containerIds(table: "folders" | "scenes", projectId: string, folderId: string | null): Promise<string[]> {
    return idsOf(await this.containerRows(table, projectId, folderId));
  }

  private async containerRows(
    table: "folders" | "scenes", projectId: string, folderId: string | null,
  ): Promise<Array<{ id: string; sort_order: number }>> {
    const folderSql = "SELECT id, sort_order FROM folders WHERE project_id = ? ORDER BY sort_order, id";
    const sceneSql = folderId === null
      ? "SELECT id, sort_order FROM scenes WHERE project_id = ? AND folder_id IS NULL ORDER BY sort_order, id"
      : "SELECT id, sort_order FROM scenes WHERE project_id = ? AND folder_id = ? ORDER BY sort_order, id";
    const params = table === "folders" || folderId === null ? [projectId] : [projectId, folderId];
    return this.db.select(table === "folders" ? folderSql : sceneSql, params);
  }

  async loadProject(projectId: string): Promise<{ folders: Folder[]; scenes: Scene[] }> {
    const folders = await this.db.select<Folder[]>(
      "SELECT id, project_id, title, sort_order FROM folders WHERE project_id = ? ORDER BY sort_order", [projectId],
    );
    const rows = await this.db.select<RawScene[]>(
      `SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status, exclude_from_ai
       FROM scenes WHERE project_id = ? ORDER BY sort_order`, [projectId],
    );
    return {
      folders,
      scenes: rows.map((row) => ({
        ...row, status: normalizeStatus(row.status), excludeFromAi: row.exclude_from_ai === 1,
      })),
    };
  }

  async deleteFolder(folderId: string): Promise<void> {
    const folders = await this.db.select<Folder[]>(
      "SELECT id, project_id, title, sort_order FROM folders WHERE id = ?", [folderId],
    );
    const folder = folders[0];
    if (!folder) return;
    const relocated = await this.appendFolderScenesToShortPieces(folderId, folder.project_id);
    await this.db.execute("DELETE FROM folders WHERE id = ?", [folderId]);
    await bridgeMobileRemoved(folder.project_id, [{ kind: "folder", id: folderId }]);
    for (const sceneId of relocated.movedIds) await this.bridgeSceneById(sceneId, relocated.order);
  }

  private async appendFolderScenesToShortPieces(
    folderId: string, projectId: string,
  ): Promise<{ order: string[]; movedIds: string[] }> {
    const moved = await this.db.select<{ id: string }[]>(
      "SELECT id FROM scenes WHERE folder_id = ? ORDER BY sort_order, id", [folderId],
    );
    const existing = await this.containerIds("scenes", projectId, null);
    await this.db.execute("UPDATE scenes SET folder_id = NULL WHERE folder_id = ?", [folderId]);
    const movedIds = moved.map(({ id }) => id);
    const order = [...existing, ...movedIds];
    if (movedIds.length > 0) {
      for (let i = 0; i < order.length; i++) {
        await this.db.execute("UPDATE scenes SET sort_order = ? WHERE id = ?", [(i + 1) * 1000, order[i]]);
      }
    }
    return { order, movedIds };
  }

  async renameFolder(folderId: string, title: string): Promise<void> {
    await this.db.execute("UPDATE folders SET title = ? WHERE id = ?", [title, folderId]);
    const rows = await this.db.select<Folder[]>("SELECT id, project_id, title, sort_order FROM folders WHERE id = ?", [folderId]);
    const row = rows[0];
    if (row) await bridgeMobileFolder({ id: row.id, projectId: row.project_id, title: row.title });
  }

  async renameScene(sceneId: string, title: string): Promise<void> {
    await this.db.execute("UPDATE scenes SET title = ? WHERE id = ?", [title, sceneId]);
    await this.bridgeSceneById(sceneId);
  }

  async setSceneStatus(sceneId: string, status: SceneStatus): Promise<void> {
    await this.db.execute("UPDATE scenes SET status = ? WHERE id = ?", [status, sceneId]);
    await this.bridgeSceneById(sceneId);
  }

  async setSceneExcludedFromAi(sceneId: string, exclude: boolean): Promise<void> {
    await this.db.execute("UPDATE scenes SET exclude_from_ai = ? WHERE id = ?", [exclude ? 1 : 0, sceneId]);
  }

  async setSceneSynopsis(sceneId: string, synopsis: string | null): Promise<void> {
    await this.db.execute("UPDATE scenes SET synopsis = ? WHERE id = ?", [synopsis, sceneId]);
    await this.bridgeSceneById(sceneId);
  }

  async setSceneWordCount(sceneId: string, wordCount: number): Promise<boolean> {
    return (await this.db.execute("UPDATE scenes SET word_count = ? WHERE id = ?", [wordCount, sceneId])).rowsAffected > 0;
  }

  async deleteScene(sceneId: string): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM scenes WHERE id = ?", [sceneId]);
    await deleteMobileSceneDependents(this.db, sceneId);
    await this.db.execute("DELETE FROM scenes WHERE id = ?", [sceneId]);
    if (rows[0]) await bridgeMobileRemoved(rows[0].project_id, [{ kind: "scene", id: sceneId }]);
  }

  async moveScene(sceneId: string, toFolderId: string | null, toIndex: number): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM scenes WHERE id = ?", [sceneId]);
    const projectId = rows[0]?.project_id;
    if (!projectId) return;
    await this.db.execute("UPDATE scenes SET folder_id = ? WHERE id = ?", [toFolderId, sceneId]);
    const ids = await this.containerIds("scenes", projectId, toFolderId);
    const updates = computeReorder(ids.map((id) => ({ id })), sceneId, toIndex);
    for (const row of updates) await this.db.execute("UPDATE scenes SET sort_order = ? WHERE id = ?", [row.sort_order, row.id]);
    await this.bridgeSceneById(sceneId, updates.map(({ id }) => id));
  }

  async moveFolder(folderId: string, toIndex: number): Promise<void> {
    const rows = await this.db.select<Folder[]>("SELECT id, project_id, title, sort_order FROM folders WHERE id = ?", [folderId]);
    const folder = rows[0];
    if (!folder) return;
    const ids = await this.containerIds("folders", folder.project_id, null);
    const updates = computeReorder(ids.map((id) => ({ id })), folderId, toIndex);
    for (const row of updates) await this.db.execute("UPDATE folders SET sort_order = ? WHERE id = ?", [row.sort_order, row.id]);
    await bridgeMobileFolder(
      { id: folder.id, projectId: folder.project_id, title: folder.title },
      updates.map(({ id }) => id),
    );
  }

  private async bridgeSceneById(sceneId: string, order?: string[]): Promise<void> {
    const rows = await this.db.select<RawScene[]>(
      `SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status, exclude_from_ai
       FROM scenes WHERE id = ?`, [sceneId],
    );
    const row = rows[0];
    if (row) await bridgeMobileScene({
      id: row.id, projectId: row.project_id, folderId: row.folder_id,
      title: row.title, synopsis: row.synopsis, status: normalizeStatus(row.status),
    }, order);
  }

  async duplicateScene(sceneId: string): Promise<string | null> {
    const rows = await this.db.select<RawScene[]>(
      `SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status, exclude_from_ai
       FROM scenes WHERE id = ?`, [sceneId],
    );
    const source = rows[0];
    if (!source) return null;
    const id = await this.createScene({ projectId: source.project_id, folderId: source.folder_id, title: `${source.title} copy` });
    await this.db.execute(
      "UPDATE scenes SET synopsis = ?, word_count = ?, status = ?, exclude_from_ai = ? WHERE id = ?",
      [source.synopsis, source.word_count, normalizeStatus(source.status), source.exclude_from_ai, id],
    );
    const docs = await this.db.select<{ state_base64: string; plaintext_projection: string | null }[]>(
      "SELECT state_base64, plaintext_projection FROM scene_docs WHERE scene_id = ?", [sceneId],
    );
    if (docs[0]) await this.db.execute(
      "INSERT INTO scene_docs (scene_id, state_base64, plaintext_projection) VALUES (?, ?, ?)",
      [id, docs[0].state_base64, docs[0].plaintext_projection],
    );
    await this.bridgeSceneById(id);
    return id;
  }

  archiveScene(sceneId: string, projectId: string): Promise<void> { return this.archive.archiveScene(sceneId, projectId); }
  archiveChapter(folderId: string, projectId: string): Promise<void> { return this.archive.archiveChapter(folderId, projectId); }
  listArchived(projectId: string) { return this.archive.listArchived(projectId); }
  restoreArchived(id: string): Promise<void> { return this.archive.restoreArchived(id); }
  purgeArchived(id: string): Promise<void> { return this.archive.purgeArchived(id); }
  archivedCount(projectId: string): Promise<number> { return this.archive.archivedCount(projectId); }
}

function idsOf(rows: Array<{ id: string }>): string[] {
  return rows.map(({ id }) => id);
}

function nextSortFrom(rows: Array<{ sort_order: number }>): number {
  let max = 0;
  for (const row of rows) {
    if (row.sort_order > max) max = row.sort_order;
  }
  return max + 1000;
}

async function deleteMobileSceneDependents(db: DbClient, sceneId: string): Promise<void> {
  await db.execute("DELETE FROM scene_docs WHERE scene_id = ?", [sceneId]);
  await db.execute("DELETE FROM scene_snapshots WHERE scene_id = ?", [sceneId]);
  await db.execute("DELETE FROM scene_labels WHERE scene_id = ?", [sceneId]);
  await db.execute("DELETE FROM scene_links WHERE scene_id = ?", [sceneId]);
}
