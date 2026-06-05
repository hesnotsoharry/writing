/** Domain types for the binder data model. */

// ---------------------------------------------------------------------------
// Archive types
// ---------------------------------------------------------------------------

export const ARCHIVE_KIND = { scene: "scene", chapter: "chapter" } as const;
export type ArchiveKind = (typeof ARCHIVE_KIND)[keyof typeof ARCHIVE_KIND];

/** A row in the archive bin, as shown in the browsing overlay.
 *  Does NOT carry the heavy state_base64 payload. */
export interface ArchivedItem {
  id: string;
  kind: ArchiveKind;
  originalId: string | null;
  title: string;
  /** scene: chapter title (or "Short pieces"); chapter: "N scenes" */
  sub: string | null;
  archivedAt: number;
}

/**
 * SceneStatus — 5-value canon set (wave 17).
 * The DB column is free-form TEXT; always read raw values through
 * `normalizeStatus` (src/lib/status.ts) before assigning to this type.
 * Legacy "done" rows are normalized to "final" at the store read layer.
 */
export type SceneStatus = "blank" | "outline" | "draft" | "revise" | "final";

export interface Project {
  id: string;
  title: string;
  type: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  project_id: string;
  title: string;
  sort_order: number;
}

export interface Scene {
  id: string;
  project_id: string;
  folder_id: string | null;
  title: string;
  synopsis: string | null;
  sort_order: number;
  word_count: number;
  status: SceneStatus;
}

/** Abstraction over binder persistence (project/folder/scene structure). */
export interface BinderStore {
  /** List all projects in creation/sort_order order. */
  listProjects(): Promise<Project[]>;
  /** Create a project; returns its new id. */
  createProject(args: { title: string; type: string }): Promise<string>;
  /** Create a folder (chapter) in a project; returns its new id. */
  createFolder(args: { projectId: string; title: string }): Promise<string>;
  /**
   * Create a scene in a project. `folderId` is null for a Short piece
   * (no containing chapter). Returns the new scene's id.
   */
  createScene(args: {
    projectId: string;
    folderId: string | null;
    title: string;
  }): Promise<string>;
  /** Load a project's folders and scenes (for buildTree). */
  loadProject(
    projectId: string
  ): Promise<{ folders: Folder[]; scenes: Scene[] }>;
  /**
   * Delete a folder. Its scenes are NOT deleted — they are moved to
   * folder_id = null (Short pieces). No scene_docs rows are touched.
   */
  deleteFolder(folderId: string): Promise<void>;
  /** Rename a folder (chapter). */
  renameFolder(folderId: string, title: string): Promise<void>;
  /** Rename a scene. */
  renameScene(sceneId: string, title: string): Promise<void>;
  /** Update a scene's status. */
  setSceneStatus(sceneId: string, status: SceneStatus): Promise<void>;
  /** Update a scene's synopsis. null clears it. */
  setSceneSynopsis(sceneId: string, synopsis: string | null): Promise<void>;
  /**
   * Persist the computed word count for a scene after a prose save.
   * Called by the debounced persistence layer so binder rows and the
   * manuscript total reflect real counts without a full project reload.
   * Returns true if a row was updated, false if the sceneId was not found.
   */
  setSceneWordCount(sceneId: string, wordCount: number): Promise<boolean>;
  /**
   * Delete a scene row only. Caller is responsible for also deleting the
   * corresponding scene_docs row (App orchestrates both stores).
   */
  deleteScene(sceneId: string): Promise<void>;
  /**
   * Move a scene to a container (folder or Short pieces) at a target index.
   * Sets folder_id and renormalizes sort_orders within the destination container.
   * `toFolderId` null → Short pieces.
   */
  moveScene(
    sceneId: string,
    toFolderId: string | null,
    toIndex: number
  ): Promise<void>;
  /**
   * Move a folder (chapter) to a target index among the project's folders.
   * Renormalizes sort_orders for all folders in the project.
   */
  moveFolder(folderId: string, toIndex: number): Promise<void>;

  // -------------------------------------------------------------------------
  // Archive methods (Wave 22 — additive)
  // -------------------------------------------------------------------------

  /** Snapshot a scene into the archive bin and remove it from the binder. */
  archiveScene(sceneId: string, projectId: string): Promise<void>;
  /** Snapshot a chapter folder and all its child scenes atomically; remove them from the binder. */
  archiveChapter(folderId: string, projectId: string): Promise<void>;
  /** List archived items for a project, ordered archivedAt DESC. */
  listArchived(projectId: string): Promise<ArchivedItem[]>;
  /**
   * Restore an archived item: reinsert the scene or chapter+scenes using
   * their original ids. Lone scenes land in Short pieces (folder_id = null).
   */
  restoreArchived(archiveId: string): Promise<void>;
  /** Permanently remove an archived item — does NOT reinsert anything. */
  purgeArchived(archiveId: string): Promise<void>;
  /** Number of archive records for a project. */
  archivedCount(projectId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory fake — re-exported from inMemoryBinderStore.ts.
// Kept here for backward-compat so all existing `import { InMemoryBinderStore }
// from "../db/binderStore"` calls continue to work without changes.
// ---------------------------------------------------------------------------
export { InMemoryBinderStore } from "./inMemoryBinderStore";
