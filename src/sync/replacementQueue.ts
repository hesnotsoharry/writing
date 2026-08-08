import type { EpochManager } from "./epochManager";
import { type DiffMessage, metaChannel, sceneChannel } from "./messages";

export interface ReplacementSources {
  metaStore?: { load(projectId: string): Promise<string | null> };
  sceneStore: { load(sceneId: string): Promise<string | null> };
  epochs: EpochManager;
}

/**
 * Scenes whose epoch a local restore just advanced, held until we can publish.
 *
 * Restores run inside syncEngine.pause() (App.snapshots.ts), and sendMessage
 * drops everything while paused — so the push has to survive until resume, or
 * the peer learns nothing and waits out its own 60s sweep before asking.
 */
export class ReplacementQueue {
  private readonly pending = new Map<string, Set<string>>();

  add(projectId: string, sceneIds: string[]): void {
    const scenes = this.pending.get(projectId) ?? new Set<string>();
    for (const sceneId of sceneIds) scenes.add(sceneId);
    this.pending.set(projectId, scenes);
  }

  /**
   * Send everything queued, meta FIRST (it carries the new epoch) then each scene
   * as a FULL state. A peer that sees the scene before it knows the epoch still has
   * `isBehind === false`, so accepts() lets the bytes MERGE into its stale doc
   * instead of replacing it — resurrection through a side door. A project whose
   * meta cannot be loaded is skipped entirely for the same reason: the scene alone
   * would be unintelligible to the peer.
   *
   * Re-queues on failure, so a dropped socket mid-flush retries on reconnect rather
   * than stranding the peer behind forever. Replays are harmless: the frames carry
   * full state at a fixed epoch, and a peer that already applied it is no longer
   * behind, so handleBehindFrame ignores it.
   */
  async flush(
    sources: ReplacementSources, send: (frame: DiffMessage) => Promise<void>
  ): Promise<void> {
    const entries = [...this.pending];
    this.pending.clear();
    try {
      for (const [projectId, scenes] of entries) await this.sendOne(projectId, scenes, sources, send);
    } catch (error) {
      for (const [projectId, sceneIds] of entries) this.add(projectId, [...sceneIds]);
      throw error;
    }
  }

  private async sendOne(
    projectId: string, sceneIds: Set<string>,
    sources: ReplacementSources, send: (frame: DiffMessage) => Promise<void>
  ): Promise<void> {
    const meta = await sources.metaStore?.load(projectId) ?? null;
    if (meta === null) return;
    await send({ t: "diff", c: metaChannel(projectId), u: meta });
    for (const sceneId of sceneIds) {
      const state = await sources.sceneStore.load(sceneId);
      if (state === null) continue;
      await send({
        t: "diff", c: sceneChannel(sceneId), u: state, e: sources.epochs.epoch(sceneId),
      });
    }
  }
}
