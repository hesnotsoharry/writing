/**
 * Archive helpers + standalone archive-method implementations for SqliteBinderStore (Wave 22).
 * Extracted to keep sqliteBinderStore.ts within the 300-line file limit.
 * Not exported from the module barrel — archive-internal only.
 */

import type * as Y from "yjs";

import { normalizeStatus } from "../lib/status";
import { desktopLwwBridges } from "../sync/desktopLwwBridges";
import { runLocalMetaWrite } from "../sync/meta/bridge";
import {
  applyFolderMutation,
  applyRemoved,
  applySceneMutation,
  type LocalFolderRow,
  type LocalSceneRow,
} from "../sync/meta/localMutators";
import { sceneLabelId } from "../sync/meta/metaDoc";
import type { ArchivedItem, Folder, Scene } from "./binderStore";
import type { DbClient } from "./dbClient";
import { getDb } from "./schema";
import {
  restoreChapterRow,
  restoreSceneRow,
  type SceneManifestEntry,
} from "./sqliteArchiveRestore";
import { SqliteSceneDocStore } from "./sqliteSceneDocStore";

export type { SceneManifestEntry };

const sceneDocStore = new SqliteSceneDocStore();



/**
 * Resolve the `sub` label for a scene archive row.
 * Returns the parent folder's title, or "Short pieces" when folder_id is null.
 */
export async function resolveSceneSub(folderId: string | null): Promise<string> {
  if (folderId === null) return "Short pieces";
  const db = await getDb();
  const rows = await db.select<{ title: string }[]>(
    "SELECT title FROM folders WHERE id=$1",
    [folderId]
  );
  return rows[0]?.title ?? "Short pieces";
}

/**
 * For each scene, load its scene_docs.state_base64 and build the manifest entry.
 * Used by archiveChapter to capture every child scene's doc alongside its metadata.
 */
export async function buildSceneManifestEntries(
  scenes: Scene[]
): Promise<SceneManifestEntry[]> {
  const db = await getDb();
  const entries: SceneManifestEntry[] = [];
  for (const scene of scenes) {
    const docRows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM scene_docs WHERE scene_id=$1",
      [scene.id]
    );
    entries.push({
      id: scene.id,
      title: scene.title,
      meta: {
        synopsis: scene.synopsis,
        status: normalizeStatus(scene.status),
        sort_order: scene.sort_order,
        word_count: scene.word_count,
      },
      doc: docRows[0]?.state_base64 ?? null,
    });
  }
  return entries;
}

async function assignmentTombstones(sceneIds: string[]): Promise<Array<{
  kind: "sceneLabel"; id: string;
}>> {
  try {
    const db = await getDb();
    const result: Array<{ kind: "sceneLabel"; id: string }> = [];
    for (const sceneId of sceneIds) {
      const rows = await db.select<Array<{ label_id: string }>>(
        "SELECT label_id FROM scene_labels WHERE scene_id=$1", [sceneId]
      );
      for (const row of rows) {
        result.push({ kind: "sceneLabel", id: sceneLabelId(sceneId, row.label_id) });
      }
    }
    return result;
  } catch (error) {
    console.error("[sync-meta] archive assignment capture", error);
    return [];
  }
}

async function loadRestoredFolders(folderIds: string[]): Promise<LocalFolderRow[]> {
  const db = await getDb();
  const result: LocalFolderRow[] = [];
  for (const id of folderIds) {
    const rows = await db.select<Array<{ id: string; project_id: string; title: string }>>(
      "SELECT id, project_id, title FROM folders WHERE id=$1", [id]
    );
    if (rows[0]) result.push({
      id: rows[0].id, projectId: rows[0].project_id, title: rows[0].title,
    });
  }
  return result;
}

async function loadRestoredScenes(sceneIds: string[]): Promise<LocalSceneRow[]> {
  const db = await getDb();
  const result: LocalSceneRow[] = [];
  for (const id of sceneIds) {
    const rows = await db.select<Array<{
      id: string; project_id: string; folder_id: string | null; title: string;
      synopsis: string | null; status: string;
    }>>("SELECT id, project_id, folder_id, title, synopsis, status FROM scenes WHERE id=$1", [id]);
    if (rows[0]) result.push({
      id: rows[0].id, projectId: rows[0].project_id, folderId: rows[0].folder_id,
      title: rows[0].title, synopsis: rows[0].synopsis,
      status: normalizeStatus(rows[0].status),
    });
  }
  return result;
}

interface RestorePayload {
  folders: LocalFolderRow[]; scenes: LocalSceneRow[];
  folderOrder: string[]; sceneOrders: Map<string, string[]>;
}

async function loadRestorePayload(
  projectId: string, folderIds: string[], sceneIds: string[],
): Promise<RestorePayload> {
  const db = await getDb();
  const scenes = await loadRestoredScenes(sceneIds);
  const orderedFolders = await db.select<Array<{ id: string }>>(
    "SELECT id FROM folders WHERE project_id=$1 ORDER BY sort_order ASC", [projectId]
  );
  return {
    folders: await loadRestoredFolders(folderIds), scenes,
    folderOrder: orderedFolders.map(({ id }) => id),
    sceneOrders: await loadSceneOrders(db, projectId, scenes),
  };
}

function applyRestorePayload(doc: Y.Doc, payload: RestorePayload): void {
  for (const folder of payload.folders) applyFolderMutation(doc, folder, payload.folderOrder);
  for (const scene of payload.scenes) {
    applySceneMutation(doc, scene, payload.sceneOrders.get(scene.folderId ?? "") ?? [scene.id]);
  }
}

async function loadSceneOrders(
  db: DbClient,
  projectId: string,
  scenes: LocalSceneRow[],
): Promise<Map<string, string[]>> {
  const sceneOrders = new Map<string, string[]>();
  for (const folderId of new Set(scenes.map((scene) => scene.folderId))) {
    const sql = folderId === null
      ? "SELECT id FROM scenes WHERE project_id=$1 AND folder_id IS NULL ORDER BY sort_order ASC"
      : "SELECT id FROM scenes WHERE project_id=$1 AND folder_id=$2 ORDER BY sort_order ASC";
    const params = folderId === null ? [projectId] : [projectId, folderId];
    const ordered = await db.select<Array<{ id: string }>>(sql, params);
    sceneOrders.set(folderId ?? "", ordered.map(({ id }) => id));
  }
  return sceneOrders;
}

// ---------------------------------------------------------------------------
// Standalone archive-method implementations — delegated from SqliteBinderStore.
// Extracted so the store class stays within the 300-line file limit.
// ---------------------------------------------------------------------------

export async function sqliteArchiveScene(sceneId: string, projectId: string): Promise<void> {
  const db = await getDb();
  const sceneRows = await db.select<Scene[]>(
    "SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status FROM scenes WHERE id=$1 AND project_id=$2",
    [sceneId, projectId]
  );
  if (sceneRows.length === 0) return;
  const scene = sceneRows[0];
  const assignmentRows = await assignmentTombstones([sceneId]);
  const sub = await resolveSceneSub(scene.folder_id);
  const docRows = await db.select<{ state_base64: string }[]>(
    "SELECT state_base64 FROM scene_docs WHERE scene_id=$1", [sceneId]
  );
  const doc = docRows[0]?.state_base64 ?? null;
  const manifest = JSON.stringify({
    meta: { synopsis: scene.synopsis, status: normalizeStatus(scene.status), sort_order: scene.sort_order, word_count: scene.word_count },
    doc,
  });
  const archiveId = crypto.randomUUID();
  await runLocalMetaWrite(projectId, async () => {
    await db.execute(
      "INSERT INTO archive (id, project_id, kind, original_id, title, sub, state_base64, archived_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [archiveId, projectId, "scene", sceneId, scene.title, sub, manifest, Date.now()]
    );
    await desktopLwwBridges.archive.saved(projectId, archiveId);
    await db.execute("DELETE FROM scenes WHERE id=$1", [sceneId]);
    await sceneDocStore.delete(sceneId);
  }, (doc) => applyRemoved(doc, [{ kind: "scene", id: sceneId }, ...assignmentRows]));
}

export async function sqliteArchiveChapter(folderId: string, projectId: string): Promise<void> {
  const db = await getDb();
  const folderRows = await db.select<Folder[]>(
    "SELECT id, project_id, title, sort_order FROM folders WHERE id=$1 AND project_id=$2",
    [folderId, projectId]
  );
  if (folderRows.length === 0) return;
  const folder = folderRows[0];
  const childScenes = await db.select<Scene[]>(
    "SELECT id, project_id, folder_id, title, synopsis, sort_order, word_count, status FROM scenes WHERE folder_id=$1 ORDER BY sort_order ASC",
    [folderId]
  );
  const scenes = await buildSceneManifestEntries(childScenes);
  const assignmentRows = await assignmentTombstones(childScenes.map(({ id }) => id));
  const manifest = JSON.stringify({ folder: { sort_order: folder.sort_order }, scenes });
  const archiveId = crypto.randomUUID();
  await runLocalMetaWrite(projectId, async () => {
    await db.execute(
      "INSERT INTO archive (id, project_id, kind, original_id, title, sub, state_base64, archived_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [archiveId, projectId, "chapter", folderId, folder.title, `${childScenes.length} scenes`, manifest, Date.now()]
    );
    await desktopLwwBridges.archive.saved(projectId, archiveId);
    await db.execute("DELETE FROM scenes WHERE folder_id=$1", [folderId]);
    await db.execute("DELETE FROM folders WHERE id=$1", [folderId]);
    for (const scene of childScenes) await sceneDocStore.delete(scene.id);
  }, (doc) => applyRemoved(doc, [
    { kind: "folder", id: folderId },
    ...childScenes.map(({ id }) => ({ kind: "scene" as const, id })),
    ...assignmentRows,
  ]));
}

export async function sqliteListArchived(projectId: string): Promise<ArchivedItem[]> {
  const db = await getDb();
  const rows = await db.select<{
    id: string; kind: string; original_id: string | null;
    title: string; sub: string | null; archived_at: number;
  }[]>(
    "SELECT id, kind, original_id, title, sub, archived_at FROM archive WHERE project_id=$1 ORDER BY archived_at DESC",
    [projectId]
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ArchivedItem["kind"],
    originalId: r.original_id,
    title: r.title,
    sub: r.sub,
    archivedAt: r.archived_at,
  }));
}

export async function sqliteRestoreArchived(archiveId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{
    kind: string; original_id: string | null; title: string;
    project_id: string; state_base64: string | null;
  }[]>(
    "SELECT kind, original_id, title, project_id, state_base64 FROM archive WHERE id=$1",
    [archiveId]
  );
  if (rows.length === 0) return;
  const row = rows[0];
  const manifest = JSON.parse(row.state_base64 ?? "{}") as Record<string, unknown>;
  await runLocalMetaWrite(row.project_id, async () => {
    const ids = row.kind === "scene"
      ? { folderIds: [] as string[], sceneIds: [await restoreSceneRow(row.original_id, row.title, row.project_id, manifest)] }
      : await restoreChapterIds(row, manifest);
    await db.execute("DELETE FROM archive WHERE id=$1", [archiveId]);
    await desktopLwwBridges.archive.deleted(row.project_id, archiveId);
    return loadRestorePayload(row.project_id, ids.folderIds, ids.sceneIds);
  }, applyRestorePayload);
}

async function restoreChapterIds(
  row: { original_id: string | null; title: string; project_id: string },
  manifest: Record<string, unknown>,
): Promise<{ folderIds: string[]; sceneIds: string[] }> {
  const restored = await restoreChapterRow(row.original_id, row.title, row.project_id, manifest);
  return { folderIds: [restored.folderId], sceneIds: restored.sceneIds };
}

export async function sqlitePurgeArchived(archiveId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<Array<{ project_id: string }>>("SELECT project_id FROM archive WHERE id=$1", [archiveId]);
  await db.execute("DELETE FROM archive WHERE id=$1", [archiveId]);
  if (rows[0]) await desktopLwwBridges.archive.deleted(rows[0].project_id, archiveId);
}

export async function sqliteArchivedCount(projectId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM archive WHERE project_id=$1", [projectId]
  );
  return rows[0]?.cnt ?? 0;
}
