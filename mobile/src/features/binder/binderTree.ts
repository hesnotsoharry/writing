import type { SceneStatus } from "../../shared/status";
import { normalizeStatus } from "../../shared/status";

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
  /** scenes.folder_id IS NULL (plus orphaned folder ids) — the desktop
   *  binder's "Short pieces" bucket. */
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
 * the short-pieces bucket. Callers must pass rows already ordered by
 * sort_order (the SQL does this) — this function only groups, it never
 * re-sorts, so it stays a pure, order-preserving fold.
 *
 * Short pieces are scenes with folder_id NULL (the desktop bucket) plus any
 * scene whose folder_id points at a folder this project does not have. The
 * desktop tree drops those orphans (src/binder/buildTree.ts); mobile surfaces
 * them instead, because a dropped row here is prose the writer cannot reach.
 */
export function buildBinderTree(folders: RawFolderRow[], scenes: RawSceneRow[]): BinderTree {
  const known = new Set(folders.map((folder) => folder.id));
  const byFolder = new Map<string, BinderSceneItem[]>();
  const shortPieces: BinderSceneItem[] = [];
  for (const scene of scenes) {
    const item = toSceneItem(scene);
    const folderId = scene.folder_id;
    if (folderId == null || !known.has(folderId)) {
      shortPieces.push(item);
      continue;
    }
    const bucket = byFolder.get(folderId);
    if (bucket) bucket.push(item);
    else byFolder.set(folderId, [item]);
  }
  const chapters = folders.map((folder) => ({
    id: folder.id,
    title: folder.title,
    scenes: byFolder.get(folder.id) ?? [],
  }));
  return { chapters, shortPieces };
}

/** Section title for the folder_id-less bucket — desktop's wording. */
export const SHORT_PIECES_TITLE = "Short pieces";
/** Desktop's inline hint inside a chapter with no scenes (Binder.tsx ChapterEmptyHint). */
export const CHAPTER_EMPTY_LABEL = "No scenes yet — add one";
/** Desktop's inline hint under an empty Short pieces section (Binder.tsx ShortPiecesSection). */
export const SHORT_PIECES_EMPTY_LABEL = "Nothing here yet — add one";

const SHORT_PIECES_HEADER_ID = "h-short-pieces";

export type BinderRow =
  | { kind: "header"; id: string; title: string }
  | { kind: "scene"; id: string; scene: BinderSceneItem }
  | { kind: "add"; id: string; folderId: string | null; label: string };

/**
 * Flattens the tree into one ordered row list so a single FlatList can render
 * headers, scenes and the add-a-scene affordances without nested lists.
 *
 * Mirrors the desktop binder's section semantics: every chapter with no scenes
 * gets an inline "add one" hint, and the Short pieces section is always
 * rendered — empty or not — so a project that has chapters but no prose (or no
 * chapters at all) still offers a way to start writing.
 */
export function buildBinderRows(tree: BinderTree): BinderRow[] {
  const rows: BinderRow[] = [];
  for (const chapter of tree.chapters) {
    rows.push({ kind: "header", id: `h-${chapter.id}`, title: chapter.title });
    for (const scene of chapter.scenes) rows.push({ kind: "scene", id: scene.id, scene });
    if (chapter.scenes.length === 0) {
      rows.push({ kind: "add", id: `add-${chapter.id}`, folderId: chapter.id, label: CHAPTER_EMPTY_LABEL });
    }
  }
  rows.push({ kind: "header", id: SHORT_PIECES_HEADER_ID, title: SHORT_PIECES_TITLE });
  for (const scene of tree.shortPieces) rows.push({ kind: "scene", id: scene.id, scene });
  if (tree.shortPieces.length === 0) {
    rows.push({ kind: "add", id: "add-short-pieces", folderId: null, label: SHORT_PIECES_EMPTY_LABEL });
  }
  return rows;
}
