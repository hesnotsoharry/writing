import { type DiffMessage, metaChannel } from "./messages";

export interface ReplacementSources {
  metaStore?: { load(projectId: string): Promise<string | null> };
}

/** Projects whose local restore advanced an epoch, held until meta can publish. */
export class ReplacementQueue {
  private readonly pending = new Map<string, Set<string>>();

  add(projectId: string, sceneIds: string[]): void {
    const scenes = this.pending.get(projectId) ?? new Set<string>();
    for (const sceneId of sceneIds) scenes.add(sceneId);
    this.pending.set(projectId, scenes);
  }

  hasPending(): boolean { return this.pending.size > 0; }

  /**
   * Publish only authoritative meta. A peer that becomes behind immediately asks
   * for full scene state with an empty vector, and only the converged owner answers.
   * Sending both concurrent replacement bodies before ownership converges would
   * merge the two restores before either restorer knew it had lost.
   */
  async flush(
    sources: ReplacementSources, send: (frame: DiffMessage) => Promise<void>
  ): Promise<void> {
    const entries = [...this.pending];
    this.pending.clear();
    try {
      for (const [projectId] of entries) await this.sendOne(projectId, sources, send);
    } catch (error) {
      for (const [projectId, sceneIds] of entries) this.add(projectId, [...sceneIds]);
      throw error;
    }
  }

  private async sendOne(
    projectId: string, sources: ReplacementSources, send: (frame: DiffMessage) => Promise<void>
  ): Promise<void> {
    const meta = await sources.metaStore?.load(projectId) ?? null;
    if (meta !== null) await send({ t: "diff", c: metaChannel(projectId), u: meta });
  }
}
