import { getBinderStore } from "../../db/stores";
import { MobileProjectMetaDocStore } from "../../db/syncStores/mobileProjectMetaDocStore";
import type { BinderStore, Project } from "../../shared/binderStore";

export type ProjectSyncBadge = "synced" | "local";

export interface ProjectCardModel {
  id: string;
  title: string;
  type: string;
  wordCount: number;
  sceneCount: number;
  badge: ProjectSyncBadge;
  syncedAt: string | null;
}

interface ProjectMetaReader {
  listAll(): Promise<Array<{ id: string; updatedAt: string | null }>>;
}

export interface ProjectsModelDeps {
  binder: BinderStore;
  projectMeta: ProjectMetaReader;
}

async function toCard(
  project: Project,
  binder: BinderStore,
  synced: Map<string, string | null>,
): Promise<ProjectCardModel> {
  const { scenes } = await binder.loadProject(project.id);
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    wordCount: scenes.reduce((total, scene) => total + scene.word_count, 0),
    sceneCount: scenes.length,
    badge: synced.has(project.id) ? "synced" : "local",
    syncedAt: synced.get(project.id) ?? null,
  };
}

export async function loadProjectsModel(deps?: ProjectsModelDeps): Promise<ProjectCardModel[]> {
  const binder = deps?.binder ?? await getBinderStore();
  const projectMeta = deps?.projectMeta ?? new MobileProjectMetaDocStore();
  const [projects, metaRows] = await Promise.all([binder.listProjects(), projectMeta.listAll()]);
  const synced = new Map(metaRows.map((row) => [row.id, row.updatedAt]));
  return Promise.all(projects.map((project) => toCard(project, binder, synced)));
}

export function projectTypeLabel(type: string): string {
  return type === "novel" ? "Novel" : "Collection";
}

export function syncBadgeLabel(project: ProjectCardModel, now = Date.now()): string {
  if (project.badge === "local") return "This device only";
  const timestamp = project.syncedAt === null ? Number.NaN : Date.parse(project.syncedAt);
  if (!Number.isFinite(timestamp)) return "Synced";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes}m ago`;
  return "Synced";
}
