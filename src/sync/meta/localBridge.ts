import type { SceneStatus } from "../../db/binderStore";
import type { LabelColor } from "../../db/labelStore";
import { withProjectMeta } from "./bridge";
import {
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
} from "./metaDoc";
import { keyBetween } from "./sortKey";

export interface LocalFolderRow { id: string; projectId: string; title: string }
export interface LocalSceneRow {
  id: string; projectId: string; folderId: string | null; title: string;
  synopsis: string | null; status: SceneStatus;
}
export interface LocalLabelRow {
  id: string; projectId: string; name: string; color: LabelColor;
}

function report(operation: string, promise: Promise<void>): void {
  void promise.catch((error: unknown) => console.error(`[sync-meta] ${operation}`, error));
}

function compareSortKey(left: { sortKey: string }, right: { sortKey: string }): number {
  return left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0;
}

function freshKey<T extends { id: string; sortKey: string }>(
  rows: T[], orderedIds: string[], id: string
): string {
  const index = orderedIds.indexOf(id);
  const byId = new Map(rows.filter((row) => row.id !== id).map((row) => [row.id, row]));
  let lower: string | null = null;
  let upper: string | null = null;
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    const row = byId.get(orderedIds[cursor]);
    if (row) { lower = row.sortKey; break; }
  }
  for (let cursor = index + 1; cursor < orderedIds.length; cursor++) {
    const row = byId.get(orderedIds[cursor]);
    if (row) { upper = row.sortKey; break; }
  }
  return keyBetween(lower, upper);
}

export function bridgeFolder(row: LocalFolderRow, orderedIds?: string[]): void {
  report("folder mutation", withProjectMeta(row.projectId, (doc) => {
    const existing = getFolders(doc).find(({ id }) => id === row.id);
    const sortKey = orderedIds
      ? freshKey(getFolders(doc), orderedIds, row.id)
      : existing?.sortKey;
    if (!sortKey) return;
    setFolder(doc, { ...row, sortKey });
  }));
}

export function bridgeScene(row: LocalSceneRow, orderedIds?: string[]): void {
  report("scene mutation", withProjectMeta(row.projectId, (doc) => {
    const existing = getScenes(doc).find(({ id }) => id === row.id);
    const siblings = getScenes(doc).filter((scene) =>
      scene.projectId === row.projectId && scene.folderId === row.folderId
    );
    const sortKey = orderedIds ? freshKey(siblings, orderedIds, row.id) : existing?.sortKey;
    if (!sortKey) return;
    setScene(doc, { ...row, sortKey });
  }));
}

export function bridgeLabel(row: LocalLabelRow, orderedIds?: string[]): void {
  report("label mutation", withProjectMeta(row.projectId, (doc) => {
    const existing = getLabels(doc).find(({ id }) => id === row.id);
    const sortKey = orderedIds
      ? freshKey(getLabels(doc), orderedIds, row.id)
      : existing?.sortKey;
    if (!sortKey) return;
    setLabel(doc, { ...row, sortKey });
  }));
}

export function bridgeRemoved(
  projectId: string,
  rows: Array<{ kind: TombstoneKind; id: string }>,
  operation: string
): void {
  report(operation, withProjectMeta(projectId, (doc) => {
    for (const row of rows) removeWithTombstone(doc, row.kind, row.id);
  }));
}

export function bridgeSceneLabel(
  projectId: string, sceneId: string, labelId: string, assigned: boolean
): void {
  const id = sceneLabelId(sceneId, labelId);
  report("scene-label mutation", withProjectMeta(projectId, (doc) => {
    if (assigned) setSceneLabel(doc, { id, sceneId, labelId });
    else removeWithTombstone(doc, "sceneLabel", id);
  }));
}

function movedId(current: Array<{ id: string }>, desired: string[]): string | undefined {
  const currentIds = current.map(({ id }) => id).filter((id) => desired.includes(id));
  const mismatch = desired.findIndex((id, index) => id !== currentIds[index]);
  return mismatch < 0 ? undefined : desired[mismatch];
}

export function bridgeLabelOrder(projectId: string, rows: LocalLabelRow[]): void {
  const desired = rows.map(({ id }) => id);
  report("label reorder", withProjectMeta(projectId, (doc) => {
    const labels = getLabels(doc).sort(compareSortKey);
    const id = movedId(labels, desired);
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) return;
    setLabel(doc, { ...row, sortKey: freshKey(labels, desired, row.id) });
  }));
}

export function bridgeRestored(
  projectId: string,
  folders: LocalFolderRow[],
  scenes: LocalSceneRow[],
  orders: { folders: string[]; scenes: Map<string, string[]> }
): void {
  report("archive restore", withProjectMeta(projectId, (doc) => {
    for (const row of folders) {
      const sortKey = freshKey(getFolders(doc), orders.folders, row.id);
      setFolder(doc, { ...row, sortKey } satisfies MetaFolder);
    }
    for (const row of scenes) {
      const siblings = getScenes(doc).filter((scene) => scene.folderId === row.folderId);
      const order = orders.scenes.get(row.folderId ?? "") ?? [row.id];
      setScene(doc, { ...row, sortKey: freshKey(siblings, order, row.id) } satisfies MetaScene);
    }
  }));
}

export function bridgeDeletedLabel(
  projectId: string, labelId: string, sceneIds: string[]
): void {
  const rows = sceneIds.map((sceneId) => ({
    kind: "sceneLabel" as const, id: sceneLabelId(sceneId, labelId),
  }));
  bridgeRemoved(projectId, [{ kind: "label", id: labelId }, ...rows], "label delete");
}
