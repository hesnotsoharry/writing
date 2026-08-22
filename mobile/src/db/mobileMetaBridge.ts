import {
  buildFromSql,
  getDocEpochs,
  getFolders,
  getLabels,
  getScenes,
  type MetaFolder,
  type MetaScene,
  removeWithTombstone,
  sceneLabelId,
  setFolder,
  setLabel,
  setScene,
  setSceneLabel,
  type TombstoneKind,
} from "@writersnook/sync/meta/metaDoc";
import { keyBetween } from "@writersnook/sync/meta/sortKey";
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
const tails = new Map<string, Promise<void>>();
const saveListeners = new Set<SaveListener>();

export function subscribeMobileMetaSaves(listener: SaveListener): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

function runExclusive(projectId: string, operation: () => Promise<void>): Promise<void> {
  const prior = tails.get(projectId) ?? Promise.resolve();
  const current = prior.catch(() => undefined).then(operation);
  tails.set(projectId, current);
  const clear = (): void => {
    if (tails.get(projectId) === current) tails.delete(projectId);
  };
  void current.then(clear, clear);
  return current;
}

export function withMobileProjectMeta(projectId: string, mutate: (doc: Y.Doc) => void): Promise<void> {
  return runExclusive(projectId, async () => {
    const encoded = await store.load(projectId);
    if (encoded === null) return;
    const doc = new Y.Doc();
    applyEncoded(doc, encoded);
    doc.transact(() => mutate(doc));
    await store.save(projectId, encodeDoc(doc));
    const epochs = getDocEpochs(doc);
    saveListeners.forEach((listener) => listener(projectId, epochs));
  });
}

export function bootstrapMobileProjectMeta(project: {
  id: string; title: string; type: string;
}): Promise<void> {
  return runExclusive(project.id, async () => {
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

function freshKey<T extends { id: string; sortKey: string }>(rows: T[], order: string[], id: string): string {
  const peers = new Map(rows.filter((row) => row.id !== id).map((row) => [row.id, row]));
  const index = order.indexOf(id);
  const lower = order.slice(0, index).reverse().map((key) => peers.get(key)?.sortKey).find(Boolean) ?? null;
  const upper = order.slice(index + 1).map((key) => peers.get(key)?.sortKey).find(Boolean) ?? null;
  return keyBetween(lower, upper);
}

export function bridgeMobileFolder(row: MobileFolderRow, order?: string[]): Promise<void> {
  return withMobileProjectMeta(row.projectId, (doc) => {
    const existing = getFolders(doc).find(({ id }) => id === row.id);
    const sortKey = order ? freshKey(getFolders(doc), order, row.id) : existing?.sortKey;
    if (sortKey) setFolder(doc, { ...row, sortKey });
  });
}

export function bridgeMobileScene(row: MobileSceneRow, order?: string[]): Promise<void> {
  return withMobileProjectMeta(row.projectId, (doc) => {
    const scenes = getScenes(doc);
    const existing = scenes.find(({ id }) => id === row.id);
    const siblings = scenes.filter((scene) => scene.folderId === row.folderId);
    const sortKey = order ? freshKey(siblings, order, row.id) : existing?.sortKey;
    if (sortKey) setScene(doc, { ...row, sortKey });
  });
}

export function bridgeMobileLabel(row: MobileLabelRow, order?: string[]): Promise<void> {
  return withMobileProjectMeta(row.projectId, (doc) => {
    const existing = getLabels(doc).find(({ id }) => id === row.id);
    const sortKey = order ? freshKey(getLabels(doc), order, row.id) : existing?.sortKey;
    if (sortKey) setLabel(doc, { ...row, sortKey });
  });
}

export function bridgeMobileRemoved(projectId: string, rows: Array<{ kind: TombstoneKind; id: string }>): Promise<void> {
  return withMobileProjectMeta(projectId, (doc) => {
    rows.forEach((row) => removeWithTombstone(doc, row.kind, row.id));
  });
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
    folders.forEach((row) => setFolder(doc, {
      ...row, sortKey: freshKey(getFolders(doc), orders.folders, row.id),
    } satisfies MetaFolder));
    scenes.forEach((row) => {
      const siblings = getScenes(doc).filter((scene) => scene.folderId === row.folderId);
      const order = orders.scenes.get(row.folderId ?? "") ?? [row.id];
      setScene(doc, { ...row, sortKey: freshKey(siblings, order, row.id) } satisfies MetaScene);
    });
  });
}
