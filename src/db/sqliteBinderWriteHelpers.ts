import type { DbClient } from "./dbClient";

/** Next gap key after the highest existing sort_order (1000 on an empty container). */
export function nextSortOrder(rows: { sort_order: number }[]): number {
  let max = 0;
  for (const row of rows) {
    if (row.sort_order > max) max = row.sort_order;
  }
  return max + 1000;
}

export async function loadContainerScenes(
  db: DbClient,
  projectId: string,
  folderId: string | null,
): Promise<Array<{ id: string; sort_order: number }>> {
  if (folderId !== null) {
    return db.select(
      `SELECT id, sort_order FROM scenes
       WHERE project_id = $1 AND folder_id = $2
       ORDER BY sort_order ASC, id ASC`,
      [projectId, folderId],
    );
  }
  return db.select(
    `SELECT id, sort_order FROM scenes
     WHERE project_id = $1 AND folder_id IS NULL
     ORDER BY sort_order ASC, id ASC`,
    [projectId],
  );
}

export async function applySceneSortOrders(db: DbClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    await db.execute("UPDATE scenes SET sort_order=$1 WHERE id=$2", [(i + 1) * 1000, ids[i]]);
  }
}

/** Drop per-scene rows that would otherwise survive a scenes-row delete. */
export async function deleteSceneDependents(db: DbClient, sceneId: string): Promise<void> {
  await db.execute("DELETE FROM scene_docs WHERE scene_id=$1", [sceneId]);
  await db.execute("DELETE FROM scene_snapshots WHERE scene_id=$1", [sceneId]);
  await db.execute("DELETE FROM scene_labels WHERE scene_id=$1", [sceneId]);
  await db.execute("DELETE FROM scene_links WHERE scene_id=$1", [sceneId]);
}

/**
 * Move a folder's scenes onto Short pieces and give the combined list unique
 * sort_order keys: existing shorts first, then the moved scenes in chapter order.
 */
export async function relocateFolderScenes(
  db: DbClient,
  folderId: string,
  projectId: string,
  movedIds: string[],
): Promise<void> {
  const existing = await db.select<Array<{ id: string }>>(
    `SELECT id FROM scenes WHERE project_id=$1 AND folder_id IS NULL
     ORDER BY sort_order ASC, id ASC`,
    [projectId],
  );
  await db.execute("UPDATE scenes SET folder_id = NULL WHERE folder_id = $1", [folderId]);
  if (movedIds.length === 0) return;
  await applySceneSortOrders(db, [...existing.map((row) => row.id), ...movedIds]);
}
