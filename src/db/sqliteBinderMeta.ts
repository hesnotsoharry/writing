import { normalizeStatus } from "../lib/status";
import { bridgeFolder, bridgeScene } from "../sync/meta/localBridge";
import { getDb } from "./schema";

function report(operation: string, task: Promise<void>): void {
  void task.catch((error: unknown) => console.error(`[sync-meta] ${operation}`, error));
}

async function loadAndBridgeFolder(folderId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<Array<{ id: string; project_id: string; title: string }>>(
    "SELECT id, project_id, title FROM folders WHERE id=$1", [folderId]
  );
  const row = rows[0];
  if (row) bridgeFolder({ id: row.id, projectId: row.project_id, title: row.title });
}

async function loadAndBridgeScene(sceneId: string, orderedIds?: string[]): Promise<void> {
  const db = await getDb();
  const rows = await db.select<Array<{
    id: string; project_id: string; folder_id: string | null; title: string;
    synopsis: string | null; status: string;
  }>>(
    "SELECT id, project_id, folder_id, title, synopsis, status FROM scenes WHERE id=$1",
    [sceneId]
  );
  const row = rows[0];
  if (row) bridgeScene({
    id: row.id, projectId: row.project_id, folderId: row.folder_id, title: row.title,
    synopsis: row.synopsis, status: normalizeStatus(row.status),
  }, orderedIds);
}

async function loadAndBridgeRootMoves(projectId: string, sceneIds: string[]): Promise<void> {
  const db = await getDb();
  const ordered = await db.select<Array<{ id: string }>>(
    `SELECT id FROM scenes WHERE project_id=$1 AND folder_id IS NULL
     ORDER BY sort_order ASC, id ASC`,
    [projectId]
  );
  const orderedIds = ordered.map(({ id }) => id);
  for (const sceneId of sceneIds) await loadAndBridgeScene(sceneId, orderedIds);
}

export function bridgeFolderById(folderId: string, operation: string): void {
  report(operation, loadAndBridgeFolder(folderId));
}

export function bridgeSceneById(sceneId: string, operation: string): void {
  report(operation, loadAndBridgeScene(sceneId));
}

export function bridgeRootMoves(projectId: string, sceneIds: string[]): void {
  report("folder delete scene move", loadAndBridgeRootMoves(projectId, sceneIds));
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
