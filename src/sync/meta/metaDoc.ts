import * as Y from "yjs";

import type { SceneStatus } from "../../db/binderStore";
import type { LabelColor } from "../../db/labelStore";
import { initialKeysFor } from "./sortKey";

export type TombstoneKind = "folder" | "scene" | "label" | "sceneLabel";

export interface MetaProject { id: string; title: string; type: string }
export interface MetaFolder {
  id: string; projectId: string; title: string; sortKey: string;
}
export interface MetaScene {
  id: string; projectId: string; folderId: string | null; title: string;
  synopsis: string | null; status: SceneStatus; sortKey: string;
}
export interface MetaLabel {
  id: string; projectId: string; name: string; color: LabelColor; sortKey: string;
}
export interface MetaSceneLabel { id: string; sceneId: string; labelId: string }
export interface MetaTombstone { kind: TombstoneKind; at: number }

export interface SqlMetaRows {
  project?: { id: string; title: string; type: string };
  folders: Array<{ id: string; project_id: string; title: string; sort_order: number }>;
  scenes: Array<{
    id: string; project_id: string; folder_id: string | null; title: string;
    synopsis: string | null; status: SceneStatus; sort_order: number;
  }>;
  labels: Array<{
    id: string; project_id: string; name: string; color: LabelColor; sort: number;
  }>;
  sceneLabels: Array<{ id?: string; scene_id: string; label_id: string }>;
  docEpochs?: Record<string, number>;
}

export interface MetaState {
  project: MetaProject | null;
  folders: MetaFolder[]; scenes: MetaScene[]; labels: MetaLabel[];
  sceneLabels: MetaSceneLabel[]; docEpochs: Record<string, number>;
  tombstones: Record<string, MetaTombstone>;
}

const mapNames = {
  folder: "folders", scene: "scenes", label: "labels", sceneLabel: "sceneLabels",
} as const;

function rowsMap(doc: Y.Doc, name: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>(name);
}

function writeRow<T extends { id: string }>(doc: Y.Doc, name: string, row: T): void {
  doc.transact(() => {
    const rows = rowsMap(doc, name);
    const existing = rows.get(row.id);
    const target = existing ?? new Y.Map<unknown>();
    for (const [field, value] of Object.entries(row)) if (field !== "id") target.set(field, value);
    if (!existing) rows.set(row.id, target);
    doc.getMap<MetaTombstone>("tombstones").delete(row.id);
  });
}

function readRows<T extends { id: string }>(doc: Y.Doc, name: string): T[] {
  return Array.from(rowsMap(doc, name), ([id, row]) => ({ id, ...row.toJSON() }) as T)
    .sort((left, right) => compareText(left.id, right.id));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function setFolder(doc: Y.Doc, row: MetaFolder): void { writeRow(doc, "folders", row); }
export function setScene(doc: Y.Doc, row: MetaScene): void { writeRow(doc, "scenes", row); }
export function setLabel(doc: Y.Doc, row: MetaLabel): void { writeRow(doc, "labels", row); }
export function setSceneLabel(doc: Y.Doc, row: MetaSceneLabel): void {
  writeRow(doc, "sceneLabels", row);
}

export function getFolders(doc: Y.Doc): MetaFolder[] { return readRows(doc, "folders"); }
export function getScenes(doc: Y.Doc): MetaScene[] { return readRows(doc, "scenes"); }
export function getLabels(doc: Y.Doc): MetaLabel[] { return readRows(doc, "labels"); }
export function getSceneLabels(doc: Y.Doc): MetaSceneLabel[] { return readRows(doc, "sceneLabels"); }
export function getDocEpochs(doc: Y.Doc): Record<string, number> {
  return doc.getMap<number>("docEpochs").toJSON();
}
export function getTombstones(doc: Y.Doc): Record<string, MetaTombstone> {
  return doc.getMap<MetaTombstone>("tombstones").toJSON();
}

export function getProject(doc: Y.Doc): MetaProject | null {
  const value = doc.getMap<unknown>("project").toJSON();
  return typeof value.id === "string" && typeof value.title === "string"
    && typeof value.type === "string"
    ? { id: value.id, title: value.title, type: value.type }
    : null;
}

export function removeWithTombstone(
  doc: Y.Doc, kind: TombstoneKind, id: string, at = Date.now()
): void {
  doc.transact(() => {
    rowsMap(doc, mapNames[kind]).delete(id);
    doc.getMap<MetaTombstone>("tombstones").set(id, { kind, at });
  });
}

export function bumpEpoch(doc: Y.Doc, docId: string): number {
  let next = 0;
  doc.transact(() => {
    const epochs = doc.getMap<number>("docEpochs");
    next = (epochs.get(docId) ?? 0) + 1;
    epochs.set(docId, next);
  });
  return next;
}

export function getEpoch(doc: Y.Doc, docId: string): number {
  return doc.getMap<number>("docEpochs").get(docId) ?? 0;
}

export function readMetaDoc(doc: Y.Doc): MetaState {
  return {
    project: getProject(doc),
    folders: getFolders(doc), scenes: getScenes(doc), labels: getLabels(doc),
    sceneLabels: getSceneLabels(doc),
    docEpochs: getDocEpochs(doc), tombstones: getTombstones(doc),
  };
}

function orderedKeys<T extends { id: string }>(rows: T[], order: (row: T) => number): Map<string, string> {
  const sorted = [...rows].sort((a, b) => order(a) - order(b) || compareText(a.id, b.id));
  const keys = initialKeysFor(sorted.length);
  return new Map(sorted.map((row, index) => [row.id, keys[index]]));
}

function sceneKeys(rows: SqlMetaRows["scenes"]): Map<string, string> {
  const result = new Map<string, string>();
  const groups = new Map<string, SqlMetaRows["scenes"]>();
  for (const row of rows) {
    const groupId = `${row.project_id}\0${row.folder_id ?? ""}`;
    groups.set(groupId, [...(groups.get(groupId) ?? []), row]);
  }
  for (const group of groups.values()) {
    for (const [id, key] of orderedKeys(group, (row) => row.sort_order)) result.set(id, key);
  }
  return result;
}

export function sceneLabelId(sceneId: string, labelId: string): string {
  return `${sceneId}:${labelId}`;
}

/** Bootstrap a complete project meta doc from its current SQLite projection. */
export function buildFromSql(rows: SqlMetaRows): Y.Doc {
  const doc = new Y.Doc();
  const folderKeys = orderedKeys(rows.folders, (row) => row.sort_order);
  const labelKeys = orderedKeys(rows.labels, (row) => row.sort);
  const scenes = sceneKeys(rows.scenes);
  doc.transact(() => {
    if (rows.project) {
      const project = doc.getMap<unknown>("project");
      project.set("id", rows.project.id);
      project.set("title", rows.project.title);
      project.set("type", rows.project.type);
    }
    for (const row of rows.folders) setFolder(doc, {
      id: row.id, projectId: row.project_id, title: row.title, sortKey: folderKeys.get(row.id)!,
    });
    for (const row of rows.scenes) setScene(doc, {
      id: row.id, projectId: row.project_id, folderId: row.folder_id, title: row.title,
      synopsis: row.synopsis, status: row.status, sortKey: scenes.get(row.id)!,
    });
    for (const row of rows.labels) setLabel(doc, {
      id: row.id, projectId: row.project_id, name: row.name, color: row.color,
      sortKey: labelKeys.get(row.id)!,
    });
    for (const row of rows.sceneLabels) setSceneLabel(doc, {
      id: row.id ?? sceneLabelId(row.scene_id, row.label_id),
      sceneId: row.scene_id, labelId: row.label_id,
    });
    for (const [id, epoch] of Object.entries(rows.docEpochs ?? {})) {
      doc.getMap<number>("docEpochs").set(id, epoch);
    }
    doc.getMap<MetaTombstone>("tombstones");
  });
  return doc;
}
