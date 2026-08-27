import type * as Y from "yjs";

import type { SceneStatus } from "../../db/binderStore";
import type { LabelColor } from "../../db/labelStore";
import { allocateSortKeys } from "./allocateSortKey";
import {
  getFolders,
  getLabels,
  getScenes,
  type MetaFolder,
  type MetaScene,
  removeWithTombstone,
  setFolder,
  setLabel,
  setScene,
  type TombstoneKind,
} from "./metaDoc";

export interface LocalFolderRow { id: string; projectId: string; title: string }
export interface LocalSceneRow {
  id: string; projectId: string; folderId: string | null; title: string;
  synopsis: string | null; status: SceneStatus;
}
export interface LocalLabelRow {
  id: string; projectId: string; name: string; color: LabelColor;
}

function writeAllocated<T extends { id: string; sortKey: string }>(
  rows: T[],
  orderedIds: string[],
  target: { id: string },
  write: (id: string, sortKey: string) => void,
): void {
  for (const [rowId, sortKey] of allocateSortKeys(rows, orderedIds, target.id)) {
    write(rowId, sortKey);
  }
}

export function applyFolderMutation(
  doc: Y.Doc, row: LocalFolderRow, orderedIds?: string[],
): void {
  const existing = getFolders(doc).find(({ id }) => id === row.id);
  if (!orderedIds) {
    if (existing?.sortKey) setFolder(doc, { ...row, sortKey: existing.sortKey });
    return;
  }
  writeAllocated(getFolders(doc), orderedIds, row, (id, sortKey) => {
    const body = id === row.id ? row : getFolders(doc).find((folder) => folder.id === id);
    if (body) setFolder(doc, { ...body, sortKey } satisfies MetaFolder);
  });
}

export function applySceneMutation(
  doc: Y.Doc, row: LocalSceneRow, orderedIds?: string[],
): void {
  const existing = getScenes(doc).find(({ id }) => id === row.id);
  const siblings = getScenes(doc).filter((scene) =>
    scene.projectId === row.projectId && scene.folderId === row.folderId
  );
  if (!orderedIds) {
    if (existing?.sortKey) setScene(doc, { ...row, sortKey: existing.sortKey });
    return;
  }
  writeAllocated(siblings, orderedIds, row, (id, sortKey) => {
    const body = id === row.id ? row : siblings.find((scene) => scene.id === id);
    if (body) setScene(doc, { ...body, sortKey } satisfies MetaScene);
  });
}

export function applyLabelMutation(
  doc: Y.Doc, row: LocalLabelRow, orderedIds?: string[],
): void {
  const existing = getLabels(doc).find(({ id }) => id === row.id);
  if (!orderedIds) {
    if (existing?.sortKey) setLabel(doc, { ...row, sortKey: existing.sortKey });
    return;
  }
  writeAllocated(getLabels(doc), orderedIds, row, (id, sortKey) => {
    const body = id === row.id ? row : getLabels(doc).find((label) => label.id === id);
    if (body) setLabel(doc, { ...body, sortKey });
  });
}

export function applyRemoved(
  doc: Y.Doc, rows: Array<{ kind: TombstoneKind; id: string }>,
): void {
  for (const row of rows) removeWithTombstone(doc, row.kind, row.id);
}
