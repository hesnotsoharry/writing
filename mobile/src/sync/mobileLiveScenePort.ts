import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { EngineLiveScenePort, LiveSceneFlushResult, SyncEngine } from "../shared/engine";
import {
  type AckMessage, type BridgeAckType, type BridgeErrorCode,
  MOBILE_EDITOR_BRIDGE_VERSION, type NativeToWebViewMessage,
  parseWebViewMessage, serializeBridgeMessage, type UpdateMessage, type WebViewToNativeMessage,
} from "../shared/mobileEditorBridgeProtocol";
import type { SceneDocStore } from "../shared/sceneDocStore";
import { encodeDoc, extractPlainText } from "../shared/serialize";

export const MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS = 5_000;

export interface MobileLiveSceneTransport { postMessage(message: string): void }

export interface MobileLiveScenePortOptions { sceneId: string; transport: MobileLiveSceneTransport; ackTimeoutMs?: number }

export interface MobileLiveScenePort extends EngineLiveScenePort { start(): Promise<void>; receive(rawMessage: string): Promise<void>; notePotentialLocalChanges(): void; noteReplacementPending(): void; noteSceneRemoval(): void; close(): Promise<LiveSceneFlushResult>; replaceDurably(stateBase64: string, persist: () => Promise<void>): Promise<void> }

export class PendingMobileSceneChangesError extends Error { constructor() { super("The editor still has changes to save."); this.name = "PendingMobileSceneChangesError"; } }

type PortEngine = Pick<SyncEngine, "attachLiveScenePort" | "detachLiveScenePort" | "notifyLocalSave" | "publishLiveUpdate">;

export interface MobileLiveSceneDependencies {
  engine: PortEngine; sceneStore: SceneDocStore;
  updateWordCount(sceneId: string, count: number): Promise<void>;
}

type DeliveryResult = "acked" | "timed-out" | "unavailable";
type StateType = "hydrate" | "update" | "replace" | "flush";

interface StateItem {
  type: StateType; update?: string; completion: Promise<DeliveryResult>;
  resolve(result: DeliveryResult): void;
}

class SerializedQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(task: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  drain(): Promise<void> { return this.tail; }
}

class StateSender {
  private sessionId: string | null = null;
  private nextSeq = 1;
  private readonly queued: StateItem[] = [];
  private active: { item: StateItem; seq: number; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(
    private readonly sceneId: string,
    private readonly transport: MobileLiveSceneTransport,
    private readonly timeoutMs: number,
  ) {}

  setSession(sessionId: string): void {
    if (this.active) {
      clearTimeout(this.active.timer);
      this.active.item.resolve("unavailable");
      this.active = null;
    }
    this.queued.splice(0).forEach((item) => item.resolve("unavailable"));
    this.sessionId = sessionId;
    this.nextSeq = 1;
  }

  hasSession(): boolean { return this.sessionId !== null; }

  enqueue(type: StateType, update?: string): Promise<DeliveryResult> {
    const item = this.makeItem(type, update);
    this.queued.push(item);
    this.pump();
    return item.completion;
  }

  enqueueUpdate(update: Uint8Array): void {
    const encoded = encodeBytes(update);
    const last = this.queued.at(-1);
    if (last?.type === "update" && last.update) {
      last.update = encodeBytes(Y.mergeUpdates([toUint8Array(last.update), update]));
      return;
    }
    void this.enqueue("update", encoded);
  }

  enqueueReplace(stateBase64: string): Promise<DeliveryResult> {
    for (let index = this.queued.length - 1; index >= 0; index -= 1) {
      const item = this.queued[index];
      if (item?.type !== "update") continue;
      this.queued.splice(index, 1);
      item.resolve("unavailable");
    }
    return this.enqueue("replace", stateBase64);
  }

  handleAck(message: AckMessage): void {
    if (!this.active || message.seq !== this.active.seq) return;
    if (message.ackType !== this.active.item.type) return;
    this.finish("acked");
  }

  postControl(message: WebViewToNativeMessage): void {
    this.transport.postMessage(serializeBridgeMessage(message));
  }

  private makeItem(type: StateType, update?: string): StateItem {
    let resolve: (result: DeliveryResult) => void = () => undefined;
    const completion = new Promise<DeliveryResult>((done) => { resolve = done; });
    return { type, update, resolve, completion };
  }

  private pump(): void {
    if (this.active || this.queued.length === 0) return;
    const item = this.queued.shift();
    if (!item) return;
    if (!this.sessionId) { item.resolve("unavailable"); this.pump(); return; }
    const seq = this.nextSeq;
    this.nextSeq += 1;
    const timer = setTimeout(() => this.onTimeout(seq), this.timeoutMs);
    this.active = { item, seq, timer };
    try {
      this.postState(item, seq, this.sessionId);
    } catch {
      this.finish("unavailable");
    }
  }

  private postState(item: StateItem, seq: number, sessionId: string): void {
    const common = { v: MOBILE_EDITOR_BRIDGE_VERSION, sessionId, sceneId: this.sceneId, seq } as const;
    const message: NativeToWebViewMessage = item.type === "flush"
      ? { ...common, type: "flush" }
      : { ...common, type: item.type, update: item.update ?? "" };
    this.transport.postMessage(serializeBridgeMessage(message));
  }

  private onTimeout(seq: number): void {
    if (!this.active || this.active.seq !== seq) return;
    this.postError("ack-timeout", seq);
    this.finish("timed-out");
  }

  private postError(code: BridgeErrorCode, seq: number): void {
    if (!this.sessionId) return;
    try {
      this.postControl({
        v: MOBILE_EDITOR_BRIDGE_VERSION, type: "error", sessionId: this.sessionId,
        sceneId: this.sceneId, seq, code, recoverable: true,
      });
    } catch { /* A dead WebView cannot receive its own recovery notice. */ }
  }

  private finish(result: DeliveryResult): void {
    if (!this.active) return;
    clearTimeout(this.active.timer);
    const item = this.active.item;
    this.active = null;
    item.resolve(result);
    this.pump();
  }
}

class NativeMobileLiveScenePort implements MobileLiveScenePort {
  private readonly queue = new SerializedQueue();
  private readonly sender: StateSender;
  private sessionId: string | null = null;
  private nextWebSeq = 1;
  private readonly localResults = new Map<number, Promise<AckMessage | null>>();
  private hydrated = false; private unflushedLocal = false; private replacing = false;
  private flushInFlight: Promise<LiveSceneFlushResult> | null = null;

  constructor(
    private readonly options: MobileLiveScenePortOptions,
    private readonly dependencies: MobileLiveSceneDependencies,
  ) {
    this.sender = new StateSender(
      options.sceneId, options.transport,
      options.ackTimeoutMs ?? MOBILE_LIVE_SCENE_ACK_TIMEOUT_MS,
    );
  }

  async start(): Promise<void> {
    activeMobileScene = { sceneId: this.options.sceneId, port: this };
    this.dependencies.engine.attachLiveScenePort(this.options.sceneId, this);
  }

  async receive(rawMessage: string): Promise<void> {
    const message = parseWebViewMessage(rawMessage);
    if (!message) { this.postError("invalid-message"); return; }
    if (message.type === "ready") { await this.handleReady(message.sessionId); return; }
    if (!this.hasMatchingEnvelope(message)) return;
    if (message.type === "ack") { this.sender.handleAck(message); return; }
    if (message.type === "error") return;
    await this.handleLocalUpdate(message);
  }

  async applyRemoteUpdate(update: Uint8Array): Promise<void> {
    try {
      Y.applyUpdate(new Y.Doc(), update);
    } catch {
      this.postError("apply-failed");
      return;
    }
    try {
      await this.queue.run(async () => {
        await this.persistUpdate(update);
        this.sender.enqueueUpdate(update);
      });
    } catch { this.postError("persist-failed"); }
  }

  notePotentialLocalChanges(): void { if (this.hydrated && !this.replacing) this.unflushedLocal = true; }

  /** Epoch catch-up is about to replace this scene's stored doc (engine calls
   *  this from flushAndClose, before the replacement lands). Discard — but
   *  still ack — editor updates until the next hydrate, and restart the host
   *  through the same scene-replaced signal local restores use, so the WebView
   *  rehydrates from the replacement instead of keeping its stale doc. The
   *  restart always fires, so the gate can never dangle on a catch-up preview
   *  that ends without applying (audit P0.1). */
  noteReplacementPending(): void {
    this.replacing = true;
    notifySceneReplaced(this.options.sceneId);
  }

  /** The scene is being archived or deleted (audit P7.5): discard — but still
   *  ack — any further editor updates so a keystroke that arrives after the
   *  rows are deleted cannot re-create an orphan scene_docs row invisible to
   *  every list. No restart signal: the caller is removing the scene. */
  noteSceneRemoval(): void { this.replacing = true; }

  async flushLocal(): Promise<LiveSceneFlushResult> {
    if (this.flushInFlight) return this.flushInFlight;
    this.flushInFlight = this.performFlush();
    try { return await this.flushInFlight; } finally { this.flushInFlight = null; }
  }

  private async performFlush(): Promise<LiveSceneFlushResult> {
    if (!this.sender.hasSession()) return { status: "unavailable", pendingLocal: this.unflushedLocal };
    const wrapped = await this.queue.run(() => ({ completion: this.sender.enqueue("flush") }));
    const result = await wrapped.completion;
    if (result === "acked") { this.unflushedLocal = false; return { status: "flushed" }; }
    return { status: result, pendingLocal: this.unflushedLocal };
  }

  async replaceFromState(stateBase64: string): Promise<void> { await this.queue.run(() => { void this.sender.enqueueReplace(stateBase64); }); }

  async replaceDurably(stateBase64: string, persist: () => Promise<void>): Promise<void> { if (this.unflushedLocal) { const flush = await this.flushLocal(); if (flush.status !== "flushed" && flush.pendingLocal) throw new PendingMobileSceneChangesError(); } await this.deliverReplacement(stateBase64, persist); }

  async close(): Promise<LiveSceneFlushResult> {
    const result = await this.flushLocal();
    await this.queue.drain();
    if (result.status === "flushed" || !result.pendingLocal) {
      this.dependencies.engine.detachLiveScenePort(this); if (activeMobileScene?.port === this) activeMobileScene = null;
    }
    return result;
  }

  private async handleReady(sessionId: string): Promise<void> {
    if (this.sessionId === sessionId) return;
    this.sessionId = sessionId;
    this.hydrated = false;
    this.nextWebSeq = 1;
    this.localResults.clear();
    this.sender.setSession(sessionId);
    try {
      const result = await this.queue.run(async () => {
        const state = await this.dependencies.sceneStore.load(this.options.sceneId)
          ?? encodeDoc(new Y.Doc());
        return this.sender.enqueue("hydrate", state);
      });
      this.hydrated = await result === "acked";
      if (this.hydrated) { this.unflushedLocal = false; this.replacing = false; }
    } catch { this.postError("persist-failed"); }
  }

  private async deliverReplacement(stateBase64: string, persist: () => Promise<void>): Promise<void> { this.replacing = true; await this.queue.run(async () => { await persist(); void this.sender.enqueueReplace(stateBase64); }); }

  private hasMatchingEnvelope(message: Exclude<WebViewToNativeMessage, { type: "ready" }>): boolean {
    if (message.sessionId !== this.sessionId) { this.postError("session-mismatch", message.seq); return false; }
    if (message.sceneId !== this.options.sceneId) { this.postError("scene-mismatch", message.seq); return false; }
    return true;
  }

  private async handleLocalUpdate(message: UpdateMessage): Promise<void> {
    if (message.seq > this.nextWebSeq) { this.postError("sequence-gap", message.seq); return; }
    const prior = this.localResults.get(message.seq);
    if (message.seq < this.nextWebSeq) { if (prior) await this.repeatResult(prior); return; }
    this.nextWebSeq += 1;
    if (this.replacing) { const discarded = Promise.resolve(this.makeAck(message.seq, "update")); this.localResults.set(message.seq, discarded); await this.repeatResult(discarded); return; }
    this.unflushedLocal = true;
    const result = this.queue.run(() => this.persistAndPublish(message));
    this.localResults.set(message.seq, result);
    const ack = await result;
    if (ack) this.post(ack);
  }

  private async persistAndPublish(message: UpdateMessage): Promise<AckMessage | null> {
    let update: Uint8Array;
    try {
      update = toUint8Array(message.update);
      Y.applyUpdate(new Y.Doc(), update);
    } catch {
      this.postError("apply-failed", message.seq);
      return null;
    }
    try {
      await this.persistUpdate(update);
      await this.dependencies.engine.publishLiveUpdate(this.options.sceneId, update);
      this.dependencies.engine.notifyLocalSave(this.options.sceneId);
      return this.makeAck(message.seq, "update");
    } catch {
      this.postError("persist-failed", message.seq);
      return null;
    }
  }

  private async persistUpdate(update: Uint8Array): Promise<void> {
    const doc = new Y.Doc();
    const stored = await this.dependencies.sceneStore.load(this.options.sceneId);
    if (stored) Y.applyUpdate(doc, toUint8Array(stored));
    Y.applyUpdate(doc, update);
    const plaintext = extractPlainText(doc);
    await this.dependencies.sceneStore.save(
      this.options.sceneId, encodeDoc(doc), plaintext || null,
    );
    await this.dependencies.updateWordCount(this.options.sceneId, countWords(plaintext));
  }

  private async repeatResult(result: Promise<AckMessage | null>): Promise<void> {
    const ack = await result;
    if (ack) this.post(ack);
  }

  private makeAck(seq: number, ackType: BridgeAckType): AckMessage {
    return {
      v: MOBILE_EDITOR_BRIDGE_VERSION, type: "ack", sessionId: this.sessionId ?? "unavailable",
      sceneId: this.options.sceneId, seq, ackType,
    };
  }

  private postError(code: BridgeErrorCode, seq?: number): void {
    this.post({
      v: MOBILE_EDITOR_BRIDGE_VERSION, type: "error",
      sessionId: this.sessionId ?? "unavailable", sceneId: this.options.sceneId,
      ...(seq === undefined ? {} : { seq }), code, recoverable: true,
    });
  }

  private post(message: WebViewToNativeMessage): void {
    try { this.sender.postControl(message); } catch { /* WebView unavailable. */ }
  }
}

function encodeBytes(update: Uint8Array): string { return fromUint8Array(update); }

function countWords(text: string): number { return text.trim().split(/\s+/).filter(Boolean).length; }

export function createMobileLiveScenePort(options: MobileLiveScenePortOptions, dependencies: MobileLiveSceneDependencies): MobileLiveScenePort { return new NativeMobileLiveScenePort(options, dependencies); }

let activeMobileScene: { sceneId: string; port: MobileLiveScenePort } | null = null;

const replacementListeners = new Set<(sceneId: string) => void>();

function notifySceneReplaced(sceneId: string): void { replacementListeners.forEach((listener) => listener(sceneId)); }

export function subscribeMobileSceneReplaced(listener: (sceneId: string) => void): () => void { replacementListeners.add(listener); return () => replacementListeners.delete(listener); }

/** A REMOTE epoch replacement (catch-up) swapped this scene's stored doc.
 *  Fires the same scene-replaced signal local restores use, so an open editor
 *  restarts and rehydrates from the replacement (audit P0.1). */
export function notifyMobileSceneReplacedRemotely(sceneId: string): void { notifySceneReplaced(sceneId); }

/** Archive/delete pre-flight (audit P7.5): when sceneId is the active live
 *  editor scene, drain the WebView's pending updates into the store (so the
 *  archive manifest sees the latest keystrokes) and gate the port so anything
 *  later is discarded-but-acked instead of resurrecting deleted rows. */
export async function closeActiveMobileSceneForRemoval(sceneId: string): Promise<void> {
  const active = activeMobileScene;
  if (!active || active.sceneId !== sceneId) return;
  try { await active.port.flushLocal(); } catch { /* store remains the boundary */ }
  active.port.noteSceneRemoval();
}

export async function replaceActiveMobileSceneDurably(sceneId: string, stateBase64: string, persist: () => Promise<void>): Promise<void> { const active = activeMobileScene; if (!active || active.sceneId !== sceneId) await persist(); else await active.port.replaceDurably(stateBase64, persist); notifySceneReplaced(sceneId); }
