import {
  type AckMessage,
  type BridgeAckType,
  type BridgeErrorCode,
  MOBILE_EDITOR_BRIDGE_VERSION,
  type NativeToWebViewMessage,
  parseNativeMessage,
  serializeBridgeMessage,
  type WebViewToNativeMessage,
} from "@writersnook/sync/mobileEditorBridgeProtocol";
import { SYNC_ORIGIN } from "@writersnook/yjs/bindPersistence";
import * as Y from "yjs";

import {
  type EditorSelectionState, type NativeEditorUiMessage, parseNativeEditorUiMessage,
} from "../../src/features/editor/editorUiProtocol";
import { WebEditorUiChannel } from "./webEditorUiChannel";

export const LOCAL_UPDATE_BATCH_MS = 500;
export const BRIDGE_ACK_TIMEOUT_MS = 5_000;

export interface BridgeSnapshot {
  doc: Y.Doc;
  editorKey: number;
  hydrated: boolean;
}

export interface BridgeClient {
  getSnapshot: () => BridgeSnapshot;
  getSessionId: () => string;
  subscribe: (listener: () => void) => () => void;
  bindEditorUi: (handler: (message: NativeEditorUiMessage) => void) => () => void;
  reportSelection: (selection: EditorSelectionState) => void;
  receive: (raw: string) => void;
  destroy: () => void;
}

interface BridgeClientOptions {
  batchMs?: number;
  ackTimeoutMs?: number;
  sessionId?: string;
  postMessage?: (message: string) => void;
}

type NativeStateMessage = Exclude<
  NativeToWebViewMessage,
  { type: "ack" } | { type: "error" }
>;

function createSessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeUpdate(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeUpdate(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function defaultPostMessage(message: string): void {
  window.ReactNativeWebView?.postMessage(message);
}

class WebViewBridgeClient implements BridgeClient {
  private readonly sessionId: string;
  private readonly postRaw: (message: string) => void;
  private readonly batchMs: number;
  private readonly ackTimeoutMs: number;
  private readonly listeners = new Set<() => void>();
  private readonly priorAcks = new Map<number, AckMessage>();
  private snapshot: BridgeSnapshot = { doc: new Y.Doc(), editorKey: 0, hydrated: false };
  private sceneId: string | null = null;
  private nextNativeSeq = 1;
  private nextWebSeq = 1;
  private pendingUpdate: Uint8Array | null = null;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightSeq: number | null = null;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFlushSeq: number | null = null;
  private readonly uiChannel: WebEditorUiChannel;

  constructor(options: BridgeClientOptions) {
    this.sessionId = options.sessionId ?? createSessionId();
    this.postRaw = options.postMessage ?? defaultPostMessage;
    this.batchMs = options.batchMs ?? LOCAL_UPDATE_BATCH_MS;
    this.ackTimeoutMs = options.ackTimeoutMs ?? BRIDGE_ACK_TIMEOUT_MS;
    this.uiChannel = new WebEditorUiChannel(this.sessionId, this.postRaw);
    window.addEventListener("message", this.onWindowMessage);
    document.addEventListener("message", this.onDocumentMessage);
    this.post({ v: MOBILE_EDITOR_BRIDGE_VERSION, type: "ready", sessionId: this.sessionId });
  }

  getSnapshot = (): BridgeSnapshot => this.snapshot;

  getSessionId = (): string => this.sessionId;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  bindEditorUi = (handler: (message: NativeEditorUiMessage) => void): (() => void) => {
    return this.uiChannel.bind(handler);
  };

  reportSelection = (selection: EditorSelectionState): void => {
    this.uiChannel.report(selection);
  };

  receive = (raw: string): void => {
    const uiMessage = parseNativeEditorUiMessage(raw);
    if (uiMessage) {
      this.uiChannel.receive(uiMessage);
      return;
    }
    const message = parseNativeMessage(raw);
    if (!message) {
      this.postError("invalid-message");
      return;
    }
    if (message.sessionId !== this.sessionId) {
      this.postError("session-mismatch", "seq" in message ? message.seq : undefined);
      return;
    }
    if (message.type === "ack") {
      this.handleWebUpdateAck(message);
      return;
    }
    if (message.type === "error") return;
    if (!this.validateStateMessage(message)) return;
    if (message.type === "hydrate") this.handleHydrate(message);
    else this.handleStateMessage(message);
  };

  destroy = (): void => {
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.clearAckTimer();
    window.removeEventListener("message", this.onWindowMessage);
    document.removeEventListener("message", this.onDocumentMessage);
    this.snapshot.doc.off("update", this.onLocalUpdate);
    this.snapshot.doc.destroy();
    this.uiChannel.destroy();
    this.listeners.clear();
  };

  private post(message: WebViewToNativeMessage): void {
    this.postRaw(serializeBridgeMessage(message));
  }


  private postError(code: BridgeErrorCode, seq?: number): void {
    this.post({
      v: MOBILE_EDITOR_BRIDGE_VERSION,
      type: "error",
      sessionId: this.sessionId,
      ...(this.sceneId ? { sceneId: this.sceneId } : {}),
      ...(seq === undefined ? {} : { seq }),
      code,
      recoverable: true,
    });
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private clearAckTimer(): void {
    if (this.ackTimer) clearTimeout(this.ackTimer);
    this.ackTimer = null;
  }

  private startAckTimer(seq: number): void {
    this.clearAckTimer();
    this.ackTimer = setTimeout(() => this.postError("ack-timeout", seq), this.ackTimeoutMs);
  }

  private sendAck(seq: number, ackType: BridgeAckType): void {
    if (!this.sceneId) return;
    const ack: AckMessage = {
      v: MOBILE_EDITOR_BRIDGE_VERSION,
      type: "ack",
      sessionId: this.sessionId,
      sceneId: this.sceneId,
      seq,
      ackType,
    };
    this.priorAcks.set(seq, ack);
    this.post(ack);
  }

  private completeFlushIfDrained(): void {
    if (this.pendingFlushSeq === null) return;
    if (this.pendingUpdate || this.inFlightSeq !== null || this.batchTimer) return;
    const seq = this.pendingFlushSeq;
    this.pendingFlushSeq = null;
    this.sendAck(seq, "flush");
  }

  private sendPendingUpdate(): void {
    if (!this.pendingUpdate || this.inFlightSeq !== null || !this.sceneId) return;
    const update = this.pendingUpdate;
    this.pendingUpdate = null;
    const seq = this.nextWebSeq;
    this.nextWebSeq += 1;
    this.inFlightSeq = seq;
    this.post({
      v: MOBILE_EDITOR_BRIDGE_VERSION,
      type: "update",
      sessionId: this.sessionId,
      sceneId: this.sceneId,
      seq,
      update: encodeUpdate(update),
    });
    this.startAckTimer(seq);
  }

  private drainBatch(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = null;
    this.sendPendingUpdate();
    this.completeFlushIfDrained();
  }

  private readonly onLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === SYNC_ORIGIN || !this.snapshot.hydrated) return;
    this.pendingUpdate = this.pendingUpdate
      ? Y.mergeUpdates([this.pendingUpdate, update])
      : update;
    if (!this.batchTimer) this.batchTimer = setTimeout(() => this.drainBatch(), this.batchMs);
  };

  private attachDoc(doc: Y.Doc): void {
    doc.on("update", this.onLocalUpdate);
  }

  private replaceDoc(update: Uint8Array): void {
    const oldDoc = this.snapshot.doc;
    oldDoc.off("update", this.onLocalUpdate);
    oldDoc.destroy();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update, SYNC_ORIGIN);
    this.attachDoc(doc);
    this.snapshot = { doc, editorKey: this.snapshot.editorKey + 1, hydrated: true };
    this.notify();
  }

  private handleHydrate(
    message: Extract<NativeToWebViewMessage, { type: "hydrate" }>,
  ): void {
    try {
      Y.applyUpdate(this.snapshot.doc, decodeUpdate(message.update), SYNC_ORIGIN);
      this.attachDoc(this.snapshot.doc);
      this.sceneId = message.sceneId;
      this.uiChannel.setScene(message.sceneId);
      this.snapshot = { ...this.snapshot, hydrated: true };
      this.notify();
      this.sendAck(message.seq, "hydrate");
    } catch {
      this.postError("apply-failed", message.seq);
    }
  }

  private handleStateMessage(message: NativeStateMessage): void {
    try {
      if (message.type === "update") {
        Y.applyUpdate(this.snapshot.doc, decodeUpdate(message.update), SYNC_ORIGIN);
        this.sendAck(message.seq, "update");
      } else if (message.type === "replace") {
        this.replaceDoc(decodeUpdate(message.update));
        this.sendAck(message.seq, "replace");
      } else if (message.type === "flush") {
        this.pendingFlushSeq = message.seq;
        this.drainBatch();
      }
    } catch {
      this.postError("apply-failed", message.seq);
    }
  }

  private handleWebUpdateAck(message: AckMessage): void {
    if (message.ackType !== "update" || message.seq !== this.inFlightSeq) return;
    this.clearAckTimer();
    this.inFlightSeq = null;
    this.sendPendingUpdate();
    this.completeFlushIfDrained();
  }

  private validateStateMessage(message: NativeStateMessage): boolean {
    if (this.sceneId && message.sceneId !== this.sceneId) {
      this.postError("scene-mismatch", message.seq);
      return false;
    }
    if (message.seq < this.nextNativeSeq) {
      const ack = this.priorAcks.get(message.seq);
      if (ack) this.post(ack);
      return false;
    }
    if (message.seq > this.nextNativeSeq) {
      this.postError("sequence-gap", message.seq);
      return false;
    }
    this.nextNativeSeq += 1;
    return true;
  }

  private readonly onWindowMessage = (event: MessageEvent<unknown>): void => {
    if (typeof event.data === "string") this.receive(event.data);
  };

  private readonly onDocumentMessage = (event: Event): void => {
    if (event instanceof MessageEvent && typeof event.data === "string") this.receive(event.data);
  };
}

export function createBridgeClient(options: BridgeClientOptions = {}): BridgeClient {
  return new WebViewBridgeClient(options);
}
