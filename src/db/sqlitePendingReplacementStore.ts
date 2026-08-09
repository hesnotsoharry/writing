import type { DbClient } from "./dbClient";
import type { PendingReplacement, PendingReplacementStore } from "./pendingReplacementStore";

interface PendingDbRow {
  scene_id: string; project_id: string; epoch_n: number; epoch_device: string;
  state_base64: string | null; received_at: string; snapshot_id: string | null;
}
const fromDb = (row: PendingDbRow): PendingReplacement => ({
  sceneId: row.scene_id, projectId: row.project_id,
  epoch: { n: row.epoch_n, d: row.epoch_device }, stateBase64: row.state_base64,
  receivedAt: row.received_at, snapshotId: row.snapshot_id,
});

export class SqlitePendingReplacementStore implements PendingReplacementStore {
  constructor(private readonly db: DbClient) {}
  async list(): Promise<PendingReplacement[]> {
    const rows = await this.db.select<PendingDbRow[]>(
      "SELECT * FROM sync_pending_replacements ORDER BY received_at, scene_id",
    );
    return rows.map(fromDb);
  }
  async stage(replacement: PendingReplacement): Promise<void> {
    await this.db.execute(
      `INSERT INTO sync_pending_replacements
       (scene_id, project_id, epoch_n, epoch_device, state_base64, received_at, snapshot_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(scene_id) DO UPDATE SET project_id=excluded.project_id,
       epoch_n=excluded.epoch_n, epoch_device=excluded.epoch_device,
       state_base64=excluded.state_base64, received_at=excluded.received_at,
       snapshot_id=CASE WHEN epoch_n=excluded.epoch_n AND epoch_device=excluded.epoch_device
         THEN snapshot_id ELSE NULL END`,
      [replacement.sceneId, replacement.projectId, replacement.epoch.n,
        replacement.epoch.d, replacement.stateBase64, replacement.receivedAt,
        replacement.snapshotId],
    );
  }
  async setSnapshotId(sceneId: string, snapshotId: string): Promise<void> {
    await this.db.execute(
      "UPDATE sync_pending_replacements SET snapshot_id = ? WHERE scene_id = ?",
      [snapshotId, sceneId],
    );
  }
  async remove(sceneId: string): Promise<void> {
    await this.db.execute("DELETE FROM sync_pending_replacements WHERE scene_id = ?", [sceneId]);
  }
}
