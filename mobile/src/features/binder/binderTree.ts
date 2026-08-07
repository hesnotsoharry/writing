import { normalizeStatus } from "../../shared/status";
import type { SceneStatus } from "../../shared/status";

/** Raw row shapes as read straight off the `folders` / `scenes` tables
 *  (migration_001_baseline in src/db/migrations.ts). Kept separate from the
 *  DB-facing query module so this grouping logic is plain, desk-checkable
 *  TypeScript with no I/O — mobile has no vitest rig (S4 blueprint step 3). */
export interface RawFolderRow {
  id: string;
  title: string;
  sort_order: number;
}

export interface RawSceneRow {
  id: string;
  folder_id: string | null;
  title: string;
  synopsis: string | null;
  sort_order: number;
  word_count: number;
  status: string;
}

export interface BinderSceneItem {
  id: string;
  title: string;
  status: SceneStatus;
  synopsis: string | null;
  wordCount: number;
}

export interface BinderChapter {
  id: string;
  title: string;
  scenes: BinderSceneItem[];
}

export interface BinderTree {
  chapters: BinderChapter[];
  /** scenes.folder_id IS NULL — the desktop binder's "Short pieces" bucket. */
  shortPieces: BinderSceneItem[];
}

function toSceneItem(row: RawSceneRow): BinderSceneItem {
  return {
    id: row.id,
    title: row.title,
    status: normalizeStatus(row.status),
    synopsis: row.synopsis,
    wordCount: row.word_count,
  };
}

/**
 * Groups flat, sort_order-ordered folder/scene rows into a chapter tree plus
 * the folder_id=NULL short-pieces bucket. Callers must pass rows already
 * ordered by sort_order (the SQL does this) — this function only groups, it
 * never re-sorts, so it stays a pure, order-preserving fold.
 */
export function buildBinderTree(folders: RawFolderRow[], scenes: RawSceneRow[]): BinderTree {
  const byFolder = new Map<string, BinderSceneItem[]>();
  const shortPieces: BinderSceneItem[] = [];
  for (const scene of scenes) {
    const item = toSceneItem(scene);
    if (scene.folder_id === null) {
      shortPieces.push(item);
      continue;
    }
    const bucket = byFolder.get(scene.folder_id);
    if (bucket) bucket.push(item);
    else byFolder.set(scene.folder_id, [item]);
  }
  const chapters = folders.map((folder) => ({
    id: folder.id,
    title: folder.title,
    scenes: byFolder.get(folder.id) ?? [],
  }));
  return { chapters, shortPieces };
}
