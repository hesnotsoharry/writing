import { computeReorder } from "../binder/computeReorder";

/** Domain types for the binder data model. */

export type SceneStatus = "blank" | "draft" | "done";

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
}

// ---------------------------------------------------------------------------
// In-memory fake — used in tests; mirrors the same seam discipline as
// InMemorySceneDocStore.
// ---------------------------------------------------------------------------

export class InMemoryBinderStore implements BinderStore {
  private projects: Project[] = [];
  private folders: Folder[] = [];
  private scenes: Scene[] = [];

  async listProjects(): Promise<Project[]> {
    return [...this.projects].sort((a, b) => a.sort_order - b.sort_order);
  }

  async createProject(args: { title: string; type: string }): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Gap-based sort_order: (siblingCount + 1) * 1000
    const sort_order = (this.projects.length + 1) * 1000;
    this.projects.push({
      id,
      title: args.title,
      type: args.type,
      sort_order,
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  async createFolder(args: {
    projectId: string;
    title: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const siblings = this.folders.filter(
      (f) => f.project_id === args.projectId
    );
    const sort_order = (siblings.length + 1) * 1000;
    this.folders.push({
      id,
      project_id: args.projectId,
      title: args.title,
      sort_order,
    });
    return id;
  }

  async createScene(args: {
    projectId: string;
    folderId: string | null;
    title: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    // Sort_order scoped to the container (a folder, or the null-folder bucket
    // within the project).
    const siblings = this.scenes.filter(
      (s) =>
        s.project_id === args.projectId && s.folder_id === args.folderId
    );
    const sort_order = (siblings.length + 1) * 1000;
    this.scenes.push({
      id,
      project_id: args.projectId,
      folder_id: args.folderId,
      title: args.title,
      synopsis: null,
      sort_order,
      word_count: 0,
      status: "blank",
    });
    return id;
  }

  async loadProject(
    projectId: string
  ): Promise<{ folders: Folder[]; scenes: Scene[] }> {
    const folders = this.folders
      .filter((f) => f.project_id === projectId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const scenes = this.scenes
      .filter((s) => s.project_id === projectId)
      .sort((a, b) => a.sort_order - b.sort_order);
    return { folders, scenes };
  }

  async deleteFolder(folderId: string): Promise<void> {
    // Move all scenes in this folder to Short pieces (folder_id = null).
    this.scenes = this.scenes.map((s) =>
      s.folder_id === folderId ? { ...s, folder_id: null } : s
    );
    // Remove the folder itself.
    this.folders = this.folders.filter((f) => f.id !== folderId);
  }

  async renameFolder(folderId: string, title: string): Promise<void> {
    this.folders = this.folders.map((f) =>
      f.id === folderId ? { ...f, title } : f
    );
  }

  async renameScene(sceneId: string, title: string): Promise<void> {
    this.scenes = this.scenes.map((s) =>
      s.id === sceneId ? { ...s, title } : s
    );
  }

  async setSceneStatus(sceneId: string, status: SceneStatus): Promise<void> {
    this.scenes = this.scenes.map((s) =>
      s.id === sceneId ? { ...s, status } : s
    );
  }

  async deleteScene(sceneId: string): Promise<void> {
    this.scenes = this.scenes.filter((s) => s.id !== sceneId);
  }

  async moveScene(
    sceneId: string,
    toFolderId: string | null,
    toIndex: number
  ): Promise<void> {
    // Look up the project before mutating.
    const movedScene = this.scenes.find((s) => s.id === sceneId);
    if (!movedScene) return;
    const { project_id } = movedScene;
    // Update the scene's folder assignment.
    this.scenes = this.scenes.map((s) =>
      s.id === sceneId ? { ...s, folder_id: toFolderId } : s
    );
    // Collect the destination container in sort_order order (includes moved item).
    const container = this.scenes
      .filter((s) => s.project_id === project_id && s.folder_id === toFolderId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const updates = computeReorder(container, sceneId, toIndex);
    const orderMap = new Map(updates.map((u) => [u.id, u.sort_order]));
    this.scenes = this.scenes.map((s) => {
      const newOrder = orderMap.get(s.id);
      return newOrder !== undefined ? { ...s, sort_order: newOrder } : s;
    });
  }

  async moveFolder(folderId: string, toIndex: number): Promise<void> {
    const target = this.folders.find((f) => f.id === folderId);
    if (!target) return;
    const siblings = this.folders
      .filter((f) => f.project_id === target.project_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const updates = computeReorder(siblings, folderId, toIndex);
    const orderMap = new Map(updates.map((u) => [u.id, u.sort_order]));
    this.folders = this.folders.map((f) => {
      const newOrder = orderMap.get(f.id);
      return newOrder !== undefined ? { ...f, sort_order: newOrder } : f;
    });
  }
}
