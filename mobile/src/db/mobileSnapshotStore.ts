import type { DbClient } from "../shared/dbClient";
import type { Snapshot, SnapshotStore, TakeSnapshotInput } from "../shared/snapshotStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";
import { MobileSnapshotStore as SyncSnapshotStore } from "./syncStores/mobileSnapshotStore";

/** UI wrapper: composes the sync-owned full implementation without editing it. */
export class MobileSnapshotStore implements SnapshotStore {
  constructor(
    private readonly db: DbClient,
    private readonly inner = new SyncSnapshotStore(),
  ) {}

  async takeSnapshot(input: TakeSnapshotInput): Promise<Snapshot> {
    const snapshot = await this.inner.takeSnapshot(input);
    await this.notify(snapshot.id, false);
    return snapshot;
  }
  listSnapshots(sceneId: string) { return this.inner.listSnapshots(sceneId); }
  getSnapshot(id: string) { return this.inner.getSnapshot(id); }
  async renameSnapshot(id: string, label: string): Promise<void> {
    await this.inner.renameSnapshot(id, label);
    await this.notify(id, false);
  }
  async deleteSnapshot(id: string): Promise<void> {
    const projectId = await this.projectId(id);
    await this.inner.deleteSnapshot(id);
    if (projectId) mobileLocalWrites.notify({
      domain: "scene_snapshots", projectId, rowId: id, deleted: true,
    });
  }
  async pruneAuto(sceneId: string, keepN: number): Promise<void> {
    if (keepN <= 0) return;
    const doomed = await this.db.select<Array<{ id: string; project_id: string }>>(
      `SELECT ss.id, s.project_id FROM scene_snapshots ss JOIN scenes s ON s.id = ss.scene_id
       WHERE ss.scene_id = ? AND ss.kind = 'auto' ORDER BY ss.created_at DESC LIMIT -1 OFFSET ?`,
      [sceneId, keepN],
    );
    await this.inner.pruneAuto(sceneId, keepN);
    doomed.forEach((row) => mobileLocalWrites.notify({
      domain: "scene_snapshots", projectId: row.project_id, rowId: row.id, deleted: true,
    }));
  }
  async updateWordCount(id: string, wordCount: number): Promise<void> {
    await this.inner.updateWordCount(id, wordCount);
    await this.notify(id, false);
  }

  private async projectId(id: string): Promise<string | undefined> {
    const rows = await this.db.select<{ project_id: string }[]>(
      `SELECT s.project_id FROM scene_snapshots ss
       JOIN scenes s ON s.id = ss.scene_id WHERE ss.id = ?`, [id],
    );
    return rows[0]?.project_id;
  }

  private async notify(id: string, deleted: boolean): Promise<void> {
    const projectId = await this.projectId(id);
    if (projectId) mobileLocalWrites.notify({
      domain: "scene_snapshots", projectId, rowId: id, deleted,
    });
  }
}
