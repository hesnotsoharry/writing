/**
 * In-memory fake BinderStore — used in tests.
 * Mirrors the same seam discipline as InMemorySceneDocStore.
 * Extracted from binderStore.ts to keep that file within the 300-line limit.
 */
import { computeReorder } from "../binder/computeReorder";
import type {
  ArchivedItem,
  BinderStore,
  Folder,
  Project,
  Scene,
  SceneStatus,
} from "./binderStore";

/** Internal restore record — not exported. Payload is polymorphic by kind. */
type ArchiveRecord =
  | {
      id: string;
      projectId: string;
      kind: "scene";
      originalId: string;
      title: string;
      sub: string | null;
      archivedAt: number;
      payload: { scene: Scene };
    }
  | {
      id: string;
      projectId: string;
      kind: "chapter";
      originalId: string;
      title: string;
      sub: string | null;
      archivedAt: number;
      payload: { folder: Folder; scenes: Scene[] };
    };

export class InMemoryBinderStore implements BinderStore {
  private projects: Project[] = [];
  private folders: Folder[] = [];
  private scenes: Scene[] = [];
  private archived: ArchiveRecord[] = [];
  /** Monotonically-increasing clock for deterministic archivedAt values. */
  private clock = 0;

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

  async setSceneSynopsis(sceneId: string, synopsis: string | null): Promise<void> {
    this.scenes = this.scenes.map((s) =>
      s.id === sceneId ? { ...s, synopsis } : s
    );
  }

  async setSceneWordCount(sceneId: string, wordCount: number): Promise<boolean> {
    const exists = this.scenes.some((s) => s.id === sceneId);
    if (!exists) return false;
    this.scenes = this.scenes.map((s) =>
      s.id === sceneId ? { ...s, word_count: wordCount } : s
    );
    return true;
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

  // -------------------------------------------------------------------------
  // Archive methods (Wave 22 — additive)
  // -------------------------------------------------------------------------

  async archiveScene(sceneId: string, projectId: string): Promise<void> {
    const scene = this.scenes.find(
      (s) => s.id === sceneId && s.project_id === projectId
    );
    if (!scene) return;

    const folder = scene.folder_id
      ? this.folders.find((f) => f.id === scene.folder_id)
      : null;

    this.archived.push({
      id: crypto.randomUUID(),
      projectId,
      kind: "scene",
      originalId: sceneId,
      title: scene.title,
      sub: folder ? folder.title : "Short pieces",
      archivedAt: ++this.clock,
      payload: { scene: { ...scene } },
    });

    this.scenes = this.scenes.filter((s) => s.id !== sceneId);
  }

  async archiveChapter(folderId: string, projectId: string): Promise<void> {
    const folder = this.folders.find(
      (f) => f.id === folderId && f.project_id === projectId
    );
    if (!folder) return;

    const childScenes = this.scenes.filter(
      (s) => s.folder_id === folderId && s.project_id === projectId
    );
    const sub = `${childScenes.length} scenes`;

    this.archived.push({
      id: crypto.randomUUID(),
      projectId,
      kind: "chapter",
      originalId: folderId,
      title: folder.title,
      sub,
      archivedAt: ++this.clock,
      payload: { folder: { ...folder }, scenes: childScenes.map((s) => ({ ...s })) },
    });

    this.scenes = this.scenes.filter((s) => s.folder_id !== folderId);
    this.folders = this.folders.filter((f) => f.id !== folderId);
  }

  async listArchived(projectId: string): Promise<ArchivedItem[]> {
    return this.archived
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => b.archivedAt - a.archivedAt)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        originalId: r.originalId,
        title: r.title,
        sub: r.sub,
        archivedAt: r.archivedAt,
      }));
  }

  async restoreArchived(archiveId: string): Promise<void> {
    const record = this.archived.find((r) => r.id === archiveId);
    if (!record) return;

    if (record.kind === "scene") {
      // Restore to Short pieces (folder_id = null). Intentional cross-impl
      // consistency: the SQLite archive table stores no folder_id for scenes
      // (only original_id + sub=chapter-title), so SQLite cannot restore a
      // scene to its original chapter. InMemory forces null here to match
      // that behaviour — this is by design, not a bug.
      this.scenes.push({ ...record.payload.scene, folder_id: null });
    } else {
      this.folders.push({ ...record.payload.folder });
      for (const scene of record.payload.scenes) {
        this.scenes.push({ ...scene });
      }
    }

    this.archived = this.archived.filter((r) => r.id !== archiveId);
  }

  async purgeArchived(archiveId: string): Promise<void> {
    this.archived = this.archived.filter((r) => r.id !== archiveId);
  }

  async archivedCount(projectId: string): Promise<number> {
    return this.archived.filter((r) => r.projectId === projectId).length;
  }
}
