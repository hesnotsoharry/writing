import type * as Y from "yjs";

import type { SceneStatus } from "../../db/binderStore";
import type { LabelColor } from "../../db/labelStore";
import { readMetaDoc, type TombstoneKind } from "./metaDoc";

export interface SqlProjectionSnapshot {
  folders: SqlFolderRow[]; scenes: SqlSceneRow[]; labels: SqlLabelRow[];
  sceneLabels: SqlSceneLabelRow[];
}
export interface SqlFolderRow {
  id: string; project_id: string; title: string; sort_order: number;
}
export interface SqlSceneRow {
  id: string; project_id: string; folder_id: string | null; title: string;
  synopsis: string | null; status: SceneStatus; sort_order: number;
}
export interface SqlLabelRow {
  id: string; project_id: string; name: string; color: LabelColor; sort: number;
}
export interface SqlSceneLabelRow { scene_id: string; label_id: string }

export type LabelOp =
  | { type: "upsert"; row: SqlLabelRow }
  | { type: "assign"; sceneId: string; labelId: string }
  | { type: "unassign"; sceneId: string; labelId: string };
export interface DeleteOp { kind: TombstoneKind; id: string }
export interface SortOrderRewrite {
  kind: "folder" | "scene" | "label"; id: string; sortOrder: number;
}
export interface ApplyPlan {
  folderUpserts: SqlFolderRow[]; sceneUpserts: SqlSceneRow[];
  labelOps: LabelOp[]; deletes: DeleteOp[];
  sortOrderRewrites: SortOrderRewrite[];
}

function differs<T extends object>(left: T, right: T, fields: Array<keyof T>): boolean {
  return fields.some((field) => left[field] !== right[field]);
}

function bySortKey<T extends { id: string; sortKey: string }>(left: T, right: T): number {
  if (left.sortKey !== right.sortKey) return left.sortKey < right.sortKey ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function grouped<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row]);
  return groups;
}

function changedIndexes(
  currentIds: string[], desiredIds: string[], kind: SortOrderRewrite["kind"]
): SortOrderRewrite[] {
  if (currentIds.join("\0") === desiredIds.join("\0")) return [];
  const currentIndex = new Map(currentIds.map((id, index) => [id, index]));
  return desiredIds.flatMap((id, index) => {
    const oldIndex = currentIndex.get(id);
    return oldIndex !== undefined && oldIndex !== index
      ? [{ kind, id, sortOrder: (index + 1) * 1000 }]
      : [];
  });
}

function folderRewrites(
  current: SqlProjectionSnapshot["folders"], desired: ReturnType<typeof readMetaDoc>["folders"]
): SortOrderRewrite[] {
  const oldGroups = grouped(current, (row) => row.project_id);
  const newGroups = grouped(desired, (row) => row.projectId);
  return Array.from(newGroups, ([projectId, rows]) => changedIndexes(
    [...(oldGroups.get(projectId) ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((r) => r.id),
    [...rows].sort(bySortKey).map((r) => r.id), "folder"
  )).flat();
}

function sceneGroup(row: { project_id: string; folder_id: string | null }): string {
  return `${row.project_id}\0${row.folder_id ?? ""}`;
}

function sceneRewrites(
  current: SqlProjectionSnapshot["scenes"], desired: ReturnType<typeof readMetaDoc>["scenes"]
): SortOrderRewrite[] {
  const oldGroups = grouped(current, sceneGroup);
  const newGroups = grouped(desired, (row) => sceneGroup({
    project_id: row.projectId, folder_id: row.folderId,
  }));
  return Array.from(newGroups, ([groupId, rows]) => changedIndexes(
    [...(oldGroups.get(groupId) ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((r) => r.id),
    [...rows].sort(bySortKey).map((r) => r.id), "scene"
  )).flat();
}

function labelRewrites(
  current: SqlProjectionSnapshot["labels"], desired: ReturnType<typeof readMetaDoc>["labels"]
): SortOrderRewrite[] {
  const oldGroups = grouped(current, (row) => row.project_id);
  const newGroups = grouped(desired, (row) => row.projectId);
  return Array.from(newGroups, ([projectId, rows]) => changedIndexes(
    [...(oldGroups.get(projectId) ?? [])].sort((a, b) => a.sort - b.sort).map((r) => r.id),
    [...rows].sort(bySortKey).map((r) => r.id), "label"
  )).flat();
}

function planFolders(state: ReturnType<typeof readMetaDoc>, sql: SqlProjectionSnapshot): SqlFolderRow[] {
  const current = new Map(sql.folders.map((row) => [row.id, row]));
  return [...state.folders].sort(bySortKey).flatMap((row, index) => {
    const next = { id: row.id, project_id: row.projectId, title: row.title,
      sort_order: (index + 1) * 1000 };
    const old = current.get(row.id);
    return !old || differs(old, next, ["project_id", "title"]) ? [next] : [];
  });
}

function sceneOrders(state: ReturnType<typeof readMetaDoc>): Map<string, number> {
  const result = new Map<string, number>();
  for (const rows of grouped(state.scenes, (row) => `${row.projectId}\0${row.folderId ?? ""}`).values()) {
    [...rows].sort(bySortKey).forEach((row, index) => result.set(row.id, (index + 1) * 1000));
  }
  return result;
}

function planScenes(state: ReturnType<typeof readMetaDoc>, sql: SqlProjectionSnapshot): SqlSceneRow[] {
  const current = new Map(sql.scenes.map((row) => [row.id, row]));
  const orders = sceneOrders(state);
  return state.scenes.flatMap((row) => {
    const next = { id: row.id, project_id: row.projectId, folder_id: row.folderId,
      title: row.title, synopsis: row.synopsis, status: row.status, sort_order: orders.get(row.id)! };
    const old = current.get(row.id);
    const fields: Array<keyof SqlSceneRow> = ["project_id", "folder_id", "title", "synopsis", "status"];
    return !old || differs(old, next, fields) ? [next] : [];
  });
}

function planLabels(state: ReturnType<typeof readMetaDoc>, sql: SqlProjectionSnapshot): LabelOp[] {
  const current = new Map(sql.labels.map((row) => [row.id, row]));
  const sorted = grouped(state.labels, (row) => row.projectId);
  const ops: LabelOp[] = [];
  for (const rows of sorted.values()) [...rows].sort(bySortKey).forEach((row, index) => {
    const next = { id: row.id, project_id: row.projectId, name: row.name,
      color: row.color, sort: (index + 1) * 1000 };
    const old = current.get(row.id);
    if (!old || differs(old, next, ["project_id", "name", "color"])) ops.push({ type: "upsert", row: next });
  });
  const links = new Set(sql.sceneLabels.map((row) => `${row.scene_id}\0${row.label_id}`));
  for (const row of state.sceneLabels) {
    if (!links.has(`${row.sceneId}\0${row.labelId}`)) {
      ops.push({ type: "assign", sceneId: row.sceneId, labelId: row.labelId });
    }
  }
  return ops;
}

function planDeletes(state: ReturnType<typeof readMetaDoc>, sql: SqlProjectionSnapshot): DeleteOp[] {
  const existing: Record<TombstoneKind, Set<string>> = {
    folder: new Set(sql.folders.map((row) => row.id)),
    scene: new Set(sql.scenes.map((row) => row.id)),
    label: new Set(sql.labels.map((row) => row.id)),
    sceneLabel: new Set(sql.sceneLabels.map((row) => `${row.scene_id}:${row.label_id}`)),
  };
  return Object.entries(state.tombstones).flatMap(([id, tombstone]) =>
    existing[tombstone.kind].has(id) ? [{ kind: tombstone.kind, id }] : []
  ).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function unassignOps(deletes: DeleteOp[]): LabelOp[] {
  return deletes.flatMap((op) => {
    if (op.kind !== "sceneLabel") return [];
    const separator = op.id.indexOf(":");
    if (separator < 0) return [];
    return [{ type: "unassign" as const, sceneId: op.id.slice(0, separator),
      labelId: op.id.slice(separator + 1) }];
  });
}

/** Plan the ordered, idempotent mutations needed to project a meta doc into SQLite. */
export function planMetaDocApplication(doc: Y.Doc, sql: SqlProjectionSnapshot): ApplyPlan {
  const state = readMetaDoc(doc);
  const deletes = planDeletes(state, sql);
  return {
    folderUpserts: planFolders(state, sql),
    sceneUpserts: planScenes(state, sql),
    labelOps: [...planLabels(state, sql), ...unassignOps(deletes)],
    deletes,
    sortOrderRewrites: [
      ...folderRewrites(sql.folders, state.folders),
      ...sceneRewrites(sql.scenes, state.scenes),
      ...labelRewrites(sql.labels, state.labels),
    ],
  };
}
