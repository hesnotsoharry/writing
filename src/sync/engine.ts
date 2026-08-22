import { fromUint8Array } from "js-base64";
import * as Y from "yjs";

import type { AppliedEpochs } from "../db/syncEpochStore";
import { CatchUpCoordinator,type CatchUpResult } from "./catchUpCoordinator";
import {
  type CredentialAckHandler, CredentialExchange, type CredentialOfferHandler,
  type ManagedCredentialState,
} from "./credentialExchange";
import { DeviceRosterTracker } from "./deviceRoster";
import { ControlRouter } from "./engineControlRouter";
import { type ChannelDoc,EngineDocRepository } from "./engineDocRepository";
import { publishBibleSave, sendEligibleOutboxMessage } from "./engineOutbound";
import { prepareSession } from "./engineSession";
import type { EngineOptions, SyncProvider } from "./engineTypes";
import { answerFrame, helloDoc, targetedSaveFrame } from "./epochFrames";
import { EpochManager, type SnapshotRef } from "./epochManager";
import { openMessage, sealMessage } from "./frameCodec";
import { type EngineLiveScenePort, LiveSceneBindings } from "./liveSceneBindings";
import { LiveSceneUpdateRouter } from "./liveSceneUpdateRouter";
import { LocalContentSubscriptions } from "./localContentSubscriptions";
import { type LocalRowMutation, LwwPublisher } from "./lww/publisher";
import { LwwReconciler } from "./lww/reconciler";
import { LwwDomainRegistry } from "./lww/registry";
import { type HelloMessage, type InnerMessage, isInnerMessage, metaChannel, parseChannel, sceneChannel } from "./messages";
import { DurableOutbox } from "./outbox";
import type { ConnectionState } from "./provider";
import { RemoteUpdateRouter } from "./remoteUpdateRouter";
import {
  type BehindScene, StatusEmitter, type SyncQueueDepth, type SyncStatus,
} from "./statusEmitter";

export type { EngineOptions, SyncProvider } from "./engineTypes";
export type { EngineLiveScenePort, LiveSceneFlushResult } from "./liveSceneBindings";
export type { BehindScene, SyncQueueDepth, SyncState, SyncStatus } from "./statusEmitter";
import { ReplacementQueue } from "./replacementQueue";

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
  private readonly docs: EngineDocRepository;
  private pauseDepth = 0;
  private readonly epochs: EpochManager;
  private readonly replacements = new ReplacementQueue();
  private readonly outbox: DurableOutbox | null;
  private readonly lww: LwwReconciler | null;
  private readonly lwwRegistry: LwwDomainRegistry;
  private readonly rowPublisher: LwwPublisher | null;
  private readonly catchUp: CatchUpCoordinator;
  private readonly remoteUpdates: RemoteUpdateRouter;
  private inbound: Promise<void> = Promise.resolve();
  private readonly localContent: LocalContentSubscriptions;
  private unsubscribeOutbox: (() => void) | null = null;
  private structureChanged: (() => void) | null = null;
  private docReplaced: ((sceneId: string) => void) | null = null;
  private readonly credentials: CredentialExchange;
  private readonly devices: DeviceRosterTracker;
  private readonly control: ControlRouter;

  constructor(options: EngineOptions) {
    this.options = options;
    this.devices = new DeviceRosterTracker(options.deviceRoster ?? {});
    this.credentials = new CredentialExchange((message) => this.sendMessage(message),
      () => !this.isPaused() && this.statusEmitter.current().state === "connected");
    this.docs = new EngineDocRepository(options);
    this.epochs = new EpochManager(options);
    this.outbox = options.outboxStore ? new DurableOutbox(options.outboxStore) : null;
    const registry = options.lwwRegistry ?? new LwwDomainRegistry();
    this.lwwRegistry = registry;
    this.rowPublisher = options.lwwStore && this.outbox
      ? new LwwPublisher({ store: options.lwwStore, registry, outbox: this.outbox,
        send: (message) => this.sendMessage(message), deviceId: () => this.deviceId }) : null;
    this.lww = options.lwwStore
      ? new LwwReconciler(options.lwwStore, registry,
        (message) => this.sendMessage(message),
        { onConverged: (domain, rowId) => this.outbox?.acknowledgeItem(domain, rowId)
          ?? Promise.resolve(), onObserved: (hlc) => this.rowPublisher?.observe(hlc) })
      : null;
    this.catchUp = new CatchUpCoordinator(
      this.epochs, this.liveScenes, this.outbox, (sceneId) => this.docReplaced?.(sceneId),
    );
    this.sceneUpdates = new LiveSceneUpdateRouter(
      options, this.epochs, this.liveScenes, (sceneId) => this.docReplaced?.(sceneId),
    );
    this.remoteUpdates = new RemoteUpdateRouter({
      options, epochs: this.epochs, docs: this.docs, scenes: this.sceneUpdates,
      requestScene: (channel) => this.sendTargetedHello(channel),
      notifyStructure: () => this.structureChanged?.(),
    });
    this.localContent = new LocalContentSubscriptions(
      options,
      (projectId, epochs) => this.notifyLocalMetaSave(projectId, epochs),
      (projectId, stateBase64) => void publishBibleSave(this.outbox, (message) => this.sendMessage(message), projectId, stateBase64),
      (sceneId) => this.notifyLocalSave(sceneId),
    );
    this.control = new ControlRouter({ devices: this.devices, credentials: this.credentials, options,
      lww: () => this.lww, outbox: () => this.outbox, send: (m) => this.sendMessage(m),
      answerHello: (h) => this.answerHello(h), patchStatus: (p) => this.setStatus(p) });
  }

  /** `relayUrlOverride` lets callers honor the `syncRelayUrl` tweak without
   *  rebuilding the engine (the default URL is fixed at construction). */
  async start(relayUrlOverride?: string): Promise<void> {
    if (this.provider) return;
    const session = await prepareSession(this.options, this.epochs, this.outbox, relayUrlOverride);
    if (!session) { this.setStatus({ state: "off" }); return; }
    this.encKey = session.encKey;
    this.deviceId = session.deviceId;
    this.setStatus({ lastPeerSeenAt: session.lastPeerSeenAt,
      queue: session.queue, behind: this.epochs.listBehind() });
    this.setStatus({ devices: await this.devices.load(session.deviceId, new Date().toISOString()) });
    this.unsubscribeOutbox = this.outbox?.subscribe((queue) => this.setStatus({ queue })) ?? null;
    const provider = session.provider;
    this.provider = provider;
    this.localContent.start();
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
    this.lww?.reset();
    this.localContent.stop();
    this.unsubscribeOutbox?.(); this.unsubscribeOutbox = null;
    this.setStatus({ state: "off", peerSeen: false });
  }

  /** Clears one entry from the local device list. Local bookkeeping only — a
   *  device still holding the master key rejoins the room and reappears. */
  async forgetDevice(id: string): Promise<void> { this.setStatus({ devices: await this.devices.forget(id) }); }
  subscribe(cb: (status: SyncStatus) => void): () => void { return this.statusEmitter.subscribe(cb); }
  status(): SyncStatus { return this.statusEmitter.current(); }
  listBehind(): readonly BehindScene[] { return this.epochs.listBehind(); }
  subscribeQueue(listener: (queue: SyncQueueDepth) => void): () => void { return this.outbox?.subscribe(listener) ?? (() => undefined); }
  async syncNow(): Promise<void> {
    if (this.isPaused() || this.statusEmitter.current().state !== "connected") return;
    await this.outbox?.flush((message) => sendEligibleOutboxMessage(message, this.lwwRegistry, (eligible) => this.sendMessage(eligible)));
    await this.sendHello();
    await this.lww?.sendAllSummaries();
  }
  async publishRow(mutation: LocalRowMutation): Promise<boolean> {
    if (!this.rowPublisher) return false;
    if (!this.deviceId) this.deviceId = await this.options.getDeviceId(); return this.rowPublisher.publish(mutation);
  }
  async prepareCatchUp(sceneIds?: readonly string[]): Promise<{ snapshots: SnapshotRef[] }> {
    return this.catchUp.prepare(sceneIds);
  }
  async catchUpNow(sceneIds?: readonly string[]): Promise<CatchUpResult> {
    const result = await this.catchUp.apply(sceneIds);
    this.setStatus({ behind: this.epochs.listBehind() });
    return result;
  }

  onStructureChanged(callback: (() => void) | null): void { this.structureChanged = callback; }
  onDocReplaced(callback: ((sceneId: string) => void) | null): void { this.docReplaced = callback; }
  onCredentialOffer(callback: CredentialOfferHandler | null): void { this.credentials.onOffer(callback); }
  onCredentialAck(callback: CredentialAckHandler | null): void { this.credentials.onAck(callback); }

  async sendCredentialOffer(managed: ManagedCredentialState, id = crypto.randomUUID()): Promise<string | null> { return this.credentials.sendOffer(managed, id); }

  attachLiveDoc(sceneId: string, doc: Y.Doc): void { this.liveScenes.attachDoc(sceneId, doc, (update) => { void this.publishLiveUpdate(sceneId, update); }); }
  detachLiveDoc(): void { this.liveScenes.detachDoc(); }
  attachLiveScenePort(sceneId: string, port: EngineLiveScenePort): void { this.liveScenes.attachPort(sceneId, port); }
  detachLiveScenePort(port: EngineLiveScenePort): void { this.liveScenes.detachPort(port); }

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
    // Per-connection reconciler state cannot outlive the connection it describes.
    if (state !== "connected") { this.lww?.reset(); this.stopSweep(); return; }
    if (this.isPaused()) return;
    void this.syncNow().then(() => {
      if (this.replacements.hasPending()) return this.flushReplacements();
      return undefined;
    });
    this.startSweep();
  }

  private async onBlob(blob: Uint8Array): Promise<void> {
    if (this.isPaused() || !this.encKey) return;
    const value = await openMessage(this.encKey, blob);
    if (!isInnerMessage(value) || this.isPaused()) return;
    await this.handleMessage(value);
  }

  private async handleMessage(message: InnerMessage): Promise<void> {
    if (await this.control.handle(message)) return;
    if (message.t !== "diff" && message.t !== "live") return;
    await this.remoteUpdates.apply(message);
    this.setStatus({ lastSyncAt: new Date().toISOString(), behind: this.epochs.listBehind() });
  }

  private async makeHello(docs?: ChannelDoc[]): Promise<HelloMessage> {
    const stored = docs ?? await this.docs.listAll();
    return { t: "hello", device: this.deviceId,
      capabilities: ["domain-docs", "row-lww", "manual-epochs", "managed-credential-schema"],
      ...this.devices.helloFields(),
      docs: stored.map((d) => helloDoc(d, this.epochs)) };
  }

  private async sendHello(): Promise<void> {
    await this.sendMessage(await this.makeHello());
  }

  private async sendTargetedHello(channelName: string): Promise<void> {
    const channel = parseChannel(channelName);
    if (!channel) return;
    const docs = await this.docs.forChannel(channel);
    const doc = docs.find((item) => item.id === channel.id);
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
    const durableFrame = targetedSaveFrame({ ...doc, channel: channelName }, this.epochs, null);
    if (durableFrame) {
      await this.outbox?.enqueue({ domain: channel.kind, projectId: null,
        itemId: channel.id, kind: "doc", message: durableFrame });
    }
    if (frame) await this.sendMessage(frame);
  }

  private async answerHello(hello: HelloMessage): Promise<void> {
    const peerVectors = new Map(hello.docs.map((doc) => [doc.c, doc.sv]));
    for (const doc of await this.docs.listAll()) {
      const frame = answerFrame(doc, peerVectors.get(doc.channel), this.epochs);
      if (frame) await this.sendMessage(frame);
      else await this.acknowledgeDoc(doc.channel);
    }
  }

    // Learn the epochs in the SAME continuation as the save, before the SQL apply
    // below awaits. Otherwise a local structure edit landing in that window reads
    // the already-persisted remote bump, recordLocal() sees epoch > known and
    // misreads a REMOTE restore as a local one — marking it applied and pushing
    // our stale scene at the new epoch, which is the resurrection bug again.
  private async acknowledgeDoc(channelName: string): Promise<void> {
    const channel = parseChannel(channelName);
    if (channel) await this.outbox?.acknowledgeItem(channel.kind, channel.id);
  }

  private async sendMessage(message: InnerMessage): Promise<void> {
    if (this.isPaused() || !this.encKey || this.statusEmitter.current().state !== "connected") return;
    const blob = await sealMessage(this.encKey, message);
    if (!this.isPaused()) this.provider?.send(blob);
  }

  private startSweep(): void {
    this.stopSweep();
    // A full reconcile, not just a hello. Sending only hello made the sweep half
    // a sync: the doc path self-healed on it while the row path did not, so row
    // summaries went out ONLY on our own connect. A peer that joined a room we
    // were already connected to therefore never heard a single row summary --
    // it received every document and none of the records. Measured on a cold
    // pair: four projects and seven scenes arrived, `boards` stayed empty.
    this.sweepTimer = setInterval(() => { void this.syncNow(); }, this.options.sweepMs ?? 60_000);
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
