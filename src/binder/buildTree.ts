import type { Folder, Scene } from "../db/binderStore";

export interface Chapter {
  folder: Folder;
  scenes: Scene[];
}

export interface BinderTree {
  /** Chapters (folders) in sort_order, each with their sorted scenes. */
  chapters: Chapter[];
  /** Scenes with folder_id === null, in sort_order. */
  shortPieces: Scene[];
}

/**
 * Build the display tree from a flat list of folders and scenes.
 *
 * Pure function — no Tauri, no React, no side effects. Accepts the return
 * value of BinderStore.loadProject() directly.
 *
 * Chapters are sorted by folder sort_order. Each chapter's scenes are those
 * whose folder_id matches the folder's id, sorted by scene sort_order.
 * Short pieces are scenes with folder_id == null, sorted by sort_order.
 */
export function buildTree(folders: Folder[], scenes: Scene[]): BinderTree {
  const sortedFolders = [...folders].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const chapters: Chapter[] = sortedFolders.map((folder) => ({
    folder,
    scenes: scenes
      .filter((s) => s.folder_id === folder.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  const shortPieces = scenes
    .filter((s) => s.folder_id == null)
    .sort((a, b) => a.sort_order - b.sort_order);

  return { chapters, shortPieces };
}
