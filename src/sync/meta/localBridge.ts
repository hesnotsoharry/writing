import { allocateSortKeys } from "./allocateSortKey";
import { withProjectMeta } from "./bridge";
import {
  applyFolderMutation,
  applyLabelMutation,
  applyRemoved,
  applySceneMutation,
  type LocalFolderRow,
  type LocalLabelRow,
  type LocalSceneRow,
} from "./localMutators";
import {
  getLabels,
  removeWithTombstone,
  sceneLabelId,
  setLabel,
  setSceneLabel,
  type TombstoneKind,
} from "./metaDoc";

export type { LocalFolderRow, LocalLabelRow, LocalSceneRow };

function report(operation: string, promise: Promise<void>): void {
  void promise.catch((error: unknown) => console.error(`[sync-meta] ${operation}`, error));
}

function compareSortKey(left: { sortKey: string }, right: { sortKey: string }): number {
  return left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0;
}

export function bridgeFolder(row: LocalFolderRow, orderedIds?: string[]): void {
  report("folder mutation", withProjectMeta(row.projectId, (doc) => {
    applyFolderMutation(doc, row, orderedIds);
  }));
}

export function bridgeScene(row: LocalSceneRow, orderedIds?: string[]): void {
  report("scene mutation", withProjectMeta(row.projectId, (doc) => {
    applySceneMutation(doc, row, orderedIds);
  }));
}

export function bridgeLabel(row: LocalLabelRow, orderedIds?: string[]): void {
  report("label mutation", withProjectMeta(row.projectId, (doc) => {
    applyLabelMutation(doc, row, orderedIds);
  }));
}

export function bridgeRemoved(
  projectId: string,
  rows: Array<{ kind: TombstoneKind; id: string }>,
  operation: string
): void {
  report(operation, withProjectMeta(projectId, (doc) => applyRemoved(doc, rows)));
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
    for (const [rowId, sortKey] of allocateSortKeys(labels, desired, row.id)) {
      const body = rowId === row.id ? row : labels.find((label) => label.id === rowId);
      if (body) setLabel(doc, { ...body, sortKey });
    }
  }));
}

export function bridgeRestored(
  projectId: string,
  folders: LocalFolderRow[],
  scenes: LocalSceneRow[],
  orders: { folders: string[]; scenes: Map<string, string[]> }
): void {
  report("archive restore", withProjectMeta(projectId, (doc) => {
    for (const row of folders) applyFolderMutation(doc, row, orders.folders);
    for (const row of scenes) {
      const order = orders.scenes.get(row.folderId ?? "") ?? [row.id];
      applySceneMutation(doc, row, order);
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
