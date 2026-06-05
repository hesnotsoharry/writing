/**
 * Archive helpers + standalone archive-method implementations for SqliteBinderStore (Wave 22).
 * Extracted to keep sqliteBinderStore.ts within the 300-line file limit.
 * Not exported from the module barrel — archive-internal only.
 */

import { normalizeStatus } from "../lib/status";
import type { ArchivedItem, Folder, Scene } from "./binderStore";
import { getDb } from "./schema";

/** SceneManifestEntry — what the chapter manifest embeds per child scene. */
export interface SceneManifestEntry {
  id: string;
  title: string;
  meta: {
    synopsis: string | null;
    status: string;
    sort_order: number;
    word_count: number;
  };
  doc: string | null;
}

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

/** Insert a scene_docs row (upsert) when a doc is present. */
async function insertSceneDoc(sceneId: string, doc: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO scene_docs (scene_id, state_base64) VALUES ($1, $2) ON CONFLICT(scene_id) DO UPDATE SET state_base64 = excluded.state_base64",
    [sceneId, doc]
  );
}

/**
 * Restore a scene archive row: INSERT scene (folder_id=null / Short pieces),
 * then INSERT scene_docs if manifest.doc is non-null.
 */
export async function restoreSceneRow(
  originalId: string | null,
  title: string,
  projectId: string,
  manifest: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  const meta = (manifest.meta ?? {}) as Record<string, unknown>;
  const id = originalId ?? crypto.randomUUID();
  await db.execute(
    "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)",
    [id, projectId, title, meta.synopsis ?? null, meta.sort_order ?? 1000, meta.word_count ?? 0, meta.status ?? "blank"]
  );
  const doc = manifest.doc as string | null;
  if (doc !== null) {
    await insertSceneDoc(id, doc);
  }
}

/** Restore a single child scene entry within a chapter restore. */
async function restoreChildScene(
  entry: SceneManifestEntry,
  projectId: string,
  folderId: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [entry.id, projectId, folderId, entry.title, entry.meta.synopsis ?? null, entry.meta.sort_order ?? 1000, entry.meta.word_count ?? 0, entry.meta.status ?? "blank"]
  );
  if (entry.doc !== null) {
    await insertSceneDoc(entry.id, entry.doc);
  }
}

/**
 * Restore a chapter archive row: INSERT folder, then INSERT each child scene
 * (with its doc when present). Uses original_id for the folder id.
 */
export async function restoreChapterRow(
  originalId: string | null,
  title: string,
  projectId: string,
  manifest: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  const folderMeta = (manifest.folder ?? {}) as Record<string, unknown>;
  const folderId = originalId ?? crypto.randomUUID();
  await db.execute(
    "INSERT INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
    [folderId, projectId, title, folderMeta.sort_order ?? 1000]
  );
  const entries = (manifest.scenes ?? []) as SceneManifestEntry[];
  for (const entry of entries) {
    await restoreChildScene(entry, projectId, folderId);
  }
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
  const sub = await resolveSceneSub(scene.folder_id);
  const docRows = await db.select<{ state_base64: string }[]>(
    "SELECT state_base64 FROM scene_docs WHERE scene_id=$1", [sceneId]
  );
  const doc = docRows[0]?.state_base64 ?? null;
  const manifest = JSON.stringify({
    meta: { synopsis: scene.synopsis, status: normalizeStatus(scene.status), sort_order: scene.sort_order, word_count: scene.word_count },
    doc,
  });
  await db.execute(
    "INSERT INTO archive (id, project_id, kind, original_id, title, sub, state_base64, archived_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [crypto.randomUUID(), projectId, "scene", sceneId, scene.title, sub, manifest, Date.now()]
  );
  await db.execute("DELETE FROM scene_docs WHERE scene_id=$1", [sceneId]);
  await db.execute("DELETE FROM scenes WHERE id=$1", [sceneId]);
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
  const manifest = JSON.stringify({ folder: { sort_order: folder.sort_order }, scenes });
  await db.execute(
    "INSERT INTO archive (id, project_id, kind, original_id, title, sub, state_base64, archived_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [crypto.randomUUID(), projectId, "chapter", folderId, folder.title, `${childScenes.length} scenes`, manifest, Date.now()]
  );
  for (const scene of childScenes) {
    await db.execute("DELETE FROM scene_docs WHERE scene_id=$1", [scene.id]);
  }
  await db.execute("DELETE FROM scenes WHERE folder_id=$1", [folderId]);
  await db.execute("DELETE FROM folders WHERE id=$1", [folderId]);
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
  if (row.kind === "scene") {
    await restoreSceneRow(row.original_id, row.title, row.project_id, manifest);
  } else {
    await restoreChapterRow(row.original_id, row.title, row.project_id, manifest);
  }
  await db.execute("DELETE FROM archive WHERE id=$1", [archiveId]);
}

export async function sqlitePurgeArchived(archiveId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM archive WHERE id=$1", [archiveId]);
}

export async function sqliteArchivedCount(projectId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM archive WHERE project_id=$1", [projectId]
  );
  return rows[0]?.cnt ?? 0;
}
