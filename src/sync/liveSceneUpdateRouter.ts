import * as Y from "yjs";

import type { SceneDocStore } from "../db/sceneDocStore";
import { SYNC_ORIGIN } from "../yjs/bindPersistence";
import type { EpochManager } from "./epochManager";
import type { EngineLiveScenePort, LiveSceneBindings } from "./liveSceneBindings";
import type { DiffMessage, LiveMessage } from "./messages";
import { mergeStoredScene } from "./storedDocMerge";

interface SceneUpdateOptions {
  sceneStore: SceneDocStore;
  updateWordCount: (sceneId: string, count: number) => Promise<void>;
}

export class LiveSceneUpdateRouter {
  constructor(
    private readonly options: SceneUpdateOptions,
    private readonly epochs: EpochManager,
    private readonly bindings: LiveSceneBindings,
    private readonly notifyReplaced: (sceneId: string) => void,
  ) {}

  async apply(sceneId: string, message: DiffMessage | LiveMessage, update: Uint8Array): Promise<void> {
    if (!this.epochs.accepts(sceneId, message.e)) return;
    const openDoc = this.bindings.docFor(sceneId);
    const livePort = this.bindings.portFor(sceneId);
    if (await this.handleBehind(sceneId, message, openDoc, livePort)) return;
    if (openDoc) { Y.applyUpdate(openDoc, update, SYNC_ORIGIN); return; }
    if (livePort) { await livePort.applyRemoteUpdate(update); return; }
    await mergeStoredScene(
      this.options.sceneStore, this.options.updateWordCount, sceneId, update,
    );
  }

  private async handleBehind(
    sceneId: string,
    message: DiffMessage | LiveMessage,
    openDoc: Y.Doc | null,
    livePort: EngineLiveScenePort | null,
  ): Promise<boolean> {
    if (livePort && this.epochs.isBehind(sceneId)) await flushPort(livePort);
    const result = await this.epochs.handleBehindFrame(sceneId, message, openDoc);
    if (result !== "replaced") return result !== "none";
    if (livePort) await livePort.replaceFromState(message.u);
    if (openDoc || livePort) this.notifyReplaced(sceneId);
    return true;
  }
}

async function flushPort(port: EngineLiveScenePort): Promise<void> {
  try {
    await port.flushLocal();
  } catch {
    // Persisted SQLite state is the recovery boundary; replacement still wins.
  }
}
