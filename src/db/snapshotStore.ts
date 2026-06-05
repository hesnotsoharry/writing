/**
 * SnapshotStore — abstraction over per-scene version history.
 *
 * A snapshot is a named, timestamped, base64-encoded copy of a scene's
 * Yjs doc state. The store owns take/list/rename/delete/restore.
 *
 * base64 is TEXT (never BLOB) — tauri-plugin-sql does not reliably
 * round-trip binary columns (CLAUDE.md gotcha).
 */

export interface Snapshot {
  id: string;
  sceneId: string;
  /** Null for auto-saves; user-supplied label for manual snapshots. */
  label: string | null;
  wordCount: number;
  createdAt: number;
  kind: "manual" | "auto";
}

export interface TakeSnapshotInput {
  sceneId: string;
  label: string | null;
  stateBase64: string;
  wordCount: number;
  kind?: "manual" | "auto";
}

export interface SnapshotStore {
  /**
   * Create and persist a snapshot for a scene.
   * `stateBase64` must be the full encodeDoc(doc) output — TEXT encoding only.
   * Returns the created Snapshot (without the stateBase64 payload).
   */
  takeSnapshot(input: TakeSnapshotInput): Promise<Snapshot>;

  /** List all snapshots for a scene, newest first. */
  listSnapshots(sceneId: string): Promise<Snapshot[]>;

  /**
   * Fetch the full snapshot record including state_base64.
   * Returns null if the id is not found.
   */
  getSnapshot(id: string): Promise<{ meta: Snapshot; stateBase64: string } | null>;

  /** Rename a snapshot's label. No-op if id not found. */
  renameSnapshot(id: string, label: string): Promise<void>;

  /** Delete a snapshot by id. No-op if id not found. */
  deleteSnapshot(id: string): Promise<void>;

  /**
   * Cap the number of auto-snapshots for a scene to keepN (newest first).
   * Excess older auto-snapshots are deleted. Manual snapshots are untouched.
   */
  pruneAuto(sceneId: string, keepN: number): Promise<void>;

  // NOTE: No `restoreSnapshot` store method by design.
  // Restore is an app-layer operation (see App.snapshots.ts:snapRestore).
  // The store returns the snapshot payload via `getSnapshot`; callers apply
  // it to the Y.Doc via `applyEncoded`. Keeping restore in the app layer
  // avoids a circular dependency (store → Yjs serialize layer) and correctly
  // separates storage concerns from document-state concerns.
}
