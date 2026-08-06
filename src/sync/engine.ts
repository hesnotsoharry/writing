import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { BoardDocStore } from "../db/boardDocStore";
import { getOrCreateDeviceId } from "../db/deviceId";
import type { SceneDocStore } from "../db/sceneDocStore";
import { getDb } from "../db/schema";
import { SqliteBoardDocStore } from "../db/sqliteBoardDocStore";
import { SqliteSceneDocStore } from "../db/sqliteSceneDocStore";
import { SYNC_ORIGIN } from "../yjs/bindPersistence";
import { extractPlainText } from "../yjs/serialize";
import { openMessage, sealMessage } from "./frameCodec";
import { deriveKeys } from "./keys";
import { getSyncMasterKey } from "./keyStorage";
import {
  boardChannel, type HelloDoc, type HelloMessage, type InnerMessage,
  isInnerMessage, parseChannel, sceneChannel,
} from "./messages";
import { type ConnectionState, RelayProvider } from "./provider";

export type SyncState = "off" | ConnectionState;
export interface SyncStatus { state: SyncState; peerSeen: boolean; lastSyncAt: string | null }
export interface SyncProvider {
  connect(): void;
  destroy(): void;
  send(blob: Uint8Array): void;
  subscribeConnection(cb: (state: ConnectionState) => void): () => void;
  subscribeFrames(cb: (blob: Uint8Array) => void): () => void;
}

interface StoredDoc { id: string; stateBase64: string; updatedAt: string | null }
interface EngineOptions {
  relayUrl: string;
  sceneStore: SceneDocStore;
  boardStore: BoardDocStore;
  readMasterKey: () => Promise<Uint8Array | null>;
  getDeviceId: () => Promise<string>;
  providerFactory: (relayUrl: string, roomId: string, deviceId: string) => SyncProvider;
  updateWordCount: (sceneId: string, wordCount: number) => Promise<void>;
  sweepMs?: number;
  saveDebounceMs?: number;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

async function updateSceneWordCount(sceneId: string, count: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE scenes SET word_count = $1 WHERE id = $2", [count, sceneId]);
}

function defaultOptions(): EngineOptions {
  const relayUrl = (import.meta.env.VITE_SYNC_RELAY_URL as string | undefined)
    ?? "wss://sync.writersnook.app";
  return {
    relayUrl,
    sceneStore: new SqliteSceneDocStore(), boardStore: new SqliteBoardDocStore(),
    readMasterKey: getSyncMasterKey, getDeviceId: getOrCreateDeviceId,
    providerFactory: (url, room, device) => new RelayProvider(url, room, device),
    updateWordCount: updateSceneWordCount,
  };
}

export class SyncEngine {
  private readonly options: EngineOptions;
  private provider: SyncProvider | null = null;
  private encKey: CryptoKey | null = null;
  private deviceId = "";
  private status: SyncStatus = { state: "off", peerSeen: false, lastSyncAt: null };
  private readonly listeners = new Set<(status: SyncStatus) => void>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private openScene: { id: string; doc: Y.Doc; listener: (u: Uint8Array, o: unknown) => void } | null = null;
  private pauseDepth = 0;

  constructor(options: EngineOptions = defaultOptions()) {
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.provider) return;
    const masterKey = await this.options.readMasterKey();
    if (!masterKey) { this.setStatus({ state: "off" }); return; }
    const [{ roomId, encKey }, deviceId] = await Promise.all([
      deriveKeys(masterKey), this.options.getDeviceId(),
    ]);
    this.encKey = encKey;
    this.deviceId = deviceId;
    const provider = this.options.providerFactory(this.options.relayUrl, roomId, deviceId);
    this.provider = provider;
    provider.subscribeConnection((state) => this.onConnection(state));
    provider.subscribeFrames((blob) => { void this.onBlob(blob).catch(() => undefined); });
    provider.connect();
  }

  stop(): void {
    this.detachLiveDoc();
    this.provider?.destroy();
    this.provider = null;
    this.encKey = null;
    this.stopSweep();
    this.clearSaveTimers();
    this.setStatus({ state: "off", peerSeen: false });
  }

  subscribe(cb: (status: SyncStatus) => void): () => void {
    this.listeners.add(cb);
    cb({ ...this.status });
    return () => this.listeners.delete(cb);
  }

  attachLiveDoc(sceneId: string, doc: Y.Doc): void {
    this.detachLiveDoc();
    const listener = (update: Uint8Array, origin: unknown) => {
      if (origin === SYNC_ORIGIN || this.isPaused()) return;
      void this.sendMessage({ t: "live", c: sceneChannel(sceneId), u: fromUint8Array(update) });
    };
    doc.on("update", listener);
    this.openScene = { id: sceneId, doc, listener };
  }

  detachLiveDoc(): void {
    if (!this.openScene) return;
    this.openScene.doc.off("update", this.openScene.listener);
    this.openScene = null;
  }

  notifyLocalSave(sceneId: string): void {
    const existing = this.saveTimers.get(sceneId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.saveTimers.delete(sceneId);
      if (!this.isPaused()) void this.sendTargetedHello(sceneId);
    }, this.options.saveDebounceMs ?? 2_000);
    this.saveTimers.set(sceneId, timer);
  }

  pause(): void {
    this.pauseDepth += 1;
    this.stopSweep();
  }

  resume(): void {
    if (this.pauseDepth === 0) return;
    this.pauseDepth -= 1;
    if (this.isPaused()) return;
    if (this.status.state === "connected") {
      void this.sendHello();
      this.startSweep();
    }
  }

  private onConnection(state: ConnectionState): void {
    this.setStatus({ state });
    if (state !== "connected") { this.stopSweep(); return; }
    if (this.isPaused()) return;
    void this.sendHello();
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
    await this.applyRemoteUpdate(message.c, toUint8Array(message.u));
    this.setStatus({ lastSyncAt: new Date().toISOString() });
  }

  private async listDocs(): Promise<Array<StoredDoc & { channel: string }>> {
    const [scenes, boards] = await Promise.all([
      this.options.sceneStore.listAll(), this.options.boardStore.listAll(),
    ]);
    return [
      ...scenes.map((doc) => ({ ...doc, channel: sceneChannel(doc.id) })),
      ...boards.map((doc) => ({ ...doc, channel: boardChannel(doc.id) })),
    ];
  }

  private async makeHello(docs?: Array<StoredDoc & { channel: string }>): Promise<HelloMessage> {
    const stored = docs ?? await this.listDocs();
    const helloDocs: HelloDoc[] = stored.map((doc) => ({
      c: doc.channel,
      sv: fromUint8Array(Y.encodeStateVectorFromUpdate(toUint8Array(doc.stateBase64))),
      at: doc.updatedAt,
    }));
    return { t: "hello", device: this.deviceId, docs: helloDocs };
  }

  private async sendHello(): Promise<void> {
    await this.sendMessage(await this.makeHello());
  }

  private async sendTargetedHello(sceneId: string): Promise<void> {
    const doc = (await this.options.sceneStore.listAll()).find((item) => item.id === sceneId);
    if (!doc) return;
    await this.sendMessage(await this.makeHello([{ ...doc, channel: sceneChannel(sceneId) }]));
  }

  private async answerHello(hello: HelloMessage): Promise<void> {
    const peerVectors = new Map(hello.docs.map((doc) => [doc.c, doc.sv]));
    for (const doc of await this.listDocs()) {
      const state = toUint8Array(doc.stateBase64);
      const peerVector = peerVectors.get(doc.channel);
      const update = peerVector ? Y.diffUpdate(state, toUint8Array(peerVector)) : state;
      if (!peerVector || update.length > 2) {
        await this.sendMessage({ t: "diff", c: doc.channel, u: fromUint8Array(update) });
      }
    }
  }

  private async applyRemoteUpdate(channelName: string, update: Uint8Array): Promise<void> {
    const channel = parseChannel(channelName);
    if (!channel) return;
    if (channel.kind === "scene" && this.openScene?.id === channel.id) {
      Y.applyUpdate(this.openScene.doc, update, SYNC_ORIGIN);
      return;
    }
    if (channel.kind === "board") await this.mergeBoard(channel.id, update);
    else await this.mergeScene(channel.id, update);
  }

  private async mergeBoard(id: string, incoming: Uint8Array): Promise<void> {
    const stored = await this.options.boardStore.load(id);
    const merged = stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
    await this.options.boardStore.save(id, fromUint8Array(merged));
  }

  private async mergeScene(id: string, incoming: Uint8Array): Promise<void> {
    const stored = await this.options.sceneStore.load(id);
    const merged = stored ? Y.mergeUpdates([toUint8Array(stored), incoming]) : incoming;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, merged);
    const plaintext = extractPlainText(doc);
    await this.options.sceneStore.save(id, fromUint8Array(merged), plaintext || null);
    await this.options.updateWordCount(id, wordCount(plaintext));
  }

  private async sendMessage(message: InnerMessage): Promise<void> {
    if (this.isPaused() || !this.encKey || this.status.state !== "connected") return;
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

  private setStatus(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((listener) => listener({ ...this.status }));
  }
}

export const syncEngine = new SyncEngine();
