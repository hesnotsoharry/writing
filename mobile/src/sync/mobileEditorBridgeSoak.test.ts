// @vitest-environment jsdom

import { fromUint8Array, toUint8Array } from "js-base64";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { type BridgeClient,createBridgeClient } from "../../editor-web/src/bridgeClient";
import type { EngineLiveScenePort } from "../shared/engine";
import {
  type AckMessage,
  type NativeToWebViewMessage,
  parseNativeMessage,
  parseWebViewMessage,
  type WebViewToNativeMessage,
} from "../shared/mobileEditorBridgeProtocol";
import type { SceneDocStore } from "../shared/sceneDocStore";
import { encodeDoc, extractPlainText } from "../shared/serialize";
import {
  createMobileLiveScenePort,
  type MobileLiveScenePort,
  type MobileLiveSceneTransport,
} from "./mobileLiveScenePort";

const WORD_COUNT = 50_000;
const EDIT_COUNT = 1_000;
const BATCH_MS = 500;
const HYDRATE_CEILING_BYTES = 10_000_000;
const PENDING_CEILING_BYTES = 2_000_000;
const SOAK_CEILING_MS = 120_000;
const wallNow = Date.now.bind(Date);

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
  }
}

type StateMessage = Extract<
  NativeToWebViewMessage,
  { type: "hydrate" | "update" | "replace" | "flush" }
>;

class MemorySceneStore implements SceneDocStore {
  private readonly states = new Map<string, string>();
  private readonly projections = new Map<string, string>();

  seed(sceneId: string, state: string): void { this.states.set(sceneId, state); }
  async listAll() { return []; }
  async load(sceneId: string): Promise<string | null> { return this.states.get(sceneId) ?? null; }
  async save(sceneId: string, state: string, projection: string | null): Promise<void> {
    this.states.set(sceneId, state);
    if (projection) this.projections.set(sceneId, projection);
  }
  async loadProjection(sceneId: string): Promise<string | null> {
    return this.projections.get(sceneId) ?? null;
  }
  async delete(sceneId: string): Promise<void> {
    this.states.delete(sceneId); this.projections.delete(sceneId);
  }
}

class FakeEngine {
  readonly published: Uint8Array[] = [];
  attached: EngineLiveScenePort | null = null;

  attachLiveScenePort(_sceneId: string, port: EngineLiveScenePort): void { this.attached = port; }
  detachLiveScenePort(port: EngineLiveScenePort): void {
    if (this.attached === port) this.attached = null;
  }
  async publishLiveUpdate(_sceneId: string, update: Uint8Array): Promise<void> {
    this.published.push(update);
  }
  notifyLocalSave(): void { /* Persistence is the assertion boundary. */ }
}

class DelayedBridge implements MobileLiveSceneTransport {
  readonly nativeQueue: string[] = [];
  readonly webQueue: string[] = [];
  readonly nativeStateSeqs: number[] = [];
  readonly webUpdateSeqs: number[] = [];
  readonly nativeOutstanding = new Set<number>();
  readonly webOutstanding = new Set<number>();
  maxNativeInFlight = 0;
  maxWebInFlight = 0;

  postMessage = (raw: string): void => {
    const message = requiredNative(raw);
    this.nativeQueue.push(raw);
    if (isState(message)) this.recordNativeState(message.seq);
  };

  postFromWeb = (raw: string): void => {
    const message = requiredWeb(raw);
    this.webQueue.push(raw);
    if (message.type === "update") this.recordWebUpdate(message.seq);
  };

  takeNative(type: NativeToWebViewMessage["type"], ackType?: AckMessage["ackType"]): string {
    return takeMatching(this.nativeQueue, (raw) => {
      const message = requiredNative(raw);
      return message.type === type && (message.type !== "ack" || message.ackType === ackType);
    });
  }

  takeWeb(type: WebViewToNativeMessage["type"], ackType?: AckMessage["ackType"]): string {
    return takeMatching(this.webQueue, (raw) => {
      const message = requiredWeb(raw);
      return message.type === type && (message.type !== "ack" || message.ackType === ackType);
    });
  }

  deliveredNativeAck(raw: string): void {
    const message = requiredNative(raw);
    if (message.type === "ack" && message.ackType === "update") {
      this.webOutstanding.delete(message.seq);
    }
  }

  deliveredWebAck(raw: string): void {
    const message = requiredWeb(raw);
    if (message.type === "ack") this.nativeOutstanding.delete(message.seq);
  }

  private recordNativeState(seq: number): void {
    this.nativeStateSeqs.push(seq); this.nativeOutstanding.add(seq);
    this.maxNativeInFlight = Math.max(this.maxNativeInFlight, this.nativeOutstanding.size);
  }

  private recordWebUpdate(seq: number): void {
    this.webUpdateSeqs.push(seq); this.webOutstanding.add(seq);
    this.maxWebInFlight = Math.max(this.maxWebInFlight, this.webOutstanding.size);
  }
}

interface SoakHarness {
  bridge: DelayedBridge;
  client: BridgeClient;
  engine: FakeEngine;
  port: MobileLiveScenePort;
  sceneId: string;
  store: MemorySceneStore;
}

function createHarness(sceneId: string, state: string, sessionId: string): SoakHarness {
  const bridge = new DelayedBridge();
  const store = new MemorySceneStore(); store.seed(sceneId, state);
  const engine = new FakeEngine();
  const port = createMobileLiveScenePort(
    { sceneId, transport: bridge, ackTimeoutMs: 60_000 },
    { engine, sceneStore: store, updateWordCount: async () => undefined },
  );
  const client = createBridgeClient({
    sessionId, batchMs: BATCH_MS, ackTimeoutMs: 60_000, postMessage: bridge.postFromWeb,
  });
  return { bridge, client, engine, port, sceneId, store };
}

function makeLargeScene(prefix = "word"): Y.Doc {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("content");
  const paragraphs: Y.XmlElement[] = [];
  for (let paragraphIndex = 0; paragraphIndex < 250; paragraphIndex += 1) {
    const paragraph = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    const offset = paragraphIndex * 200;
    text.insert(0, makeWords(prefix, offset, 200));
    paragraph.insert(0, [text]); paragraphs.push(paragraph);
  }
  fragment.insert(0, paragraphs);
  return doc;
}

function makeWords(prefix: string, offset: number, count: number): string {
  return Array.from({ length: count }, (_value, index) => `${prefix}${offset + index}`).join(" ");
}

function cloneFromState(state: string): Y.Doc {
  const doc = new Y.Doc(); Y.applyUpdate(doc, toUint8Array(state)); return doc;
}

function captureEdits(doc: Y.Doc, count: number, prefix: string): Uint8Array[] {
  const updates: Uint8Array[] = [];
  const listener = (update: Uint8Array): void => { updates.push(update); };
  doc.on("update", listener);
  const fragment = doc.getXmlFragment("content");
  const paragraph = fragment.get(fragment.length - 1);
  if (!(paragraph instanceof Y.XmlElement)) throw new Error("missing paragraph");
  const text = paragraph.get(0);
  if (!(text instanceof Y.XmlText)) throw new Error("missing paragraph text");
  for (let index = 0; index < count; index += 1) text.insert(text.length, ` ${prefix}${index}`);
  doc.off("update", listener);
  expect(updates).toHaveLength(count);
  return updates;
}

async function hydrate(harness: SoakHarness): Promise<number> {
  await harness.port.start();
  const ready = harness.bridge.takeWeb("ready");
  const receiving = harness.port.receive(ready); await settle();
  const hydrateRaw = harness.bridge.takeNative("hydrate");
  const hydrateMessage = requiredNative(hydrateRaw);
  if (hydrateMessage.type !== "hydrate") throw new Error("hydrate missing");
  harness.client.receive(hydrateRaw);
  const ackRaw = harness.bridge.takeWeb("ack", "hydrate");
  harness.bridge.deliveredWebAck(ackRaw); await harness.port.receive(ackRaw); await receiving;
  return toUint8Array(hydrateMessage.update).byteLength;
}

async function deliverNativeUpdate(harness: SoakHarness, raw: string, duplicate = false): Promise<void> {
  harness.client.receive(raw);
  if (duplicate) harness.client.receive(raw);
  const ack = harness.bridge.takeWeb("ack", "update");
  harness.bridge.deliveredWebAck(ack); await harness.port.receive(ack);
  if (duplicate) await harness.port.receive(harness.bridge.takeWeb("ack", "update"));
}

async function deliverWebUpdate(harness: SoakHarness, raw: string, duplicate = false): Promise<void> {
  await harness.port.receive(raw);
  if (duplicate) await harness.port.receive(raw);
  const ack = harness.bridge.takeNative("ack", "update");
  harness.bridge.deliveredNativeAck(ack); harness.client.receive(ack);
  if (duplicate) harness.client.receive(harness.bridge.takeNative("ack", "update"));
}

async function flushWithFinalBatch(harness: SoakHarness): Promise<void> {
  captureEdits(harness.client.getSnapshot().doc, 1, "final-local-");
  const flushing = harness.port.flushLocal(); await settle();
  harness.client.receive(harness.bridge.takeNative("flush"));
  await deliverWebUpdate(harness, harness.bridge.takeWeb("update"));
  const flushAck = harness.bridge.takeWeb("ack", "flush");
  harness.bridge.deliveredWebAck(flushAck); await harness.port.receive(flushAck);
  await expect(flushing).resolves.toEqual({ status: "flushed" });
}

async function assertConverged(harness: SoakHarness): Promise<void> {
  const state = await harness.store.load(harness.sceneId);
  if (!state) throw new Error("stored state missing");
  const stored = cloneFromState(state);
  const web = harness.client.getSnapshot().doc;
  expect(fromUint8Array(Y.encodeStateVector(stored))).toBe(fromUint8Array(Y.encodeStateVector(web)));
  expect(Y.encodeStateAsUpdate(stored, Y.encodeStateVector(web))).toEqual(new Uint8Array([0, 0]));
  expect(Y.encodeStateAsUpdate(web, Y.encodeStateVector(stored))).toEqual(new Uint8Array([0, 0]));
}

function requiredNative(raw: string): NativeToWebViewMessage {
  const message = parseNativeMessage(raw);
  if (!message) throw new Error("invalid native bridge message");
  return message;
}

function requiredWeb(raw: string): WebViewToNativeMessage {
  const message = parseWebViewMessage(raw);
  if (!message) throw new Error("invalid WebView bridge message");
  return message;
}

function isState(message: NativeToWebViewMessage): message is StateMessage {
  return ["hydrate", "update", "replace", "flush"].includes(message.type);
}

function takeMatching(queue: string[], matches: (raw: string) => boolean): string {
  const index = queue.findIndex(matches);
  if (index < 0) throw new Error("expected queued bridge message");
  const [raw] = queue.splice(index, 1);
  if (!raw) throw new Error("queued bridge message missing");
  return raw;
}

function mergedBytes(updates: Uint8Array[]): number {
  return Y.mergeUpdates(updates).byteLength;
}

function expectStrictlyIncreasing(values: number[]): void {
  for (let index = 1; index < values.length; index += 1) {
    expect(values[index]).toBeGreaterThan(values[index - 1] ?? 0);
  }
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("50,000-word mobile editor bridge soak", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("converges 1,000 edits per direction through delayed ACKs, duplicates, switch, and flush", async () => {
    vi.useFakeTimers();
    const started = wallNow();
    const initial = makeLargeScene();
    expect(extractPlainText(initial).trim().split(/\s+/)).toHaveLength(WORD_COUNT);
    const initialState = encodeDoc(initial);
    const harness = createHarness("scene-soak-a", initialState, "session-soak-a");
    const hydrateStarted = wallNow();
    const hydrateBytes = await hydrate(harness);
    const hydrateDurationMs = wallNow() - hydrateStarted;
    expect(hydrateBytes).toBeLessThan(HYDRATE_CEILING_BYTES);

    const localStarted = wallNow();
    captureEdits(harness.client.getSnapshot().doc, 1, "local-");
    await vi.advanceTimersByTimeAsync(BATCH_MS);
    const firstLocalRaw = harness.bridge.takeWeb("update");
    const firstLocalReceive = harness.port.receive(firstLocalRaw);
    await harness.port.receive(firstLocalRaw); await firstLocalReceive;
    const remainingLocal = captureEdits(
      harness.client.getSnapshot().doc, EDIT_COUNT - 1, "local-",
    );
    await vi.advanceTimersByTimeAsync(BATCH_MS);
    const localPendingBytes = mergedBytes(remainingLocal);

    const remoteSource = cloneFromState(initialState);
    const remoteUpdates = captureEdits(remoteSource, EDIT_COUNT, "remote-");
    const remoteStarted = wallNow();
    await harness.port.applyRemoteUpdate(remoteUpdates[0] ?? new Uint8Array());
    const firstRemoteRaw = harness.bridge.takeNative("update");
    await Promise.all(remoteUpdates.slice(1).map((update) => harness.port.applyRemoteUpdate(update)));
    const remotePendingBytes = mergedBytes(remoteUpdates.slice(1));

    const switched = createHarness("scene-soak-b", encodeDoc(makeLargeScene("switch")), "session-b");
    await hydrate(switched);
    const switchedBefore = await switched.store.load(switched.sceneId);
    switched.client.receive(firstRemoteRaw);
    await switched.port.receive(firstLocalRaw);
    expect(await switched.store.load(switched.sceneId)).toBe(switchedBefore);
    expect(requiredWeb(switched.bridge.takeWeb("error"))).toMatchObject({ code: "session-mismatch" });
    expect(requiredNative(switched.bridge.takeNative("error"))).toMatchObject({ code: "session-mismatch" });
    switched.client.destroy();

    harness.client.receive(firstRemoteRaw); harness.client.receive(firstRemoteRaw);
    const firstLocalAck = harness.bridge.takeNative("ack", "update");
    harness.bridge.deliveredNativeAck(firstLocalAck); harness.client.receive(firstLocalAck);
    harness.client.receive(harness.bridge.takeNative("ack", "update"));
    await deliverWebUpdate(harness, harness.bridge.takeWeb("update"));
    const firstRemoteAck = harness.bridge.takeWeb("ack", "update");
    harness.bridge.deliveredWebAck(firstRemoteAck); await harness.port.receive(firstRemoteAck);
    await harness.port.receive(harness.bridge.takeWeb("ack", "update"));
    await settle();
    await deliverNativeUpdate(harness, harness.bridge.takeNative("update"));
    const remoteDurationMs = wallNow() - remoteStarted;
    const localDurationMs = wallNow() - localStarted;

    await flushWithFinalBatch(harness);
    await assertConverged(harness);
    expect(harness.engine.published.length).toBeGreaterThanOrEqual(3);
    expect(harness.bridge.maxNativeInFlight).toBe(1);
    expect(harness.bridge.maxWebInFlight).toBe(1);
    expectStrictlyIncreasing(harness.bridge.nativeStateSeqs);
    expectStrictlyIncreasing(harness.bridge.webUpdateSeqs);
    const peakPendingBytes = Math.max(localPendingBytes, remotePendingBytes);
    expect(peakPendingBytes).toBeLessThan(PENDING_CEILING_BYTES);
    const finalState = await harness.store.load(harness.sceneId);
    if (!finalState) throw new Error("final encoded state missing");
    const peakEncodedBytes = Math.max(hydrateBytes, toUint8Array(finalState).byteLength);
    expect(peakEncodedBytes).toBeLessThan(HYDRATE_CEILING_BYTES);
    const durationMs = wallNow() - started;
    expect(durationMs).toBeLessThan(SOAK_CEILING_MS);

    const metrics = {
      hydrateBytes, hydrateDurationMs: Math.round(hydrateDurationMs),
      webToNativeEditsPerSecond: Math.round((EDIT_COUNT * 1_000) / localDurationMs),
      nativeToWebEditsPerSecond: Math.round((EDIT_COUNT * 1_000) / remoteDurationMs),
      peakEncodedBytes, peakPendingBytes, durationMs: Math.round(durationMs),
    };
    // Required S5e observation output; update bytes and prose are intentionally excluded.
    // eslint-disable-next-line no-console
    console.info("S5e bridge soak metrics", metrics);
    harness.client.destroy();
  }, SOAK_CEILING_MS);

  it("lets epoch replacement supersede queued visual updates and converge afterward", async () => {
    vi.useFakeTimers();
    const oldState = encodeDoc(makeLargeScene("old"));
    const harness = createHarness("scene-epoch", oldState, "session-epoch");
    await hydrate(harness);
    const oldSource = cloneFromState(oldState);
    const oldUpdates = captureEdits(oldSource, 2, "discarded-");
    await harness.port.applyRemoteUpdate(oldUpdates[0] ?? new Uint8Array());
    const activeOldRaw = harness.bridge.takeNative("update");
    await harness.port.applyRemoteUpdate(oldUpdates[1] ?? new Uint8Array());

    const replacement = makeLargeScene("replacement");
    captureEdits(replacement, 1, "epoch-wins-");
    const replacementState = encodeDoc(replacement);
    harness.store.seed(harness.sceneId, replacementState);
    await harness.port.replaceFromState(replacementState);
    await deliverNativeUpdate(harness, activeOldRaw);
    await settle();
    expect(harness.bridge.nativeQueue.filter((raw) => requiredNative(raw).type === "update")).toHaveLength(0);
    const replaceRaw = harness.bridge.takeNative("replace");
    harness.client.receive(replaceRaw);
    const replaceAck = harness.bridge.takeWeb("ack", "replace");
    harness.bridge.deliveredWebAck(replaceAck); await harness.port.receive(replaceAck);

    const postReplacement = cloneFromState(replacementState);
    const laterUpdates = captureEdits(postReplacement, 25, "after-epoch-");
    await harness.port.applyRemoteUpdate(laterUpdates[0] ?? new Uint8Array());
    const firstLaterRaw = harness.bridge.takeNative("update");
    await Promise.all(laterUpdates.slice(1).map((update) => harness.port.applyRemoteUpdate(update)));
    await deliverNativeUpdate(harness, firstLaterRaw);
    await settle();
    await deliverNativeUpdate(harness, harness.bridge.takeNative("update"));
    await assertConverged(harness);
    const text = extractPlainText(harness.client.getSnapshot().doc);
    expect(text).toContain("epoch-wins-0");
    expect(text).toContain("after-epoch-24");
    expect(text).not.toContain("discarded-");
    expect(harness.client.getSnapshot().editorKey).toBe(1);
    expect(harness.bridge.maxNativeInFlight).toBe(1);
    harness.client.destroy();
  }, SOAK_CEILING_MS);
});
