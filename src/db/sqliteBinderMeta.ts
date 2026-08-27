import { normalizeStatus } from "../lib/status";
import { runLocalMetaWrite } from "../sync/meta/bridge";
import {
  applyFolderMutation,
  applyRemoved,
  applySceneMutation,
  type LocalSceneRow,
} from "../sync/meta/localMutators";
import { getDb } from "./schema";

type SceneRow = {
  id: string; project_id: string; folder_id: string | null; title: string;
  synopsis: string | null; status: string;
};

function asScene(row: SceneRow): LocalSceneRow {
  return {
    id: row.id, projectId: row.project_id, folderId: row.folder_id, title: row.title,
    synopsis: row.synopsis, status: normalizeStatus(row.status),
  };
}

async function loadSceneRow(sceneId: string): Promise<LocalSceneRow | undefined> {
  const db = await getDb();
  const rows = await db.select<SceneRow[]>(
    "SELECT id, project_id, folder_id, title, synopsis, status FROM scenes WHERE id=$1",
    [sceneId]
  );
  return rows[0] ? asScene(rows[0]) : undefined;
}

async function loadFolderRow(folderId: string): Promise<{
  id: string; projectId: string; title: string;
} | undefined> {
  const db = await getDb();
  const rows = await db.select<Array<{ id: string; project_id: string; title: string }>>(
    "SELECT id, project_id, title FROM folders WHERE id=$1", [folderId]
  );
  const row = rows[0];
  return row ? { id: row.id, projectId: row.project_id, title: row.title } : undefined;
}

export async function boundSceneSql(
  sceneId: string,
  sqlWrite: () => Promise<unknown>,
  orderedIds?: string[],
): Promise<void> {
  const projectId = await captureSceneDelete(sceneId);
  if (!projectId) { await sqlWrite(); return; }
  await runLocalMetaWrite(projectId, async () => {
    await sqlWrite();
    return loadSceneRow(sceneId);
  }, (doc, row) => { if (row) applySceneMutation(doc, row, orderedIds); });
}

export async function boundFolderSql(
  folderId: string,
  sqlWrite: () => Promise<unknown>,
  orderedIds?: string[],
): Promise<void> {
  const folder = await loadFolderRow(folderId);
  if (!folder) { await sqlWrite(); return; }
  await runLocalMetaWrite(folder.projectId, async () => {
    await sqlWrite();
    return loadFolderRow(folderId);
  }, (doc, row) => { if (row) applyFolderMutation(doc, row, orderedIds); });
}

export async function boundSceneDelete(
  sceneId: string, sqlWrite: () => Promise<unknown>,
): Promise<void> {
  const projectId = await captureSceneDelete(sceneId);
  if (!projectId) { await sqlWrite(); return; }
  await runLocalMetaWrite(projectId, async () => {
    await sqlWrite();
  }, (doc) => applyRemoved(doc, [{ kind: "scene", id: sceneId }]));
}

export async function captureFolderDelete(folderId: string): Promise<{
  projectId: string; sceneIds: string[];
} | undefined> {
  try {
    const db = await getDb();
    const folders = await db.select<Array<{ project_id: string }>>(
      "SELECT project_id FROM folders WHERE id=$1", [folderId]
    );
    const projectId = folders[0]?.project_id;
    if (!projectId) return undefined;
    const scenes = await db.select<Array<{ id: string }>>(
      "SELECT id FROM scenes WHERE folder_id=$1 ORDER BY sort_order ASC, id ASC", [folderId]
    );
    return { projectId, sceneIds: scenes.map(({ id }) => id) };
  } catch (error) {
    console.error("[sync-meta] folder delete capture", error);
    return undefined;
  }
}

export async function captureSceneDelete(sceneId: string): Promise<string | undefined> {
  try {
    const db = await getDb();
    const rows = await db.select<Array<{ project_id: string }>>(
      "SELECT project_id FROM scenes WHERE id=$1", [sceneId]
    );
    return rows[0]?.project_id;
  } catch (error) {
    console.error("[sync-meta] scene delete capture", error);
    return undefined;
  }
}

export async function loadRootScenes(projectId: string): Promise<LocalSceneRow[]> {
  const db = await getDb();
  const rows = await db.select<SceneRow[]>(
    `SELECT id, project_id, folder_id, title, synopsis, status FROM scenes
     WHERE project_id=$1 AND folder_id IS NULL ORDER BY sort_order ASC, id ASC`,
    [projectId]
  );
  return rows.map(asScene);
}
