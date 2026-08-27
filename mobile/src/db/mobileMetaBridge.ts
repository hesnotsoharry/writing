import { exclusiveMetaDoc } from "@writersnook/sync/exclusiveLock";
import {
  applyFolderMutation,
  applyLabelMutation,
  applyRemoved,
  applySceneMutation,
} from "@writersnook/sync/meta/localMutators";
import {
  buildFromSql,
  getDocEpochs,
  removeWithTombstone,
  sceneLabelId,
  setSceneLabel,
  type TombstoneKind,
} from "@writersnook/sync/meta/metaDoc";
import * as Y from "yjs";

import type { SceneStatus } from "../shared/binderStore";
import type { LabelColor } from "../shared/labelStore";
import { applyEncoded, encodeDoc } from "../shared/serialize";
import { getMobileDb } from "./database";
import { MobileProjectMetaDocStore } from "./syncStores/mobileProjectMetaDocStore";

export interface MobileFolderRow { id: string; projectId: string; title: string }
export interface MobileSceneRow {
  id: string; projectId: string; folderId: string | null; title: string;
  synopsis: string | null; status: SceneStatus;
}
export interface MobileLabelRow {
  id: string; projectId: string; name: string; color: LabelColor;
}

type SaveListener = (projectId: string, epochs: ReturnType<typeof getDocEpochs>) => void;
const store = new MobileProjectMetaDocStore();
const saveListeners = new Set<SaveListener>();

export function subscribeMobileMetaSaves(listener: SaveListener): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

async function persistMobileMeta(projectId: string, mutate: (doc: Y.Doc) => void): Promise<void> {
  const encoded = await store.load(projectId);
  if (encoded === null) return;
  const doc = new Y.Doc();
  applyEncoded(doc, encoded);
  doc.transact(() => mutate(doc));
  await store.save(projectId, encodeDoc(doc));
  const epochs = getDocEpochs(doc);
  saveListeners.forEach((listener) => listener(projectId, epochs));
}

export function withMobileProjectMeta(projectId: string, mutate: (doc: Y.Doc) => void): Promise<void> {
  return exclusiveMetaDoc(projectId, () => persistMobileMeta(projectId, mutate));
}

export async function runMobileMetaWrite<T>(
  projectId: string,
  sqlWrite: () => Promise<T>,
  mutate: (doc: Y.Doc, result: T) => void,
): Promise<T> {
  return exclusiveMetaDoc(projectId, async () => {
    const result = await sqlWrite();
    await persistMobileMeta(projectId, (doc) => mutate(doc, result));
    return result;
  });
}

export function bootstrapMobileProjectMeta(project: {
  id: string; title: string; type: string;
}): Promise<void> {
  return exclusiveMetaDoc(project.id, async () => {
    if (await store.load(project.id) !== null) return;
    const doc = buildFromSql({
      project, folders: [], scenes: [], labels: [], sceneLabels: [],
    });
    await store.save(project.id, encodeDoc(doc));
    const epochs = getDocEpochs(doc);
    saveListeners.forEach((listener) => listener(project.id, epochs));
  });
}

/**
 * Backfill meta docs for every local project that doesn't have one yet.
 * Safe on any device role — bootstrapMobileProjectMeta's doc-existence guard
 * (above) means this never touches a project that already has a doc, whether
 * bootstrapped locally or received via sync. Rescues projects stranded
 * before bootstrap-at-creation existed.
 */
export async function ensureAllMobileProjectMetas(): Promise<void> {
  const db = await getMobileDb();
  const [projects, existing] = await Promise.all([
    db.select<Array<{ id: string; title: string; type: string }>>(
      "SELECT id, title, type FROM projects"
    ),
    store.listAll(),
  ]);
  const existingIds = new Set(existing.map(({ id }) => id));
  await Promise.all(projects.filter(({ id }) => !existingIds.has(id))
    .map((project) => bootstrapMobileProjectMeta(project)));
}

export function bridgeMobileFolder(row: MobileFolderRow, order?: string[]): Promise<void> {
  return withMobileProjectMeta(row.projectId, (doc) => applyFolderMutation(doc, row, order));
}

export function bridgeMobileScene(row: MobileSceneRow, order?: string[]): Promise<void> {
  return withMobileProjectMeta(row.projectId, (doc) => applySceneMutation(doc, row, order));
}

export function bridgeMobileLabel(row: MobileLabelRow, order?: string[]): Promise<void> {
  return withMobileProjectMeta(row.projectId, (doc) => applyLabelMutation(doc, row, order));
}

export function bridgeMobileRemoved(projectId: string, rows: Array<{ kind: TombstoneKind; id: string }>): Promise<void> {
  return withMobileProjectMeta(projectId, (doc) => applyRemoved(doc, rows));
}

export function bridgeMobileSceneLabel(
  projectId: string, sceneId: string, labelId: string, assigned: boolean,
): Promise<void> {
  return withMobileProjectMeta(projectId, (doc) => {
    const id = sceneLabelId(sceneId, labelId);
    if (assigned) setSceneLabel(doc, { id, sceneId, labelId });
    else removeWithTombstone(doc, "sceneLabel", id);
  });
}

export function bridgeMobileRestored(
  projectId: string,
  folders: MobileFolderRow[],
  scenes: MobileSceneRow[],
  orders: { folders: string[]; scenes: Map<string, string[]> },
): Promise<void> {
  return withMobileProjectMeta(projectId, (doc) => {
    folders.forEach((row) => applyFolderMutation(doc, row, orders.folders));
    scenes.forEach((row) => {
      const order = orders.scenes.get(row.folderId ?? "") ?? [row.id];
      applySceneMutation(doc, row, order);
    });
  });
}
