/**
 * InMemorySnapshotStore — in-memory implementation for tests.
 * Matches the SnapshotStore interface without any SQLite dependency.
 */
import type { Snapshot, SnapshotStore, TakeSnapshotInput } from "./snapshotStore";

interface StoredSnapshot {
  meta: Snapshot;
  stateBase64: string;
}

export class InMemorySnapshotStore implements SnapshotStore {
  private snapshots: Map<string, StoredSnapshot> = new Map();

  async takeSnapshot({
    sceneId, label, stateBase64, wordCount, kind = "manual",
  }: TakeSnapshotInput): Promise<Snapshot> {
    const id = crypto.randomUUID();
    const meta: Snapshot = {
      id,
      sceneId,
      label,
      wordCount,
      createdAt: Date.now(),
      kind,
    };
    this.snapshots.set(id, { meta, stateBase64 });
    return { ...meta };
  }

  async listSnapshots(sceneId: string): Promise<Snapshot[]> {
    const results: Snapshot[] = [];
    for (const { meta } of this.snapshots.values()) {
      if (meta.sceneId === sceneId) results.push({ ...meta });
    }
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getSnapshot(
    id: string
  ): Promise<{ meta: Snapshot; stateBase64: string } | null> {
    const stored = this.snapshots.get(id);
    if (!stored) return null;
    return { meta: { ...stored.meta }, stateBase64: stored.stateBase64 };
  }

  async renameSnapshot(id: string, label: string): Promise<void> {
    const stored = this.snapshots.get(id);
    if (!stored) return;
    stored.meta.label = label;
  }

  async deleteSnapshot(id: string): Promise<void> {
    this.snapshots.delete(id);
  }

  async pruneAuto(sceneId: string, keepN: number): Promise<void> {
    const autos = [...this.snapshots.values()]
      .filter((s) => s.meta.sceneId === sceneId && s.meta.kind === "auto")
      .sort((a, b) => b.meta.createdAt - a.meta.createdAt);
    const toDelete = autos.slice(keepN);
    for (const s of toDelete) {
      this.snapshots.delete(s.meta.id);
    }
  }
}
