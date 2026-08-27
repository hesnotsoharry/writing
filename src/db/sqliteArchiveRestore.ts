/**
 * Archive restore row writers for SqliteBinderStore.
 * Extracted from sqliteArchiveHelpers.ts to stay under the 300-line file limit.
 * Restore upserts so a crash that left the original binder row cannot block recovery.
 */
import { getDb } from "./schema";
import { SqliteSceneDocStore } from "./sqliteSceneDocStore";

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

const sceneDocStore = new SqliteSceneDocStore();

async function insertSceneDoc(sceneId: string, doc: string): Promise<void> {
  await sceneDocStore.save(sceneId, doc, null);
}

async function upsertSceneRow(args: {
  id: string; projectId: string; folderId: string | null; title: string;
  synopsis: unknown; sortOrder: unknown; wordCount: unknown; status: unknown;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       project_id=excluded.project_id, folder_id=excluded.folder_id,
       title=excluded.title, synopsis=excluded.synopsis,
       sort_order=excluded.sort_order, word_count=excluded.word_count,
       status=excluded.status`,
    [
      args.id, args.projectId, args.folderId, args.title, args.synopsis ?? null,
      args.sortOrder ?? 1000, args.wordCount ?? 0, args.status ?? "blank",
    ]
  );
}

/** Restore a scene archive row into Short pieces, upserting if the original id survived. */
export async function restoreSceneRow(
  originalId: string | null,
  title: string,
  projectId: string,
  manifest: Record<string, unknown>
): Promise<string> {
  const meta = (manifest.meta ?? {}) as Record<string, unknown>;
  const id = originalId ?? crypto.randomUUID();
  await upsertSceneRow({
    id, projectId, folderId: null, title,
    synopsis: meta.synopsis, sortOrder: meta.sort_order,
    wordCount: meta.word_count, status: meta.status,
  });
  const doc = manifest.doc as string | null;
  if (doc !== null) await insertSceneDoc(id, doc);
  return id;
}

async function restoreChildScene(
  entry: SceneManifestEntry,
  projectId: string,
  folderId: string
): Promise<void> {
  await upsertSceneRow({
    id: entry.id, projectId, folderId, title: entry.title,
    synopsis: entry.meta.synopsis, sortOrder: entry.meta.sort_order,
    wordCount: entry.meta.word_count, status: entry.meta.status,
  });
  if (entry.doc !== null) await insertSceneDoc(entry.id, entry.doc);
}

/** Restore a chapter archive row, upserting the folder and each child scene. */
export async function restoreChapterRow(
  originalId: string | null,
  title: string,
  projectId: string,
  manifest: Record<string, unknown>
): Promise<{ folderId: string; sceneIds: string[] }> {
  const db = await getDb();
  const folderMeta = (manifest.folder ?? {}) as Record<string, unknown>;
  const folderId = originalId ?? crypto.randomUUID();
  await db.execute(
    `INSERT INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       project_id=excluded.project_id, title=excluded.title, sort_order=excluded.sort_order`,
    [folderId, projectId, title, folderMeta.sort_order ?? 1000]
  );
  const entries = (manifest.scenes ?? []) as SceneManifestEntry[];
  for (const entry of entries) {
    await restoreChildScene(entry, projectId, folderId);
  }
  return { folderId, sceneIds: entries.map(({ id }) => id) };
}
