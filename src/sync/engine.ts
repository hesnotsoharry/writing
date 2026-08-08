import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { BoardDocStore } from "../db/boardDocStore";
import type { ProjectMetaDocStore } from "../db/projectMetaDocStore";
import type { SceneDocStore } from "../db/sceneDocStore";
import type { SnapshotStore } from "../db/snapshotStore";
import type { AppliedEpochs, AppliedEpochStore } from "../db/syncEpochStore";
import { answerFrame, helloDoc, targetedSaveFrame } from "./epochFrames";
import { EpochManager } from "./epochManager";
import { openMessage, sealMessage } from "./frameCodec";
import { deriveKeys } from "./keys";
import { type EngineLiveScenePort, LiveSceneBindings } from "./liveSceneBindings";
import { LiveSceneUpdateRouter } from "./liveSceneUpdateRouter";
import {
  boardChannel, type HelloMessage, type InnerMessage,
  isInnerMessage, metaChannel, parseChannel, sceneChannel,
} from "./messages";
import { applyMetaDoc, type MetaApplyTarget } from "./meta/applyExec";
import type { ConnectionState } from "./provider";
import { StatusEmitter, type SyncStatus } from "./statusEmitter";
import { mergeStoredBoard } from "./storedDocMerge";

export type { EngineLiveScenePort, LiveSceneFlushResult } from "./liveSceneBindings";
export type { SyncState, SyncStatus } from "./statusEmitter";
import { ReplacementQueue } from "./replacementQueue";

export interface SyncProvider {
  connect(): void;
  destroy(): void;
  send(blob: Uint8Array): void;
  subscribeConnection(cb: (state: ConnectionState) => void): () => void;
  subscribeFrames(cb: (blob: Uint8Array) => void): () => void;
}

interface StoredDoc { id: string; stateBase64: string; updatedAt: string | null }
export interface EngineOptions {
  relayUrl: string;
  sceneStore: SceneDocStore;
  boardStore: BoardDocStore;
  metaStore?: ProjectMetaDocStore;
  metaApplyTarget?: MetaApplyTarget;
  snapshotStore?: SnapshotStore;
  epochStore?: AppliedEpochStore;
  ensureProjectMetas?: () => Promise<void>;
  subscribeMetaSaves?: (
    cb: (projectId: string, epochs: AppliedEpochs) => void
  ) => () => void;
  subscribeSceneWrites?: (cb: (sceneId: string) => void) => () => void;
  readMasterKey: () => Promise<Uint8Array | null>;
  getDeviceId: () => Promise<string>;
  providerFactory: (relayUrl: string, roomId: string, deviceId: string) => SyncProvider;
  updateWordCount: (sceneId: string, wordCount: number) => Promise<void>;
  sweepMs?: number;
  saveDebounceMs?: number;
}

export class SyncEngine {
  private readonly options: EngineOptions;
  private provider: SyncProvider | null = null;
  private encKey: CryptoKey | null = null;
  private deviceId = "";
  private readonly statusEmitter = new StatusEmitter();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly liveScenes = new LiveSceneBindings();
  private readonly sceneUpdates: LiveSceneUpdateRouter;
  private pauseDepth = 0;
  private readonly epochs: EpochManager;
  private readonly replacements = new ReplacementQueue();
  private inbound: Promise<void> = Promise.resolve();
  private unsubscribeMetaSaves: (() => void) | null = null;
  private unsubscribeSceneWrites: (() => void) | null = null;
  private structureChanged: (() => void) | null = null;
  private docReplaced: ((sceneId: string) => void) | null = null;

  constructor(options: EngineOptions) {
    this.options = options;
    this.epochs = new EpochManager(options);
    this.sceneUpdates = new LiveSceneUpdateRouter(
      options, this.epochs, this.liveScenes, (sceneId) => this.docReplaced?.(sceneId),
    );
  }

  /** `relayUrlOverride` lets callers honor the `syncRelayUrl` tweak without
   *  rebuilding the engine (the default URL is fixed at construction). */
  async start(relayUrlOverride?: string): Promise<void> {
    if (this.provider) return;
    await this.options.ensureProjectMetas?.();
    const masterKey = await this.options.readMasterKey();
    if (!masterKey) { this.setStatus({ state: "off" }); return; }
    const [{ roomId, encKey }, deviceId] = await Promise.all([
      deriveKeys(masterKey), this.options.getDeviceId(),
    ]);
    this.encKey = encKey;
    this.deviceId = deviceId;
    await this.epochs.initialize(deviceId, this.options.metaStore);
    const relayUrl = relayUrlOverride?.trim() ? relayUrlOverride.trim() : this.options.relayUrl;
    const provider = this.options.providerFactory(relayUrl, roomId, deviceId);
    this.provider = provider;
    this.unsubscribeMetaSaves = this.options.subscribeMetaSaves?.(
      (projectId, epochs) => this.notifyLocalMetaSave(projectId, epochs)
    ) ?? null;
    this.unsubscribeSceneWrites = this.options.subscribeSceneWrites?.(
      (sceneId) => this.notifyLocalSave(sceneId)
    ) ?? null;
    provider.subscribeConnection((state) => this.onConnection(state));
    // Serialized, not fire-and-forget: frames must be APPLIED in arrival order.
    // A restore sends meta (carrying the new epoch) then the replacement scene;
    // run concurrently, the short scene path finishes first, accepts() rejects it
    // as a mismatched epoch, and the device waits out a whole sweep for a
    // replacement that already arrived.
    provider.subscribeFrames((blob) => { this.inbound = this.inbound.then(() => this.onBlob(blob)).catch(() => undefined); });
    provider.connect();
  }

  stop(): void {
    this.liveScenes.clear();
    this.provider?.destroy();
    this.provider = null;
    this.encKey = null;
    this.stopSweep();
    this.clearSaveTimers();
    // Drop the old session's inbound chain: a handler still pending from it would
    // otherwise serialize ahead of (or stall) every frame of the next session.
    this.inbound = Promise.resolve();
    this.unsubscribeMetaSaves?.();
    this.unsubscribeMetaSaves = null;
    this.unsubscribeSceneWrites?.();
    this.unsubscribeSceneWrites = null;
    this.setStatus({ state: "off", peerSeen: false });
  }

  subscribe(cb: (status: SyncStatus) => void): () => void { return this.statusEmitter.subscribe(cb); }

  onStructureChanged(callback: (() => void) | null): void { this.structureChanged = callback; }
  onDocReplaced(callback: ((sceneId: string) => void) | null): void { this.docReplaced = callback; }

  attachLiveDoc(sceneId: string, doc: Y.Doc): void {
    this.liveScenes.attachDoc(sceneId, doc, (update) => { void this.publishLiveUpdate(sceneId, update); });
  }

  detachLiveDoc(): void {
    this.liveScenes.detachDoc();
  }

  attachLiveScenePort(sceneId: string, port: EngineLiveScenePort): void {
    this.liveScenes.attachPort(sceneId, port);
  }

  detachLiveScenePort(port: EngineLiveScenePort): void {
    this.liveScenes.detachPort(port);
  }

  async publishLiveUpdate(sceneId: string, update: Uint8Array): Promise<void> {
    if (this.liveScenes.activeSceneId() !== sceneId || this.isPaused()) return;
    // Behind = a restore bumped this scene's epoch elsewhere and we have not
    // applied the replacement yet. Our content IS what the restore discarded,
    // so publishing it (even stamped at the new epoch, which the peer would
    // accept) resurrects it on the device that restored. Stay quiet until
    // handleBehindFrame swaps our copy.
    if (this.epochs.isBehind(sceneId)) return;
    const epoch = this.epochs.epoch(sceneId);
    await this.sendMessage({
      t: "live", c: sceneChannel(sceneId), u: fromUint8Array(update),
      ...(epoch > 0 ? { e: epoch } : {}),
    });
  }

  notifyLocalSave(sceneId: string): void {
    this.scheduleTargetedHello(sceneChannel(sceneId));
  }

  private notifyLocalMetaSave(projectId: string, epochs: AppliedEpochs): void {
    void this.epochs.recordLocal(epochs).then(async (advanced) => {
      if (advanced.length === 0) return;
      this.replacements.add(projectId, advanced);
      await this.flushReplacements();
    });
    this.scheduleTargetedHello(metaChannel(projectId));
  }

  /** Push queued restores. No-op while paused or offline — resume/reconnect retries. */
  private async flushReplacements(): Promise<void> {
    if (this.isPaused() || this.statusEmitter.current().state !== "connected") return;
    await this.replacements.flush({
      metaStore: this.options.metaStore,
    }, (frame) => this.sendMessage(frame));
  }

  private scheduleTargetedHello(channel: string): void {
    const existing = this.saveTimers.get(channel);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.saveTimers.delete(channel);
      if (!this.isPaused()) void this.sendTargetedHello(channel);
    }, this.options.saveDebounceMs ?? 2_000);
    this.saveTimers.set(channel, timer);
  }

  pause(): void {
    this.pauseDepth += 1;
    this.stopSweep();
  }

  resume(): void {
    if (this.pauseDepth === 0) return;
    this.pauseDepth -= 1;
    if (this.isPaused()) return;
    if (this.statusEmitter.current().state === "connected") {
      if (this.replacements.hasPending()) void this.flushReplacements();
      else void this.sendHello();
      this.startSweep();
    }
  }

  private onConnection(state: ConnectionState): void {
    this.setStatus({ state });
    if (state !== "connected") { this.stopSweep(); return; }
    if (this.isPaused()) return;
    if (this.replacements.hasPending()) void this.flushReplacements();
    else void this.sendHello();
    this.startSweep();
  }

  private async onBlob(blob: Uint8Array): Promise<void> {
    if (this.isPaused() || !this.encKey) return;
    const value = await openMessage(this.encKey, blob);
    if (!isInnerMessage(value) || this.isPaused()) return;
    await this.handleMessage(value);
  }

  private async handleMessage(message: InnerMessage): Promise<void> {
    if (message.t === "hello") {
      this.setStatus({ peerSeen: true });
      await this.answerHello(message);
      return;
    }
    await this.applyRemoteUpdate(message);
    this.setStatus({ lastSyncAt: new Date().toISOString() });
  }

  private async listDocs(): Promise<Array<StoredDoc & { channel: string }>> {
    const [scenes, boards, metas] = await Promise.all([
      this.options.sceneStore.listAll(), this.options.boardStore.listAll(),
      this.options.metaStore?.listAll() ?? Promise.resolve([]),
    ]);
    return [
      ...metas.map((doc) => ({ ...doc, channel: metaChannel(doc.id) })),
      ...scenes.map((doc) => ({ ...doc, channel: sceneChannel(doc.id) })),
      ...boards.map((doc) => ({ ...doc, channel: boardChannel(doc.id) })),
    ];
  }

  private async makeHello(docs?: Array<StoredDoc & { channel: string }>): Promise<HelloMessage> {
    const stored = docs ?? await this.listDocs();
    return { t: "hello", device: this.deviceId, docs: stored.map((d) => helloDoc(d, this.epochs)) };
  }

  private async sendHello(): Promise<void> {
    await this.sendMessage(await this.makeHello());
  }

  private async sendTargetedHello(channelName: string): Promise<void> {
    const channel = parseChannel(channelName);
    if (!channel) return;
    const store = channel.kind === "scene" ? this.options.sceneStore
      : channel.kind === "board" ? this.options.boardStore : this.options.metaStore;
    const doc = (await store?.listAll() ?? []).find((item) => item.id === channel.id);
    if (!doc) return;
    await this.sendMessage(await this.makeHello([{ ...doc, channel: channelName }]));
    // A hello only ADVERTISES a state vector, and answerHello replies with what the
    // PEER lacks — so a local change is never actually pushed by that exchange; it
    // waits for the peer's own 60s sweep to come asking (measured 63s desktop↔desktop
    // 2026-08-07). So deliver the content here too. targetedSaveFrame withholds the
    // open scene (the live channel already covers it) and any scene we owe a
    // replacement for. Echo-safe: remote applies never reach these notify paths —
    // meta goes through metaStore.save(), scenes through the engine's own merge.
    const frame = targetedSaveFrame(
      { ...doc, channel: channelName }, this.epochs, this.liveScenes.activeSceneId()
    );
    if (frame) await this.sendMessage(frame);
  }

  private async answerHello(hello: HelloMessage): Promise<void> {
    const peerVectors = new Map(hello.docs.map((doc) => [doc.c, doc.sv]));
    for (const doc of await this.listDocs()) {
      const frame = answerFrame(doc, peerVectors.get(doc.channel), this.epochs);
      if (frame) await this.sendMessage(frame);
    }
  }

  private async applyRemoteUpdate(message: Exclude<InnerMessage, HelloMessage>): Promise<void> {
    const channel = parseChannel(message.c);
    if (!channel) return;
    const update = toUint8Array(message.u);
    if (channel.kind === "meta") { await this.mergeMeta(channel.id, update); return; }
    if (channel.kind === "board") {
      await mergeStoredBoard(this.options.boardStore, channel.id, update); return;
    }
    await this.sceneUpdates.apply(channel.id, message, update);
  }

  private async mergeMeta(projectId: string, incoming: Uint8Array): Promise<void> {
    if (!this.options.metaStore) return;
    const stored = await this.options.metaStore.load(projectId);
    const merged = stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
    await this.options.metaStore.save(projectId, fromUint8Array(merged));
    // Learn the epochs in the SAME continuation as the save, before the SQL apply
    // below awaits. Otherwise a local structure edit landing in that window reads
    // the already-persisted remote bump, recordLocal() sees epoch > known and
    // misreads a REMOTE restore as a local one — marking it applied and pushing
    // our stale scene at the new epoch, which is the resurrection bug again.
    const newlyBehind = this.epochs.readMetaUpdate(merged);
    await Promise.all(newlyBehind.map((sceneId) => this.sendTargetedHello(sceneChannel(sceneId))));
    const doc = new Y.Doc();
    Y.applyUpdate(doc, merged);
    if (this.options.metaApplyTarget) await applyMetaDoc(projectId, doc, this.options.metaApplyTarget);
    this.structureChanged?.();
  }

  private async sendMessage(message: InnerMessage): Promise<void> {
    if (this.isPaused() || !this.encKey || this.statusEmitter.current().state !== "connected") return;
    const blob = await sealMessage(this.encKey, message);
    if (!this.isPaused()) this.provider?.send(blob);
  }

  private startSweep(): void {
    this.stopSweep();
    this.sweepTimer = setInterval(() => { void this.sendHello(); }, this.options.sweepMs ?? 60_000);
  }

  private stopSweep(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  private clearSaveTimers(): void {
    this.saveTimers.forEach((timer) => clearTimeout(timer));
    this.saveTimers.clear();
  }

  private isPaused(): boolean { return this.pauseDepth > 0; }

  private setStatus(patch: Partial<SyncStatus>): void { this.statusEmitter.patch(patch); }
}
