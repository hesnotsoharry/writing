import { toUint8Array } from "js-base64";
import * as Y from "yjs";

import { applyBibleDoc } from "./bible/bibleApplyExec";
import type { EngineDocRepository } from "./engineDocRepository";
import type { EngineOptions } from "./engineTypes";
import type { EpochManager } from "./epochManager";
import { exclusiveDomainDoc, exclusiveMetaDoc } from "./exclusiveLock";
import type { LiveSceneUpdateRouter } from "./liveSceneUpdateRouter";
import type { DiffMessage, LiveMessage } from "./messages";
import { parseChannel, sceneChannel } from "./messages";
import { applyMetaDoc } from "./meta/applyExec";
import { mergeStoredBoard, mergeStoredMeta } from "./storedDocMerge";

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
    if (channel.kind === "bible") { await this.mergeBible(channel.id, update); return; }
    await this.dependencies.scenes.apply(channel.id, message, update);
  }

  private async mergeMeta(projectId: string, incoming: Uint8Array): Promise<void> {
    const { options, epochs, requestScene, notifyStructure } = this.dependencies;
    const { metaStore, metaApplyTarget } = options;
    if (!metaStore) return;
    const behind = await exclusiveMetaDoc(projectId, async () => {
      const merged = await mergeStoredMeta(metaStore, projectId, incoming);
      const behindScenes = epochs.readMetaUpdate(merged, projectId);
      const doc = new Y.Doc(); Y.applyUpdate(doc, merged);
      if (metaApplyTarget) await applyMetaDoc(projectId, doc, metaApplyTarget);
      return behindScenes;
    });
    await Promise.all(behind.map((sceneId) => requestScene(sceneChannel(sceneId))));
    notifyStructure();
  }

  private async mergeBible(projectId: string, incoming: Uint8Array): Promise<void> {
    await exclusiveDomainDoc("bible", projectId, async () => {
      const merged = await this.dependencies.docs.mergeDomain("bible", projectId, incoming);
      if (!merged) return;
      const doc = new Y.Doc(); Y.applyUpdate(doc, merged);
      const target = this.dependencies.options.bibleApplyTarget;
      if (target) await applyBibleDoc(projectId, doc, target);
    });
  }
}

interface RouterDependencies {
  options: EngineOptions; epochs: EpochManager; docs: EngineDocRepository;
  scenes: LiveSceneUpdateRouter; requestScene: (channel: string) => Promise<void>;
  notifyStructure: () => void;
}
