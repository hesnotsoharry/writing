import { fromUint8Array } from "js-base64";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { SyncEngine, type SyncProvider } from "../../sync/engine";
import { openMessage, sealMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import type { InnerMessage } from "../../sync/messages";
import type { ConnectionState } from "../../sync/provider";
import { SYNC_ORIGIN } from "../../yjs/bindPersistence";
import { encodeDoc, extractPlainText } from "../../yjs/serialize";

interface Row { id: string; stateBase64: string; updatedAt: string | null }

class MemorySceneStore implements SceneDocStore {
  readonly rows = new Map<string, Row>();
  readonly projections = new Map<string, string>();
  saveCount = 0;
  async listAll(): Promise<Row[]> { return [...this.rows.values()]; }
  async load(id: string): Promise<string | null> { return this.rows.get(id)?.stateBase64 ?? null; }
  async save(id: string, stateBase64: string, plaintext: string | null): Promise<void> {
    this.saveCount += 1;
    this.rows.set(id, { id, stateBase64, updatedAt: null });
    if (plaintext) this.projections.set(id, plaintext);
  }
  async loadProjection(id: string): Promise<string | null> { return this.projections.get(id) ?? null; }
  async delete(id: string): Promise<void> { this.rows.delete(id); }
}

class MemoryBoardStore implements BoardDocStore {
  readonly rows = new Map<string, Row>();
  async listAll(): Promise<Row[]> { return [...this.rows.values()]; }
  async load(id: string): Promise<string | null> { return this.rows.get(id)?.stateBase64 ?? null; }
  async save(id: string, stateBase64: string): Promise<void> {
    this.rows.set(id, { id, stateBase64, updatedAt: null });
  }
}

class FakeProvider implements SyncProvider {
  readonly sent: Uint8Array[] = [];
  private connection: ((state: ConnectionState) => void) | null = null;
  private frames: ((blob: Uint8Array) => void) | null = null;
  connect(): void { this.connection?.("connected"); }
  destroy(): void { this.connection?.("disconnected"); }
  send(blob: Uint8Array): void { this.sent.push(blob); }
  subscribeConnection(cb: (state: ConnectionState) => void): () => void {
    this.connection = cb; cb("disconnected"); return () => { this.connection = null; };
  }
  subscribeFrames(cb: (blob: Uint8Array) => void): () => void {
    this.frames = cb; return () => { this.frames = null; };
  }
  receive(blob: Uint8Array): void { this.frames?.(blob); }
}

const MASTER_KEY = new Uint8Array(32).fill(7);

function textDoc(text: string): Y.Doc {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  const value = new Y.XmlText();
  value.insert(0, text);
  paragraph.insert(0, [value]);
  doc.getXmlFragment("content").insert(0, [paragraph]);
  return doc;
}

function seed(store: MemorySceneStore, id: string, doc: Y.Doc): void {
  store.rows.set(id, { id, stateBase64: encodeDoc(doc), updatedAt: null });
}

function makeEngine(sceneStore = new MemorySceneStore()) {
  const provider = new FakeProvider();
  const boardStore = new MemoryBoardStore();
  const updateWordCount = vi.fn().mockResolvedValue(undefined);
  const engine = new SyncEngine({
    relayUrl: "wss://relay.test", sceneStore, boardStore,
    readMasterKey: () => Promise.resolve(MASTER_KEY),
    getDeviceId: () => Promise.resolve("device-a"),
    providerFactory: () => provider, updateWordCount,
  });
  return { engine, provider, sceneStore, boardStore, updateWordCount };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

async function waitForSent(provider: FakeProvider, count = 1): Promise<void> {
  await vi.waitFor(() => expect(provider.sent.length).toBeGreaterThanOrEqual(count));
}

async function decodeSent(provider: FakeProvider): Promise<InnerMessage[]> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  const values = await Promise.all(provider.sent.map((blob) => openMessage(key, blob)));
  return values.filter((value): value is InnerMessage => value !== null) as InnerMessage[];
}

async function deliver(provider: FakeProvider, message: InnerMessage): Promise<void> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  provider.receive(await sealMessage(key, message));
  await flush();
}

describe("SyncEngine sweeps and live updates", () => {
  afterEach(() => vi.useRealTimers());

  it("sends full state to a fresh peer and never answers hello with hello", async () => {
    const { engine, provider, sceneStore } = makeEngine();
    seed(sceneStore, "scene-1", textDoc("local prose"));
    await engine.start(); await waitForSent(provider);
    provider.sent.length = 0;

    await deliver(provider, { t: "hello", device: "device-b", docs: [] });
    await waitForSent(provider);

    const sent = await decodeSent(provider);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ t: "diff", c: "scene:scene-1" });
    expect(sent.some((message) => message.t === "hello")).toBe(false);
    const fresh = new Y.Doc();
    if (sent[0].t === "diff") Y.applyUpdate(fresh, toUpdate(sent[0].u));
    expect(extractPlainText(fresh)).toBe("local prose");
    engine.stop();
  });

  it("converges bidirectional divergence after hello and diff exchange", async () => {
    const base = textDoc("base");
    const leftDoc = new Y.Doc(); Y.applyUpdate(leftDoc, Y.encodeStateAsUpdate(base));
    const rightDoc = new Y.Doc(); Y.applyUpdate(rightDoc, Y.encodeStateAsUpdate(base));
    leftDoc.getMap("edits").set("left", true);
    rightDoc.getMap("edits").set("right", true);
    const left = makeEngine(); const right = makeEngine();
    seed(left.sceneStore, "shared", leftDoc); seed(right.sceneStore, "shared", rightDoc);
    await Promise.all([left.engine.start(), right.engine.start()]);
    await Promise.all([waitForSent(left.provider), waitForSent(right.provider)]);

    const leftHello = left.provider.sent.shift()!; const rightHello = right.provider.sent.shift()!;
    left.provider.receive(rightHello); right.provider.receive(leftHello);
    await Promise.all([waitForSent(left.provider), waitForSent(right.provider)]);
    const leftDiff = left.provider.sent.shift()!; const rightDiff = right.provider.sent.shift()!;
    left.provider.receive(rightDiff); right.provider.receive(leftDiff);
    await vi.waitFor(async () => {
      expect(await left.sceneStore.load("shared")).toBe(await right.sceneStore.load("shared"));
    });

    expect(await left.sceneStore.load("shared")).toBe(await right.sceneStore.load("shared"));
    left.engine.stop(); right.engine.stop();
  });

  it("applies a live update to the open doc with SYNC_ORIGIN", async () => {
    const { engine, provider } = makeEngine();
    await engine.start(); await waitForSent(provider);
    const open = new Y.Doc(); const remote = textDoc("remote words");
    const origins: unknown[] = [];
    open.on("update", (_update, origin) => origins.push(origin));
    engine.attachLiveDoc("open", open);

    await deliver(provider, {
      t: "live", c: "scene:open", u: fromUint8Array(Y.encodeStateAsUpdate(remote)),
    });

    await vi.waitFor(() => expect(origins).toContain(SYNC_ORIGIN));
    expect(extractPlainText(open)).toBe("remote words");
    engine.stop();
  });

  it("merges a closed doc and writes projection plus word count", async () => {
    const { engine, provider, sceneStore, updateWordCount } = makeEngine();
    seed(sceneStore, "closed", textDoc("local"));
    await engine.start(); await waitForSent(provider);

    await deliver(provider, {
      t: "diff", c: "scene:closed", u: fromUint8Array(Y.encodeStateAsUpdate(textDoc("remote prose"))),
    });

    await vi.waitFor(() => expect(sceneStore.saveCount).toBe(1));
    expect(sceneStore.projections.get("closed")).toContain("remote prose");
    expect(updateWordCount).toHaveBeenCalledWith("closed", 3);
    engine.stop();
  });

  it("drops frames while paused and re-sweeps on resume", async () => {
    const { engine, provider, sceneStore } = makeEngine();
    seed(sceneStore, "closed", textDoc("local"));
    await engine.start(); await waitForSent(provider);
    provider.sent.length = 0;
    engine.pause();
    await deliver(provider, {
      t: "diff", c: "scene:closed", u: fromUint8Array(Y.encodeStateAsUpdate(textDoc("ignored"))),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sceneStore.saveCount).toBe(0);

    engine.resume(); await flush();
    expect((await decodeSent(provider)).some((message) => message.t === "hello")).toBe(true);
    engine.stop();
  });

  it("debounces targeted hello after a local save", async () => {
    vi.useFakeTimers();
    const { engine, provider, sceneStore } = makeEngine();
    seed(sceneStore, "saved", textDoc("local"));
    await engine.start(); await waitForSent(provider);
    provider.sent.length = 0;

    engine.notifyLocalSave("saved"); engine.notifyLocalSave("saved");
    await vi.advanceTimersByTimeAsync(1_999); expect(provider.sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await waitForSent(provider);
    const sent = await decodeSent(provider);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ t: "hello", docs: [{ c: "scene:saved" }] });
    engine.stop();
  });
});

function toUpdate(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
