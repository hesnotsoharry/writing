import { fromUint8Array } from "js-base64";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { EngineLiveScenePort } from "../shared/engine";
import {
  MOBILE_EDITOR_BRIDGE_VERSION, parseNativeMessage, serializeBridgeMessage,
  type WebViewToNativeMessage,
} from "../shared/mobileEditorBridgeProtocol";
import type { SceneDocStore } from "../shared/sceneDocStore";
import { encodeDoc, extractPlainText } from "../shared/serialize";
import {
  createMobileLiveScenePort, type MobileLiveScenePort, type MobileLiveSceneTransport,
  PendingMobileSceneChangesError, replaceActiveMobileSceneDurably,
  subscribeMobileSceneReplaced,
} from "./mobileLiveScenePort";

const SCENE_ID = "scene-1";
const SESSION_ID = "session-1";

class MemorySceneStore implements SceneDocStore {
  state: string | null = null;
  readonly events: string[];
  constructor(events: string[]) { this.events = events; }
  async listAll() { return []; }
  async load(): Promise<string | null> { return this.state; }
  async save(_id: string, state: string): Promise<void> {
    this.events.push("persist"); this.state = state;
  }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(): Promise<void> { this.state = null; }
}

class FakeTransport implements MobileLiveSceneTransport {
  readonly raw: string[] = [];
  readonly events: string[];
  unavailable = false;
  constructor(events: string[]) { this.events = events; }
  postMessage(message: string): void {
    if (this.unavailable) throw new Error("unavailable");
    const parsed = parseNativeMessage(message);
    this.events.push(parsed?.type === "ack" ? "ack" : `post:${parsed?.type ?? "invalid"}`);
    this.raw.push(message);
  }
  messages() { return this.raw.map(parseNativeMessage).filter((value) => value !== null); }
  clear(): void { this.raw.length = 0; }
}

function makeHarness(text = "base") {
  const events: string[] = [];
  const store = new MemorySceneStore(events); store.state = encodeDoc(textDoc(text));
  const transport = new FakeTransport(events);
  const engine = {
    attached: null as EngineLiveScenePort | null,
    detached: false,
    attachLiveScenePort: vi.fn((_id: string, port: EngineLiveScenePort) => { engine.attached = port; }),
    detachLiveScenePort: vi.fn(() => { engine.detached = true; }),
    publishLiveUpdate: vi.fn(async () => { events.push("publish"); }),
    notifyLocalSave: vi.fn(() => { events.push("notify"); }),
  };
  const updateWordCount = vi.fn(async () => { events.push("words"); });
  const port = createMobileLiveScenePort(
    { sceneId: SCENE_ID, transport, ackTimeoutMs: 100 },
    { engine, sceneStore: store, updateWordCount },
  );
  return { port, store, transport, engine, events, updateWordCount };
}

function textDoc(text: string): Y.Doc {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  const value = new Y.XmlText(); value.insert(0, text); paragraph.insert(0, [value]);
  doc.getXmlFragment("content").insert(0, [paragraph]);
  return doc;
}

function appendUpdate(state: string, suffix: string): Uint8Array {
  const doc = new Y.Doc(); Y.applyUpdate(doc, decode(state));
  let update: Uint8Array<ArrayBufferLike> = new Uint8Array();
  doc.on("update", (next) => { update = next; });
  const paragraph = doc.getXmlFragment("content").get(0) as Y.XmlElement;
  const value = paragraph.get(0) as Y.XmlText;
  value.insert(value.length, suffix);
  return update;
}

function decode(state: string): Uint8Array {
  return Uint8Array.from(atob(state), (character) => character.charCodeAt(0));
}

type WithoutEnvelope<T> = T extends WebViewToNativeMessage
  ? Omit<T, "v" | "sessionId"> & { sessionId?: string }
  : never;

function webMessage(message: WithoutEnvelope<WebViewToNativeMessage>): string {
  return serializeBridgeMessage({
    v: MOBILE_EDITOR_BRIDGE_VERSION, sessionId: message.sessionId ?? SESSION_ID, ...message,
  } as WebViewToNativeMessage);
}

function ack(seq: number, ackType: "hydrate" | "update" | "replace" | "flush"): string {
  return webMessage({ type: "ack", sceneId: SCENE_ID, seq, ackType });
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

async function hydrate(port: MobileLiveScenePort, transport: FakeTransport): Promise<void> {
  await port.start();
  const ready = port.receive(webMessage({ type: "ready" }));
  await settle();
  const message = transport.messages().at(-1);
  expect(message).toMatchObject({ type: "hydrate", seq: 1 });
  await port.receive(ack(1, "hydrate"));
  await ready;
  transport.clear();
}

function localUpdate(seq: number, update: Uint8Array, overrides = {}) {
  return webMessage({
    type: "update", sceneId: SCENE_ID, seq, update: fromUint8Array(update), ...overrides,
  });
}

function lastStateSeq(transport: FakeTransport): number {
  const message = transport.messages().at(-1);
  if (!message || !("seq" in message) || typeof message.seq !== "number") {
    throw new Error("state message missing");
  }
  return message.seq;
}

describe("MobileLiveScenePort persistence and routing", () => {
  afterEach(() => vi.useRealTimers());

  it("orders local persist, publish, notification, then ACK with original bytes", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport); ctx.events.length = 0;
    const update = appendUpdate(ctx.store.state!, " local");
    await ctx.port.receive(localUpdate(1, update));
    expect(ctx.events).toEqual(["persist", "words", "publish", "notify", "ack"]);
    expect(ctx.engine.publishLiveUpdate).toHaveBeenCalledWith(SCENE_ID, update);
    expect(ctx.transport.messages()[0]).toMatchObject({ type: "ack", seq: 1, ackType: "update" });
  });

  it("persists a remote update before posting its original incremental bytes", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport); ctx.events.length = 0;
    const update = appendUpdate(ctx.store.state!, " remote");
    await ctx.port.applyRemoteUpdate(update);
    expect(ctx.events).toEqual(["persist", "words", "post:update"]);
    expect(ctx.transport.messages()[0]).toMatchObject({ type: "update", update: fromUint8Array(update) });
  });

  it("serializes a local/remote race and converges both edits in storage", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const base = ctx.store.state!;
    const local = appendUpdate(base, " local");
    const remote = appendUpdate(base, " remote");
    await Promise.all([ctx.port.receive(localUpdate(1, local)), ctx.port.applyRemoteUpdate(remote)]);
    const stored = new Y.Doc(); Y.applyUpdate(stored, decode(ctx.store.state!));
    expect(extractPlainText(stored)).toContain("local");
    expect(extractPlainText(stored)).toContain("remote");
  });

  it("re-sends the prior ACK for a duplicate without persisting twice", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const update = appendUpdate(ctx.store.state!, " once");
    await ctx.port.receive(localUpdate(1, update));
    const saves = ctx.events.filter((event) => event === "persist").length;
    await ctx.port.receive(localUpdate(1, update));
    expect(ctx.events.filter((event) => event === "persist")).toHaveLength(saves);
    expect(ctx.transport.messages().filter((message) => message?.type === "ack")).toHaveLength(2);
  });

  it("rejects sequence gaps, wrong scenes, and wrong sessions without storage writes", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport); ctx.events.length = 0;
    const update = appendUpdate(ctx.store.state!, " rejected");
    await ctx.port.receive(localUpdate(2, update));
    await ctx.port.receive(localUpdate(1, update, { sceneId: "other" }));
    await ctx.port.receive(localUpdate(1, update, { sessionId: "old" }));
    expect(ctx.events.filter((event) => event === "persist")).toHaveLength(0);
    expect(ctx.transport.messages()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "error", code: "sequence-gap" }),
      expect.objectContaining({ type: "error", code: "scene-mismatch" }),
      expect.objectContaining({ type: "error", code: "session-mismatch" }),
    ]));
  });

  it("accepts a fresh ready session and rejects messages from the replaced session", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const restarting = ctx.port.receive(webMessage({ type: "ready", sessionId: "session-2" }));
    await settle();
    const hydrateMessage = ctx.transport.messages().at(-1);
    expect(hydrateMessage).toMatchObject({ type: "hydrate", sessionId: "session-2", seq: 1 });
    await ctx.port.receive(webMessage({
      type: "ack", sessionId: "session-2", sceneId: SCENE_ID, seq: 1, ackType: "hydrate",
    }));
    await restarting; ctx.transport.clear();
    await ctx.port.receive(localUpdate(1, appendUpdate(ctx.store.state!, " stale")));
    expect(ctx.transport.messages()[0]).toMatchObject({ type: "error", code: "session-mismatch" });
  });

  it("ACKs after durable persistence when the relay publish is offline", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport); ctx.events.length = 0;
    ctx.engine.publishLiveUpdate.mockImplementation(async () => { ctx.events.push("publish-offline"); });
    await ctx.port.receive(localUpdate(1, appendUpdate(ctx.store.state!, " offline")));
    expect(ctx.events).toEqual(["persist", "words", "publish-offline", "notify", "ack"]);
  });

  it("never copies update bytes into protocol errors", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const encoded = fromUint8Array(appendUpdate(ctx.store.state!, " secret-marker"));
    await ctx.port.receive(webMessage({
      type: "update", sceneId: "wrong", seq: 1, update: encoded,
    }));
    expect(ctx.transport.raw.at(-1)).not.toContain(encoded);
    expect(ctx.transport.raw.at(-1)).not.toContain("secret-marker");
  });
});

describe("MobileLiveScenePort flush, close, and replacement", () => {
  afterEach(() => vi.useRealTimers());

  it("flushes immediately when the WebView reports no edits", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const flushing = ctx.port.flushLocal(); await settle();
    const seq = lastStateSeq(ctx.transport); await ctx.port.receive(ack(seq, "flush"));
    await expect(flushing).resolves.toEqual({ status: "flushed" });
  });

  it("accepts a drained local batch before the flush ACK", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const flushing = ctx.port.flushLocal(); await settle();
    const flushSeq = lastStateSeq(ctx.transport);
    await ctx.port.receive(localUpdate(1, appendUpdate(ctx.store.state!, " batched")));
    await ctx.port.receive(ack(flushSeq, "flush"));
    await expect(flushing).resolves.toEqual({ status: "flushed" });
    expect(extractStored(ctx.store)).toContain("batched");
  });

  it("queues flush behind an unacknowledged remote update", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    await ctx.port.applyRemoteUpdate(appendUpdate(ctx.store.state!, " remote"));
    const updateSeq = lastStateSeq(ctx.transport);
    const flushing = ctx.port.flushLocal(); await settle();
    expect(ctx.transport.messages().at(-1)?.type).toBe("update");
    await ctx.port.receive(ack(updateSeq, "update")); await settle();
    const flushSeq = lastStateSeq(ctx.transport);
    expect(ctx.transport.messages().at(-1)?.type).toBe("flush");
    await ctx.port.receive(ack(flushSeq, "flush"));
    await expect(flushing).resolves.toEqual({ status: "flushed" });
  });

  it("does not call a freshly hydrated editor dirty when a flush times out", async () => {
    vi.useFakeTimers();
    const ctx = makeHarness(); await hydrateWithTimers(ctx.port, ctx.transport);
    const closing = ctx.port.close(); await settle();
    await vi.advanceTimersByTimeAsync(100);
    await expect(closing).resolves.toEqual({ status: "timed-out", pendingLocal: false });
    expect(ctx.engine.detachLiveScenePort).toHaveBeenCalledWith(ctx.port);
  });

  it("keeps the port attached when local activity has not reached a flush ACK", async () => {
    vi.useFakeTimers();
    const ctx = makeHarness(); await hydrateWithTimers(ctx.port, ctx.transport);
    await ctx.port.receive(localUpdate(1, appendUpdate(ctx.store.state!, " local")));
    const closing = ctx.port.close(); await settle();
    await vi.advanceTimersByTimeAsync(100);
    await expect(closing).resolves.toEqual({ status: "timed-out", pendingLocal: true });
    expect(ctx.engine.detachLiveScenePort).not.toHaveBeenCalled();
  });

  it("detaches only after a safely acknowledged close", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const closing = ctx.port.close(); await settle();
    await ctx.port.receive(ack(lastStateSeq(ctx.transport), "flush"));
    await expect(closing).resolves.toEqual({ status: "flushed" });
    expect(ctx.engine.detachLiveScenePort).toHaveBeenCalledWith(ctx.port);
  });

  it("reports unavailable without pending edits before ready and safely detaches", async () => {
    const ctx = makeHarness(); await ctx.port.start();
    await expect(ctx.port.close()).resolves.toEqual({ status: "unavailable", pendingLocal: false });
    expect(ctx.engine.detachLiveScenePort).toHaveBeenCalledWith(ctx.port);
  });

  it("replacement discards queued visual increments and posts authoritative state unchanged", async () => {
    const ctx = makeHarness(); await hydrate(ctx.port, ctx.transport);
    const first = appendUpdate(ctx.store.state!, " first");
    const second = appendUpdate(ctx.store.state!, " second");
    await ctx.port.applyRemoteUpdate(first);
    const firstSeq = lastStateSeq(ctx.transport);
    await ctx.port.applyRemoteUpdate(second);
    const replacement = encodeDoc(textDoc("replacement wins"));
    await ctx.port.replaceFromState(replacement);
    await ctx.port.receive(ack(firstSeq, "update")); await settle();
    const posted = ctx.transport.messages().at(-1);
    expect(posted).toMatchObject({ type: "replace", update: replacement });
    expect(ctx.transport.messages().filter((message) => message?.type === "update")).toHaveLength(1);
  });

  it("flushes pending prose before the safety write and rejects stale-doc updates during restore", async () => {
    const ctx = makeHarness("current"); await hydrate(ctx.port, ctx.transport);
    ctx.port.notePotentialLocalChanges();
    const replacement = encodeDoc(textDoc("restored"));
    let safetyText = "";
    const restoring = replaceActiveMobileSceneDurably(SCENE_ID, replacement, async () => {
      safetyText = extractStored(ctx.store);
      ctx.store.state = replacement;
      ctx.events.push("epoch");
    });
    await settle();
    const flushSeq = lastStateSeq(ctx.transport);
    await ctx.port.receive(localUpdate(1, appendUpdate(ctx.store.state!, " pending")));
    await ctx.port.receive(ack(flushSeq, "flush"));
    await settle();
    expect(safetyText).toBe("current pending");
    expect(ctx.transport.messages().at(-1)).toMatchObject({ type: "replace", update: replacement });
    const replaceSeq = lastStateSeq(ctx.transport);

    await ctx.port.receive(ack(replaceSeq, "replace"));
    await expect(restoring).resolves.toBeUndefined();
    await ctx.port.receive(localUpdate(2, appendUpdate(encodeDoc(textDoc("current pending")), " stale")));
    expect(extractStored(ctx.store)).toBe("restored");
  });

  it("restores a freshly hydrated covered editor without classifying hydration as pending", async () => {
    const ctx = makeHarness("current"); await hydrateWithTimers(ctx.port, ctx.transport);
    ctx.transport.unavailable = true;
    const replacement = encodeDoc(textDoc("restored"));
    const replaced: string[] = [];
    const unsubscribe = subscribeMobileSceneReplaced((sceneId) => replaced.push(sceneId));
    const restoring = replaceActiveMobileSceneDurably(SCENE_ID, replacement, async () => {
      ctx.store.state = replacement;
    });
    await expect(restoring).resolves.toBeUndefined();
    expect(extractStored(ctx.store)).toBe("restored");
    expect(replaced).toEqual([SCENE_ID]);

    await ctx.port.receive(localUpdate(1, appendUpdate(encodeDoc(textDoc("current")), " stale")));
    expect(extractStored(ctx.store)).toBe("restored");
    ctx.transport.unavailable = false;
    const remounting = ctx.port.receive(webMessage({ type: "ready", sessionId: "session-2" }));
    await settle();
    expect(ctx.transport.messages().at(-1)).toMatchObject({
      type: "hydrate", sessionId: "session-2", update: replacement,
    });
    await ctx.port.receive(webMessage({
      type: "ack", sessionId: "session-2", sceneId: SCENE_ID,
      seq: lastStateSeq(ctx.transport), ackType: "hydrate",
    }));
    await remounting;
    await ctx.port.receive(localUpdate(1, appendUpdate(replacement, " old-session")));
    expect(extractStored(ctx.store)).toBe("restored");
    unsubscribe();
  });

  it("blocks a timed-out restore only after actual local activity", async () => {
    vi.useFakeTimers();
    const ctx = makeHarness("current"); await hydrateWithTimers(ctx.port, ctx.transport);
    await ctx.port.receive(localUpdate(1, appendUpdate(ctx.store.state!, " edit")));
    const persist = vi.fn(async () => undefined);
    const restoring = replaceActiveMobileSceneDurably(
      SCENE_ID, encodeDoc(textDoc("restored")), persist,
    );
    const rejection = expect(restoring).rejects.toBeInstanceOf(PendingMobileSceneChangesError);
    await settle();
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(persist).not.toHaveBeenCalled();
  });
});

function extractStored(store: MemorySceneStore): string {
  const doc = new Y.Doc(); Y.applyUpdate(doc, decode(store.state!));
  return extractPlainText(doc);
}

async function hydrateWithTimers(port: MobileLiveScenePort, transport: FakeTransport): Promise<void> {
  await port.start();
  const ready = port.receive(webMessage({ type: "ready" })); await settle();
  await port.receive(ack(lastStateSeq(transport), "hydrate")); await ready; transport.clear();
}

describe("MobileLiveScenePort remote epoch replacement (audit P0.1)", () => {
  it("noteReplacementPending gates the port: later editor updates are ACKed but never persisted", async () => {
    const { port, store, transport } = makeHarness();
    await hydrate(port, transport);
    const baseline = store.state;
    port.noteReplacementPending();
    const update = appendUpdate(store.state ?? "", " typed-after-catchup");
    await port.receive(localUpdate(1, update));
    await settle();
    // The WebView is told the save happened (no error loop while the host
    // restarts), but the stale-doc update must not merge into the store.
    expect(transport.messages().at(-1)).toMatchObject({ type: "ack", ackType: "update", seq: 1 });
    expect(store.state).toBe(baseline);
  });

  it("noteReplacementPending fires the scene-replaced signal so the host restarts", async () => {
    const { port, transport } = makeHarness();
    await hydrate(port, transport);
    const replaced: string[] = [];
    const unsubscribe = subscribeMobileSceneReplaced((id) => replaced.push(id));
    port.noteReplacementPending();
    unsubscribe();
    expect(replaced).toEqual([SCENE_ID]);
  });

  it("a fresh hydrate after the replacement lifts the gate", async () => {
    const { port, store, transport } = makeHarness();
    await hydrate(port, transport);
    port.noteReplacementPending();
    const ready = port.receive(webMessage({ type: "ready", sessionId: "session-2" }));
    await settle();
    await port.receive(webMessage({
      type: "ack", sceneId: SCENE_ID, seq: 1, ackType: "hydrate", sessionId: "session-2",
    }));
    await ready;
    transport.clear();
    const update = appendUpdate(store.state ?? "", " post-restart");
    await port.receive(localUpdate(1, update, { sessionId: "session-2" }));
    await settle();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, decode(store.state ?? ""));
    expect(extractPlainText(doc)).toContain("post-restart");
  });
});
