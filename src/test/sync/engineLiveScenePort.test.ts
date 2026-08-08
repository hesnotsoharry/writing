import { fromUint8Array } from "js-base64";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import { InMemoryProjectMetaDocStore } from "../../db/projectMetaDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import type { AppliedEpochStore } from "../../db/syncEpochStore";
import {
  type EngineLiveScenePort, type LiveSceneFlushResult, SyncEngine, type SyncProvider,
} from "../../sync/engine";
import { openMessage, sealMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import type { InnerMessage } from "../../sync/messages";
import { bumpEpoch, type EpochStamp } from "../../sync/meta/metaDoc";
import type { ConnectionState } from "../../sync/provider";
import { encodeDoc } from "../../yjs/serialize";

const MASTER_KEY = new Uint8Array(32).fill(12);
const SCENE_ID = "scene-1";
interface Row { id: string; stateBase64: string; updatedAt: string | null }

class MemorySceneStore implements SceneDocStore {
  readonly rows = new Map<string, Row>();
  readonly events: string[];
  constructor(events: string[]) { this.events = events; }
  async listAll(): Promise<Row[]> { return [...this.rows.values()]; }
  async load(id: string): Promise<string | null> { return this.rows.get(id)?.stateBase64 ?? null; }
  async save(id: string, stateBase64: string): Promise<void> {
    this.events.push("persist"); this.rows.set(id, { id, stateBase64, updatedAt: null });
  }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(id: string): Promise<void> { this.rows.delete(id); }
}

class EmptyBoardStore implements BoardDocStore {
  async listAll(): Promise<Row[]> { return []; }
  async load(): Promise<string | null> { return null; }
  async save(): Promise<void> { return; }
}

class MemoryEpochStore implements AppliedEpochStore {
  value: Record<string, EpochStamp> = {};
  async load(): Promise<Record<string, EpochStamp>> { return { ...this.value }; }
  async save(value: Record<string, EpochStamp>): Promise<void> { this.value = { ...value }; }
}

class FakeProvider implements SyncProvider {
  readonly sent: Uint8Array[] = [];
  private connection: ((state: ConnectionState) => void) | null = null;
  private frames: ((blob: Uint8Array) => void) | null = null;
  connect(): void { this.connection?.("connected"); }
  destroy(): void { this.connection?.("disconnected"); }
  send(blob: Uint8Array): void { this.sent.push(blob); }
  subscribeConnection(cb: (state: ConnectionState) => void): () => void {
    this.connection = cb; cb("disconnected"); return () => undefined;
  }
  subscribeFrames(cb: (blob: Uint8Array) => void): () => void {
    this.frames = cb; return () => undefined;
  }
  receive(blob: Uint8Array): void { this.frames?.(blob); }
  setConnection(state: ConnectionState): void { this.connection?.(state); }
}

function fakePort(
  events: string[] = [], flushResult: LiveSceneFlushResult = { status: "flushed" },
): EngineLiveScenePort {
  return {
    applyRemoteUpdate: vi.fn(async () => { events.push("remote"); }),
    flushLocal: vi.fn(async () => { events.push("flush"); return flushResult; }),
    replaceFromState: vi.fn(async () => { events.push("replace"); }),
  };
}

async function makeHarness(epoch = 0, appliedEpoch = epoch) {
  const events: string[] = []; const sceneStore = new MemorySceneStore(events);
  sceneStore.rows.set(SCENE_ID, { id: SCENE_ID, stateBase64: encodeDoc(textDoc("stored")), updatedAt: null });
  const metaStore = new InMemoryProjectMetaDocStore(); const epochStore = new MemoryEpochStore();
  if (epoch > 0) {
    const meta = new Y.Doc(); bumpEpoch(meta, SCENE_ID, "device-a");
    await metaStore.save("project-1", encodeDoc(meta));
  }
  if (appliedEpoch > 0) {
    epochStore.value[SCENE_ID] = { n: appliedEpoch, d: "device-a" };
  }
  const provider = new FakeProvider();
  const engine = new SyncEngine({
    relayUrl: "wss://relay.test", sceneStore, boardStore: new EmptyBoardStore(),
    metaStore, epochStore, readMasterKey: () => Promise.resolve(MASTER_KEY),
    getDeviceId: () => Promise.resolve("device-b"), providerFactory: () => provider,
    updateWordCount: () => Promise.resolve(), saveDebounceMs: 0,
  });
  await engine.start(); provider.sent.length = 0;
  return { engine, provider, sceneStore, epochStore, events };
}

function textDoc(text: string): Y.Doc {
  const doc = new Y.Doc(); doc.getText("content").insert(0, text); return doc;
}

async function frames(provider: FakeProvider): Promise<InnerMessage[]> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  return Promise.all(provider.sent.map(async (blob) => await openMessage(key, blob))) as Promise<InnerMessage[]>;
}

async function deliver(provider: FakeProvider, message: InnerMessage): Promise<void> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  provider.receive(await sealMessage(key, message));
}

describe("SyncEngine live-scene port seam", () => {
  it("publishes port updates through the encrypted live path with the current epoch", async () => {
    const ctx = await makeHarness(1); const port = fakePort();
    ctx.engine.attachLiveScenePort(SCENE_ID, port);
    const update = Y.encodeStateAsUpdate(textDoc("local"));
    await ctx.engine.publishLiveUpdate(SCENE_ID, update);
    await vi.waitFor(() => expect(ctx.provider.sent).toHaveLength(1));
    expect((await frames(ctx.provider))[0]).toMatchObject({
      t: "live", c: `scene:${SCENE_ID}`, u: fromUint8Array(update), e: 1,
    });
    ctx.engine.stop();
  });

  it("delegates a normal remote scene update to the attached port", async () => {
    const ctx = await makeHarness(); const port = fakePort();
    ctx.engine.attachLiveScenePort(SCENE_ID, port);
    const update = Y.encodeStateAsUpdate(textDoc("remote"));
    await deliver(ctx.provider, { t: "live", c: `scene:${SCENE_ID}`, u: fromUint8Array(update) });
    await vi.waitFor(() => expect(port.applyRemoteUpdate).toHaveBeenCalledWith(update));
    expect(ctx.events).not.toContain("persist");
    ctx.engine.stop();
  });

  it("flushes then persists and replaces on an epoch advance even after timeout", async () => {
    const ctx = await makeHarness(1, 0);
    const port = fakePort(ctx.events, { status: "timed-out", pendingLocal: true });
    ctx.engine.attachLiveScenePort(SCENE_ID, port);
    const replacement = encodeDoc(textDoc("replacement"));
    await deliver(ctx.provider, {
      t: "diff", c: `scene:${SCENE_ID}`, e: 1, u: replacement,
    });
    await vi.waitFor(() => expect(port.replaceFromState).toHaveBeenCalledWith(replacement));
    expect(ctx.events.slice(0, 3)).toEqual(["flush", "persist", "replace"]);
    expect(ctx.epochStore.value[SCENE_ID]).toEqual({ n: 1, d: "device-a" });
    ctx.engine.stop();
  });

  it("rejects stale-scene publishes after another port becomes active", async () => {
    const ctx = await makeHarness(); const stale = fakePort(); const active = fakePort();
    ctx.engine.attachLiveScenePort("stale", stale);
    ctx.engine.attachLiveScenePort(SCENE_ID, active);
    await ctx.engine.publishLiveUpdate("stale", Y.encodeStateAsUpdate(textDoc("wrong")));
    expect(ctx.provider.sent).toHaveLength(0);
    ctx.engine.stop();
  });

  it("suppresses port publishing while paused or disconnected", async () => {
    const ctx = await makeHarness(); const port = fakePort();
    ctx.engine.attachLiveScenePort(SCENE_ID, port); ctx.engine.pause();
    await ctx.engine.publishLiveUpdate(SCENE_ID, Y.encodeStateAsUpdate(textDoc("paused")));
    ctx.engine.resume(); ctx.provider.setConnection("disconnected");
    await ctx.engine.publishLiveUpdate(SCENE_ID, Y.encodeStateAsUpdate(textDoc("offline")));
    expect(ctx.provider.sent).toHaveLength(0);
    ctx.engine.stop();
  });

  it("withholds targeted full saves for a port-attached scene", async () => {
    const ctx = await makeHarness(); const port = fakePort();
    ctx.engine.attachLiveScenePort(SCENE_ID, port);
    ctx.engine.notifyLocalSave(SCENE_ID);
    await vi.waitFor(async () => {
      expect((await frames(ctx.provider)).some((frame) => frame.t === "hello")).toBe(true);
    });
    expect((await frames(ctx.provider)).some((frame) => frame.t === "diff")).toBe(false);
    ctx.engine.stop();
  });

  it("keeps desktop live-doc behavior mutually exclusive with the port", async () => {
    const ctx = await makeHarness(); const port = fakePort(); const doc = new Y.Doc();
    ctx.engine.attachLiveScenePort(SCENE_ID, port);
    ctx.engine.attachLiveDoc(SCENE_ID, doc);
    const update = Y.encodeStateAsUpdate(textDoc("desktop remote"));
    await deliver(ctx.provider, { t: "live", c: `scene:${SCENE_ID}`, u: fromUint8Array(update) });
    await vi.waitFor(() => expect(Y.encodeStateVector(doc)).not.toEqual(Y.encodeStateVector(new Y.Doc())));
    expect(port.applyRemoteUpdate).not.toHaveBeenCalled();
    ctx.engine.stop();
  });
});
