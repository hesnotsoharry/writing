import type { EpochManager, SnapshotRef } from "./epochManager";
import type { LiveSceneBindings } from "./liveSceneBindings";
import type { DurableOutbox } from "./outbox";

export interface CatchUpResult { replaced: string[]; waitingForOwner: string[] }

export class CatchUpCoordinator {
  constructor(
    private readonly epochs: EpochManager,
    private readonly liveScenes: LiveSceneBindings,
    private readonly outbox: DurableOutbox | null,
    private readonly notifyReplaced: (sceneId: string) => void,
  ) {}

  async prepare(sceneIds?: readonly string[]): Promise<{ snapshots: SnapshotRef[] }> {
    const ids = this.sceneIds(sceneIds);
    await this.liveScenes.flushAndClose(ids);
    return { snapshots: await this.epochs.snapshotPending(ids) };
  }

  async apply(sceneIds?: readonly string[]): Promise<CatchUpResult> {
    const ids = this.sceneIds(sceneIds);
    await this.prepare(ids);
    const replaced = await this.epochs.applyPending(ids);
    for (const sceneId of replaced) {
      await this.outbox?.removeItem("scene", sceneId);
      this.notifyReplaced(sceneId);
    }
    return { replaced, waitingForOwner: ids.filter((id) => this.epochs.isBehind(id)) };
  }

  private sceneIds(sceneIds?: readonly string[]): readonly string[] {
    return sceneIds ?? this.epochs.listBehind().map(({ sceneId }) => sceneId);
  }
}
