import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { EngineOptions, StoredDoc } from "./engineTypes";
import { bibleChannel, boardChannel, type Channel, metaChannel, sceneChannel } from "./messages";

export type ChannelDoc = StoredDoc & { channel: string };

export class EngineDocRepository {
  constructor(private readonly options: EngineOptions) {}

  async listAll(): Promise<ChannelDoc[]> {
    const [scenes, boards, metas, domains] = await Promise.all([
      this.options.sceneStore.listAll(), this.options.boardStore.listAll(),
      this.options.metaStore?.listAll() ?? Promise.resolve([]),
      this.options.domainDocStore?.listAll() ?? Promise.resolve([]),
    ]);
    return [
      ...metas.map((doc) => ({ ...doc, channel: metaChannel(doc.id) })),
      ...scenes.map((doc) => ({ ...doc, channel: sceneChannel(doc.id) })),
      ...boards.map((doc) => ({ ...doc, channel: boardChannel(doc.id) })),
      ...domains.map((doc) => ({ id: doc.projectId, stateBase64: doc.stateBase64,
        updatedAt: doc.updatedAt, channel: bibleChannel(doc.projectId) })),
    ];
  }

  async forChannel(channel: Channel): Promise<StoredDoc[]> {
    if (channel.kind === "scene") return this.options.sceneStore.listAll();
    if (channel.kind === "board") return this.options.boardStore.listAll();
    if (channel.kind === "meta") return this.options.metaStore?.listAll() ?? [];
    const rows = await this.options.domainDocStore?.listAll() ?? [];
    return rows.filter((row) => row.domain === "bible").map((row) => ({
      id: row.projectId, stateBase64: row.stateBase64, updatedAt: row.updatedAt,
    }));
  }

  async mergeDomain(domain: string, projectId: string, incoming: Uint8Array): Promise<void> {
    if (!this.options.domainDocStore) return;
    const stored = await this.options.domainDocStore.load(domain, projectId);
    const merged = stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
    await this.options.domainDocStore.save(domain, projectId, fromUint8Array(merged));
  }
}
