/**
 * Snapshot wiring helpers — extracted from App.tsx to satisfy the 300-line file limit.
 * Pure functions that operate on the snapshotStore; no React state.
 */
import { useEffect, useState } from "react";
import * as Y from "yjs";

import type { Snapshot, SnapshotStore } from "./db/snapshotStore";
import { SqliteSnapshotStore } from "./db/sqliteSnapshotStore";
import { applyEncoded, encodeDoc, extractPlainText } from "./yjs/serialize";

export const snapshotStore = new SqliteSnapshotStore();

export type SetSnapshots = (updater: Snapshot[] | ((prev: Snapshot[]) => Snapshot[])) => void;

/** Legacy context shape used by snapRename/snapDelete and as a named bag for ctx in App.tsx. */
export interface SnapCtx {
  sceneId: string | null; doc: Y.Doc | null;
  currentWords: number; set: SetSnapshots; setShowHistory: (v: boolean) => void;
}

/** Options for snapshot operations that address a specific target scene (which may differ from the active scene). */
export interface SnapTargetOpts {
  targetSceneId: string;
  /** True when targetSceneId === the scene currently loaded in the live editor. */
  isActive: boolean;
  activeDoc: Y.Doc | null;
  /** Word count for auto-backup metadata. Meaningful for the active scene only; pass 0 for
   *  non-active targets — historyCurrentWords is 0 for non-active scenes by design in App.tsx. */
  currentWords: number;
  set: SetSnapshots;
  load: (sceneId: string) => Promise<string | null>;
}

/** Extended opts for snapRestore — also needs to persist bytes + optionally reload the live editor. */
export interface SnapRestoreOpts extends SnapTargetOpts {
  save: (sceneId: string, base64: string, plaintext: string | null) => Promise<void>;
  reloadScene: (sceneId: string) => void;
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

/**
 * Resolve serialized bytes for the target scene:
 * - active scene  → encode the live in-memory doc (current editor state, no DB round-trip);
 * - non-active    → load from persistent storage (live doc belongs to a different editor).
 */
async function resolveTargetBytes(
  targetSceneId: string,
  isActive: boolean,
  activeDoc: Y.Doc | null,
  load: (sceneId: string) => Promise<string | null>,
): Promise<string> {
  if (isActive && activeDoc) return encodeDoc(activeDoc);
  return (await load(targetSceneId)) ?? "";
}

export function snapCapture(
  { targetSceneId, isActive, activeDoc, currentWords, set, load }: SnapTargetOpts,
): Promise<string | null> {
  return resolveTargetBytes(targetSceneId, isActive, activeDoc, load)
    .then((base64) =>
      snapshotStore.takeSnapshot({ sceneId: targetSceneId, label: null, stateBase64: base64, wordCount: currentWords, kind: "manual" }),
    )
    .then((snap) => { set((prev) => [snap, ...(prev as Snapshot[])]); return snap.id; })
    .catch((e: unknown) => { console.error("[snapshots] takeSnapshot failed", e); return null; });
}

export function snapRename(snapshotId: string, label: string, sceneId: string | null, set: SetSnapshots): Promise<void> {
  return snapshotStore.renameSnapshot(snapshotId, label)
    .then(() => { if (sceneId) reloadSnapshotList(sceneId, set); })
    .catch((e: unknown) => { console.error("[snapshots] rename failed", e); });
}

export async function snapRestore(opts: SnapRestoreOpts, snapshotId: string): Promise<void> {
  const { targetSceneId, isActive, activeDoc, currentWords, set, load, save, reloadScene } = opts;
  try {
    const record = await snapshotStore.getSnapshot(snapshotId);
    if (!record) return;
    // Pre-restore auto-backup of the TARGET scene's current content.
    // When non-active: bytes come from persistent storage — we must not read or touch the active editor's doc.
    const currentBytes = await resolveTargetBytes(targetSceneId, isActive, activeDoc, load);
    await snapshotStore.takeSnapshot({
      sceneId: targetSceneId, label: null, stateBase64: currentBytes,
      // wordCount is only meaningful for the active scene; 0 for non-active is a known metadata-only
      // limitation (historyCurrentWords is 0 for non-active by design in App.tsx snapState hook).
      wordCount: isActive ? currentWords : 0, kind: "auto",
    });
    // Persist restored bytes to the TARGET scene's store FIRST.
    // The scene reload reads from storage, so saving after the reload would silently no-op.
    // This is the same save-then-reloadScene idiom used by snapUndoReplace (App.snapshots.ts:75–76).
    await save(targetSceneId, record.stateBase64, null);
    // Reload the live editor only when target === active scene.
    // Yjs is append-only — applyEncoded cannot rewind a live doc; a full scene reload is required.
    // For non-active target: bytes are now in storage; the next open picks them up automatically.
    if (isActive) reloadScene(targetSceneId);
    reloadSnapshotList(targetSceneId, set);
  } catch (e: unknown) {
    console.error("[snapshots] restore failed", e);
  }
}

/**
 * Undo a Replace-All operation by restoring the most-recent auto-snapshot for
 * each touched scene. Called from the FindReplace onUndoReplace callback.
 */
export function snapUndoReplace(
  sceneIds: string[],
  save: (sceneId: string, base64: string, plaintext: string | null) => Promise<void>,
  getDoc: (sceneId: string) => Y.Doc | null = () => null,
  reloadScene?: (sceneId: string) => void,
): void {
  for (const sid of sceneIds) {
    snapshotStore.listSnapshots(sid)
      .then((list) => list.find((s) => s.kind === "auto") ?? null)
      .then((snap) => snap ? snapshotStore.getSnapshot(snap.id) : null)
      .then((record) => {
        if (!record) return;
        return save(sid, record.stateBase64, null).then(() => {
          if (reloadScene) { reloadScene(sid); return; }
          const doc = getDoc(sid);
          if (doc) applyEncoded(doc, record.stateBase64);
        });
      })
      .catch((e: unknown) => console.error("[undo-replace] restore failed", e));
  }
}

/**
 * Auto-capture a scene snapshot, skipping if content is unchanged since the
 * last snapshot (trim-normalised plain-text dedup).
 * Used by scene-nav-away and app-close triggers. Creates kind:"auto" entries.
 */
export async function snapAutoCapture({
  sceneId, doc,
}: { sceneId: string; doc: Y.Doc }): Promise<void> {
  const currentText = extractPlainText(doc).trim();
  if (!currentText) return;
  const list = await snapshotStore.listSnapshots(sceneId);
  if (list.length > 0) {
    const lastText = await fetchSnapshotText(list[0].id);
    if (lastText.trim() === currentText) return;
  }
  const wordCount = currentText.split(/\s+/).filter(Boolean).length;
  const stateBase64 = encodeDoc(doc);
  await snapshotStore.takeSnapshot({
    sceneId, label: null, stateBase64, wordCount, kind: "auto",
  });
}

export function snapDelete(snapshotId: string, sceneId: string | null, set: SetSnapshots): Promise<void> {
  return snapshotStore.deleteSnapshot(snapshotId)
    .then(() => { if (sceneId) reloadSnapshotList(sceneId, set); })
    .catch((e: unknown) => { console.error("[snapshots] delete failed", e); });
}

export function snapTakeFromMenu(
  { targetSceneId, isActive, activeDoc, currentWords, set, setShowHistory, load }:
  SnapTargetOpts & { setShowHistory: (v: boolean) => void },
): Promise<void> {
  return resolveTargetBytes(targetSceneId, isActive, activeDoc, load)
    .then((base64) =>
      snapshotStore.takeSnapshot({ sceneId: targetSceneId, label: null, stateBase64: base64, wordCount: currentWords, kind: "manual" }),
    )
    .then(() => { setShowHistory(true); reloadSnapshotList(targetSceneId, set); })
    .catch((e: unknown) => { console.error("[snapshots] takeSnapshot (menu) failed", e); });
}

/**
 * Hook: returns the snapshots for the currently active scene, and refetches
 * automatically when `activeSceneId` changes. Used by the History rail so it
 * always tracks the editor's selected scene without the overlay being opened.
 *
 * Returns [] immediately when `activeSceneId` is null or while the async load
 * is in-flight for a newly-selected scene (avoids showing stale data).
 */
export function useActiveSceneSnapshots(
  store: SnapshotStore,
  activeSceneId: string | null,
  refreshKey?: number,
): Snapshot[] {
  const [loaded, setLoaded] = useState<{ sceneId: string; snapshots: Snapshot[] } | null>(null);
  useEffect(() => {
    if (!activeSceneId) return;
    let alive = true;
    store.listSnapshots(activeSceneId)
      .then((list) => { if (alive) setLoaded({ sceneId: activeSceneId, snapshots: list }); })
      .catch((e: unknown) => console.error("[snapshots] useActiveSceneSnapshots failed", e));
    return () => { alive = false; };
  }, [store, activeSceneId, refreshKey]);
  if (!activeSceneId || loaded?.sceneId !== activeSceneId) return [];
  return loaded.snapshots;
}
