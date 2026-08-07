// Mobile mirror of src/db/sqliteSnapshotStore.ts, over the mobile DbClient.
// SQL is identical to desktop's — mirrored, not shared (portable-boundary
// rule). The SyncEngine only ever calls `takeSnapshot` (EpochManager's
// pre-epoch-replace safety snapshot); the remaining methods exist for
// interface completeness / a future snapshot-browsing screen, not S4 scope.
import type { Snapshot, SnapshotStore, TakeSnapshotInput } from "../../shared/snapshotStore";
import { getMobileDb } from "../database";

interface SnapshotRow {
  id: string;
  scene_id: string;
  label: string | null;
  state_base64: string;
  word_count: number;
  created_at: number;
  kind: string;
}

function mapRow(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    sceneId: row.scene_id,
    label: row.label,
    wordCount: row.word_count,
    createdAt: row.created_at,
    kind: row.kind === "auto" ? "auto" : "manual",
  };
}

export class MobileSnapshotStore implements SnapshotStore {
  async takeSnapshot({
    sceneId, label, stateBase64, wordCount, kind = "manual",
  }: TakeSnapshotInput): Promise<Snapshot> {
    const db = await getMobileDb();
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await db.execute(
      `INSERT INTO scene_snapshots
         (id, scene_id, label, state_base64, word_count, created_at, kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, sceneId, label, stateBase64, wordCount, createdAt, kind]
    );
    return { id, sceneId, label, wordCount, createdAt, kind };
  }

  async listSnapshots(sceneId: string): Promise<Snapshot[]> {
    const db = await getMobileDb();
    const rows = await db.select<SnapshotRow[]>(
      `SELECT id, scene_id, label, word_count, created_at, kind
       FROM scene_snapshots
       WHERE scene_id = $1
       ORDER BY created_at DESC`,
      [sceneId]
    );
    return rows.map((r) => mapRow({ ...r, state_base64: "" }));
  }

  async getSnapshot(id: string): Promise<{ meta: Snapshot; stateBase64: string } | null> {
    const db = await getMobileDb();
    const rows = await db.select<SnapshotRow[]>(
      `SELECT id, scene_id, label, state_base64, word_count, created_at, kind
       FROM scene_snapshots WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return null;
    return { meta: mapRow(rows[0]), stateBase64: rows[0].state_base64 };
  }

  async renameSnapshot(id: string, label: string): Promise<void> {
    const db = await getMobileDb();
    await db.execute("UPDATE scene_snapshots SET label = $1 WHERE id = $2", [label, id]);
  }

  async deleteSnapshot(id: string): Promise<void> {
    const db = await getMobileDb();
    await db.execute("DELETE FROM scene_snapshots WHERE id = $1", [id]);
  }

  async updateWordCount(id: string, wordCount: number): Promise<void> {
    const db = await getMobileDb();
    await db.execute("UPDATE scene_snapshots SET word_count = $1 WHERE id = $2", [wordCount, id]);
  }

  async pruneAuto(sceneId: string, keepN: number): Promise<void> {
    if (keepN <= 0) return;
    const db = await getMobileDb();
    await db.execute(
      `DELETE FROM scene_snapshots
       WHERE scene_id = $1
         AND kind = 'auto'
         AND id NOT IN (
           SELECT id FROM scene_snapshots
           WHERE scene_id = $1 AND kind = 'auto'
           ORDER BY created_at DESC
           LIMIT $2
         )`,
      [sceneId, keepN]
    );
  }
}
