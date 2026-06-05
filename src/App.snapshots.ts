/**
 * Snapshot wiring helpers — extracted from App.tsx to satisfy the 300-line file limit.
 * Pure functions that operate on the snapshotStore; no React state.
 */
import * as Y from "yjs";

import type { Snapshot } from "./db/snapshotStore";
import { SqliteSnapshotStore } from "./db/sqliteSnapshotStore";
import { applyEncoded, encodeDoc, extractPlainText } from "./yjs/serialize";

export const snapshotStore = new SqliteSnapshotStore();

export type SetSnapshots = (updater: Snapshot[] | ((prev: Snapshot[]) => Snapshot[])) => void;

export interface SnapCtx {
  sceneId: string | null; doc: Y.Doc | null;
  currentWords: number; set: SetSnapshots; setShowHistory: (v: boolean) => void;
}

export function reloadSnapshotList(sceneId: string, set: SetSnapshots) {
  snapshotStore.listSnapshots(sceneId)
    .then((list) => set(list))
    .catch((e: unknown) => console.error("[snapshots] reload failed", e));
}

export async function fetchSnapshotText(snapshotId: string): Promise<string> {
  const record = await snapshotStore.getSnapshot(snapshotId);
  if (!record) return "";
  const tempDoc = new Y.Doc();
  applyEncoded(tempDoc, record.stateBase64);
  return extractPlainText(tempDoc);
}

export function snapCapture({ sceneId, doc, currentWords, set }: SnapCtx): Promise<string | null> {
  if (!sceneId || !doc) return Promise.resolve(null);
  const base64 = encodeDoc(doc);
  return snapshotStore.takeSnapshot({ sceneId, label: null, stateBase64: base64, wordCount: currentWords, kind: "manual" })
    .then((snap) => { set((prev) => [snap, ...(prev as Snapshot[])]); return snap.id; })
    .catch((e: unknown) => { console.error("[snapshots] takeSnapshot failed", e); return null; });
}

export function snapRename(snapshotId: string, label: string, sceneId: string | null, set: SetSnapshots) {
  snapshotStore.renameSnapshot(snapshotId, label)
    .then(() => { if (sceneId) reloadSnapshotList(sceneId, set); })
    .catch((e: unknown) => console.error("[snapshots] rename failed", e));
}

export function snapRestore({ sceneId, doc, currentWords, set }: SnapCtx, snapshotId: string) {
  if (!sceneId || !doc) return;
  const currentBase64 = encodeDoc(doc);
  snapshotStore.takeSnapshot({ sceneId, label: null, stateBase64: currentBase64, wordCount: currentWords, kind: "auto" })
    .then(() => snapshotStore.getSnapshot(snapshotId))
    .then((record) => { if (record) applyEncoded(doc, record.stateBase64); })
    .then(() => { if (sceneId) reloadSnapshotList(sceneId, set); })
    .catch((e: unknown) => console.error("[snapshots] restore failed", e));
}

export function snapDelete(snapshotId: string, sceneId: string | null, set: SetSnapshots) {
  snapshotStore.deleteSnapshot(snapshotId)
    .then(() => { if (sceneId) reloadSnapshotList(sceneId, set); })
    .catch((e: unknown) => console.error("[snapshots] delete failed", e));
}

export function snapTakeFromMenu({ doc, currentWords, set, setShowHistory }: SnapCtx, sceneId: string) {
  if (!doc) return;
  const base64 = encodeDoc(doc);
  snapshotStore.takeSnapshot({ sceneId, label: null, stateBase64: base64, wordCount: currentWords, kind: "manual" })
    .then(() => { setShowHistory(true); reloadSnapshotList(sceneId, set); })
    .catch((e: unknown) => console.error("[snapshots] takeSnapshot (menu) failed", e));
}
