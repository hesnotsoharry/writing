import type { Entity, SceneLink } from "../db/storyBibleStore";
import { detectEntities } from "./detection";

export interface DetectionSyncDeps {
  loadProjection(sceneId: string): Promise<string | null>;
  listEntities(projectId: string): Promise<Entity[]>;
  replaceSceneLinks(sceneId: string, links: SceneLink[]): Promise<void>;
  listSceneIds(projectId: string): Promise<string[]>;
}

export interface DetectionSync {
  linkScene(sceneId: string, projectId: string): Promise<void>;
  rescanProject(projectId: string): Promise<void>;
}

export function createDetectionSync(deps: DetectionSyncDeps): DetectionSync {
  // Per-scene promise chain — each sceneId chains its work onto the prior
  // promise so concurrent linkScene calls for the SAME scene never overlap
  // their replaceSceneLinks. Cross-scene calls are independent.
  const chain = new Map<string, Promise<void>>();

  async function doLink(sceneId: string, projectId: string): Promise<void> {
    const projection = await deps.loadProjection(sceneId);
    if (projection === null) return;

    const entities = await deps.listEntities(projectId);
    const matchedIds = detectEntities(projection, entities);

    const idToEntity = new Map<string, Entity>(entities.map((e) => [e.id, e]));
    const links: SceneLink[] = matchedIds
      .map((id) => idToEntity.get(id))
      .filter((e): e is Entity => e !== undefined)
      .map((e) => ({ entityType: e.type, entityId: e.id }));

    await deps.replaceSceneLinks(sceneId, links);
  }

  function linkScene(sceneId: string, projectId: string): Promise<void> {
    const prev = chain.get(sceneId) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(() => doLink(sceneId, projectId));
    chain.set(sceneId, next);
    return next;
  }

  async function rescanProject(projectId: string): Promise<void> {
    const sceneIds = await deps.listSceneIds(projectId);
    await Promise.all(sceneIds.map((id) => linkScene(id, projectId)));
  }

  return { linkScene, rescanProject };
}
