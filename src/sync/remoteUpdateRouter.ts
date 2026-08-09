import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { EngineDocRepository } from "./engineDocRepository";
import type { EngineOptions } from "./engineTypes";
import type { EpochManager } from "./epochManager";
import type { LiveSceneUpdateRouter } from "./liveSceneUpdateRouter";
import type { DiffMessage, LiveMessage } from "./messages";
import { parseChannel, sceneChannel } from "./messages";
import { applyMetaDoc } from "./meta/applyExec";
import { mergeStoredBoard } from "./storedDocMerge";

export class RemoteUpdateRouter {
  constructor(private readonly dependencies: RouterDependencies) {}

  async apply(message: DiffMessage | LiveMessage): Promise<void> {
    const channel = parseChannel(message.c);
    if (!channel) return;
    const update = toUint8Array(message.u);
    if (channel.kind === "meta") { await this.mergeMeta(channel.id, update); return; }
    if (channel.kind === "board") {
      await mergeStoredBoard(this.dependencies.options.boardStore, channel.id, update); return;
    }
    if (channel.kind === "bible") {
      await this.dependencies.docs.mergeDomain("bible", channel.id, update); return;
    }
    await this.dependencies.scenes.apply(channel.id, message, update);
  }

  private async mergeMeta(projectId: string, incoming: Uint8Array): Promise<void> {
    const { options, epochs, requestScene, notifyStructure } = this.dependencies;
    if (!options.metaStore) return;
    const stored = await options.metaStore.load(projectId);
    const merged = stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
    await options.metaStore.save(projectId, fromUint8Array(merged));
    const behind = epochs.readMetaUpdate(merged, projectId);
    await Promise.all(behind.map((sceneId) => requestScene(sceneChannel(sceneId))));
    const doc = new Y.Doc(); Y.applyUpdate(doc, merged);
    if (options.metaApplyTarget) await applyMetaDoc(projectId, doc, options.metaApplyTarget);
    notifyStructure();
  }
}

interface RouterDependencies {
  options: EngineOptions; epochs: EpochManager; docs: EngineDocRepository;
  scenes: LiveSceneUpdateRouter; requestScene: (channel: string) => Promise<void>;
  notifyStructure: () => void;
}
