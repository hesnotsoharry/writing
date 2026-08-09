import type { SyncEngine } from "../../shared/engine";

export interface CatchUpSnapshot { sceneId: string; snapshotId: string }

type CatchUpEngine = Pick<SyncEngine, "prepareCatchUp" | "catchUpNow">;

export class CatchUpFlow {
  private prepared = new Map<string, string>();
  constructor(private readonly engine: CatchUpEngine) {}

  async prepare(sceneIds: readonly string[]): Promise<CatchUpSnapshot[]> {
    const { snapshots } = await this.engine.prepareCatchUp(sceneIds);
    snapshots.forEach(({ sceneId, snapshotId }) => this.prepared.set(sceneId, snapshotId));
    return snapshots;
  }

  snapshotFor(sceneId: string): string | null {
    return this.prepared.get(sceneId) ?? null;
  }

  async catchUpNow(sceneIds: readonly string[]): Promise<void> {
    if (sceneIds.some((sceneId) => !this.prepared.has(sceneId))) {
      throw new Error("Catch-up must create a safety snapshot first");
    }
    await this.engine.catchUpNow(sceneIds);
    sceneIds.forEach((sceneId) => this.prepared.delete(sceneId));
  }
}
