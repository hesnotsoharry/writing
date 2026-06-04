/**
 * Internal helpers for SqliteBinderStore's archive methods (Wave 22).
 * Extracted to keep sqliteBinderStore.ts within the 300-line file limit.
 * Not exported from the module barrel — archive-internal only.
 */

import { normalizeStatus } from "../lib/status";
import type { Scene } from "./binderStore";
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
