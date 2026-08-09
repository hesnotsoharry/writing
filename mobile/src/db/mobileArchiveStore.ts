import type { ArchivedItem, Folder, Scene } from "../shared/binderStore";
import type { DbClient } from "../shared/dbClient";
import { normalizeStatus } from "../shared/status";
import { type ArchiveRestorePlan, parseArchiveManifest } from "./mobileArchiveManifest";
import { MobileEpochOwner } from "./mobileEpochOwner";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";
import { bridgeMobileRemoved, bridgeMobileRestored, type MobileSceneRow } from "./mobileMetaBridge";
import { MobileSceneDocStore } from "./syncStores/mobileSceneDocStore";

interface ArchiveRow {
  id: string; project_id: string; kind: string; original_id: string | null;
  title: string; sub: string | null; state_base64: string | null; archived_at: number;
}
interface SceneManifest {
  id: string; title: string; synopsis: string | null; status: string;
  sortOrder: number; wordCount: number; doc: string | null;
}

async function loadSceneManifest(db: DbClient, scene: Scene): Promise<SceneManifest> {
  const docs = await db.select<{ state_base64: string }[]>(
    "SELECT state_base64 FROM scene_docs WHERE scene_id = ?", [scene.id],
  );
  return {
    id: scene.id, title: scene.title, synopsis: scene.synopsis,
    status: normalizeStatus(scene.status), sortOrder: scene.sort_order,
    wordCount: scene.word_count, doc: docs[0]?.state_base64 ?? null,
  };
}

export class MobileArchiveStore {
  constructor(
    private readonly db: DbClient,
    private readonly epochOwner: {
      replaceThroughEpoch(input: {
        projectId: string; sceneId: string; stateBase64: string | null;
      }): Promise<unknown>;
    } = new MobileEpochOwner(db, new MobileSceneDocStore(db)),
  ) {}

  async archiveScene(sceneId: string, projectId: string): Promise<void> {
    const rows = await this.db.select<Scene[]>(
      `SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status
       FROM scenes WHERE id = ? AND project_id = ?`, [sceneId, projectId],
    );
    const scene = rows[0];
    if (!scene) return;
    const manifest = await loadSceneManifest(this.db, scene);
    const folder = scene.folder_id === null ? [] : await this.db.select<{ title: string }[]>(
      "SELECT title FROM folders WHERE id = ?", [scene.folder_id],
    );
    const archiveId = await this.insertArchive({
      projectId, kind: "scene", originalId: scene.id, title: scene.title,
      sub: folder[0]?.title ?? "Short pieces", manifest,
    });
    mobileLocalWrites.notify({ domain: "archive", projectId, rowId: archiveId, deleted: false });
    await this.db.execute("DELETE FROM scene_docs WHERE scene_id = ?", [sceneId]);
    await this.db.execute("DELETE FROM scenes WHERE id = ?", [sceneId]);
    await bridgeMobileRemoved(projectId, [{ kind: "scene", id: sceneId }]);
  }

  async archiveChapter(folderId: string, projectId: string): Promise<void> {
    const folders = await this.db.select<Folder[]>(
      "SELECT id, project_id, title, sort_order FROM folders WHERE id = ? AND project_id = ?",
      [folderId, projectId],
    );
    const folder = folders[0];
    if (!folder) return;
    const scenes = await this.db.select<Scene[]>(
      `SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status
       FROM scenes WHERE folder_id = ? ORDER BY sort_order`, [folderId],
    );
    const entries: SceneManifest[] = [];
    for (const scene of scenes) entries.push(await loadSceneManifest(this.db, scene));
    const archiveId = await this.insertArchive({
      projectId, kind: "chapter", originalId: folderId, title: folder.title,
      sub: `${scenes.length} scenes`, manifest: {
        folderSortOrder: folder.sort_order, scenes: entries,
      },
    });
    mobileLocalWrites.notify({ domain: "archive", projectId, rowId: archiveId, deleted: false });
    for (const scene of scenes) await this.db.execute("DELETE FROM scene_docs WHERE scene_id = ?", [scene.id]);
    await this.db.execute("DELETE FROM scenes WHERE folder_id = ?", [folderId]);
    await this.db.execute("DELETE FROM folders WHERE id = ?", [folderId]);
    await bridgeMobileRemoved(projectId, [
      { kind: "folder", id: folderId }, ...scenes.map(({ id }) => ({ kind: "scene" as const, id })),
    ]);
  }

  private async insertArchive(input: {
    projectId: string; kind: string; originalId: string; title: string;
    sub: string; manifest: unknown;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.execute(
      `INSERT INTO archive (id, project_id, kind, original_id, title, sub, state_base64, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, input.projectId, input.kind, input.originalId,
        input.title, input.sub, JSON.stringify(input.manifest), Date.now(),
      ],
    );
    return id;
  }

  async listArchived(projectId: string): Promise<ArchivedItem[]> {
    const rows = await this.db.select<ArchiveRow[]>(
      `SELECT id, project_id, kind, original_id, title, sub, state_base64, archived_at
       FROM archive WHERE project_id = ? ORDER BY archived_at DESC`, [projectId],
    );
    return rows.map((row) => ({
      id: row.id, kind: row.kind === "chapter" ? "chapter" : "scene",
      originalId: row.original_id, title: row.title, sub: row.sub, archivedAt: row.archived_at,
    }));
  }

  async getRestorePlan(archiveId: string): Promise<ArchiveRestorePlan | null> {
    const rows = await this.db.select<ArchiveRow[]>(
      `SELECT id, project_id, kind, original_id, title, sub, state_base64, archived_at
       FROM archive WHERE id = ?`, [archiveId],
    );
    const row = rows[0];
    if (!row) return null;
    return parseArchiveManifest({
      id: row.id, projectId: row.project_id,
      kind: row.kind === "chapter" ? "chapter" : "scene",
      originalId: row.original_id, title: row.title, stateBase64: row.state_base64,
    });
  }

  async publishRestoredOwnership(plan: ArchiveRestorePlan): Promise<void> {
    if (plan.folder) await this.upsertFolder(plan);
    for (const scene of plan.scenes) await this.upsertScene(plan.projectId, scene);
    const folderRows = await this.db.select<{ id: string }[]>(
      "SELECT id FROM folders WHERE project_id = ? ORDER BY sort_order, id", [plan.projectId],
    );
    const sceneOrders = new Map<string, string[]>();
    for (const folderId of new Set(plan.scenes.map((scene) => scene.folderId))) {
      const sql = folderId === null
        ? "SELECT id FROM scenes WHERE project_id = ? AND folder_id IS NULL ORDER BY sort_order, id"
        : "SELECT id FROM scenes WHERE project_id = ? AND folder_id = ? ORDER BY sort_order, id";
      const params = folderId === null ? [plan.projectId] : [plan.projectId, folderId];
      const scenes = await this.db.select<{ id: string }[]>(sql, params);
      sceneOrders.set(folderId ?? "", scenes.map(({ id }) => id));
    }
    await bridgeMobileRestored(plan.projectId,
      plan.folder ? [{ id: plan.folder.id, projectId: plan.projectId, title: plan.folder.title }] : [],
      plan.scenes.map((scene) => this.sceneBridgeRow(plan.projectId, scene.folderId, scene)), {
      folders: folderRows.map(({ id }) => id), scenes: sceneOrders,
    });
  }

  async handoffRestoredScene(
    scene: ArchiveRestorePlan["scenes"][number], projectId: string,
  ): Promise<void> {
    await this.epochOwner.replaceThroughEpoch({
      projectId, sceneId: scene.id, stateBase64: scene.stateBase64,
    });
  }

  async removeRestoredArchive(plan: ArchiveRestorePlan): Promise<void> {
    await this.db.execute("DELETE FROM archive WHERE id = ?", [plan.archiveId]);
    mobileLocalWrites.notify({
      domain: "archive", projectId: plan.projectId, rowId: plan.archiveId, deleted: true,
    });
  }

  async restoreArchived(archiveId: string): Promise<void> {
    const plan = await this.getRestorePlan(archiveId);
    if (!plan) return;
    await this.publishRestoredOwnership(plan);
    for (const scene of plan.scenes) await this.handoffRestoredScene(scene, plan.projectId);
    await this.removeRestoredArchive(plan);
  }

  private async upsertFolder(plan: ArchiveRestorePlan): Promise<void> {
    if (!plan.folder) return;
    await this.db.execute(
      `INSERT INTO folders (id, project_id, title, sort_order) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,
       title=excluded.title, sort_order=excluded.sort_order`,
      [plan.folder.id, plan.projectId, plan.folder.title, plan.folder.sortOrder],
    );
  }

  private async upsertScene(
    projectId: string, scene: ArchiveRestorePlan["scenes"][number],
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO scenes
       (id, project_id, folder_id, title, synopsis, sort_order, word_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,
       folder_id=excluded.folder_id, title=excluded.title, synopsis=excluded.synopsis,
       sort_order=excluded.sort_order, word_count=excluded.word_count, status=excluded.status`,
      [scene.id, projectId, scene.folderId, scene.title, scene.synopsis,
        scene.sortOrder, scene.wordCount, normalizeStatus(scene.status)],
    );
  }

  private sceneBridgeRow(
    projectId: string, folderId: string | null,
    row: Pick<SceneManifest, "id" | "title" | "synopsis" | "status">,
  ): MobileSceneRow {
    return {
      id: row.id, projectId, folderId, title: row.title,
      synopsis: row.synopsis, status: normalizeStatus(row.status),
    };
  }

  async purgeArchived(archiveId: string): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>(
      "SELECT project_id FROM archive WHERE id = ?", [archiveId],
    );
    await this.db.execute("DELETE FROM archive WHERE id = ?", [archiveId]);
    if (rows[0]) mobileLocalWrites.notify({
      domain: "archive", projectId: rows[0].project_id, rowId: archiveId, deleted: true,
    });
  }

  async archivedCount(projectId: string): Promise<number> {
    const rows = await this.db.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM archive WHERE project_id = ?", [projectId],
    );
    return rows[0]?.count ?? 0;
  }
}
