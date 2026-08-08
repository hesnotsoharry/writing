import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import { InMemoryProjectMetaDocStore } from "../../db/projectMetaDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import type { AppliedEpochStore } from "../../db/syncEpochStore";
import { SyncEngine, type SyncProvider } from "../../sync/engine";
import { openMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import { type InnerMessage,isInnerMessage } from "../../sync/messages";
import type { EpochStamp } from "../../sync/meta/metaDoc";
import type { ConnectionState } from "../../sync/provider";
import { encodeDoc } from "../../yjs/serialize";

interface Row { id: string; stateBase64: string; updatedAt: string | null }
const MASTER_KEY = new Uint8Array(32).fill(4);

class MemorySceneStore implements SceneDocStore {
  constructor(readonly row: Row) {}
  async listAll(): Promise<Row[]> { return [this.row]; }
  async load(id: string): Promise<string | null> {
    return id === this.row.id ? this.row.stateBase64 : null;
  }
  async save(): Promise<void> { return; }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(): Promise<void> { return; }
}

class EmptyBoardStore implements BoardDocStore {
  async listAll(): Promise<Row[]> { return []; }
  async load(): Promise<string | null> { return null; }
  async save(): Promise<void> { return; }
}

class MemoryEpochStore implements AppliedEpochStore {
  constructor(private value: Record<string, EpochStamp>) {}
  async load(): Promise<Record<string, EpochStamp>> { return { ...this.value }; }
  async save(value: Record<string, EpochStamp>): Promise<void> { this.value = { ...value }; }
}

class FakeProvider implements SyncProvider {
  readonly sent: Uint8Array[] = [];
  private connection: ((state: ConnectionState) => void) | null = null;
  connect(): void { this.connection?.("connected"); }
  destroy(): void { this.connection?.("disconnected"); }
  send(blob: Uint8Array): void { this.sent.push(blob); }
  subscribeConnection(cb: (state: ConnectionState) => void): () => void {
    this.connection = cb; cb("disconnected"); return () => undefined;
  }
  subscribeFrames(): () => void { return () => undefined; }
}

function textDoc(text: string): Y.Doc {
  const doc = new Y.Doc();
  doc.getText("content").insert(0, text);
  return doc;
}

interface HarnessOptions { knownEpoch?: number; appliedEpoch?: number }

async function makeHarness(options: HarnessOptions = {}) {
  const stateBase64 = encodeDoc(textDoc("stored local content"));
  const sceneStore = new MemorySceneStore({ id: "scene-1", stateBase64, updatedAt: null });
  const metaStore = new InMemoryProjectMetaDocStore();
  if (options.knownEpoch) {
    const meta = new Y.Doc();
    meta.getMap<number>("docEpochs").set("scene-1", options.knownEpoch);
    await metaStore.save("project-1", encodeDoc(meta));
  }
  const provider = new FakeProvider();
  let notify: ((sceneId: string) => void) | null = null;
  const engine = new SyncEngine({
    relayUrl: "wss://relay.test", sceneStore, boardStore: new EmptyBoardStore(), metaStore,
    epochStore: new MemoryEpochStore(options.appliedEpoch === undefined ? {} : {
      "scene-1": { n: options.appliedEpoch, d: "device-a" },
    }),
    subscribeSceneWrites: (cb) => { notify = cb; return () => { notify = null; }; },
    readMasterKey: () => Promise.resolve(MASTER_KEY),
    getDeviceId: () => Promise.resolve("device-a"), providerFactory: () => provider,
    updateWordCount: () => Promise.resolve(), saveDebounceMs: 0,
  });
  await engine.start(); provider.sent.length = 0;
  return {
    engine, provider, stateBase64,
    notify: () => { if (!notify) throw new Error("scene-write listener missing"); notify("scene-1"); },
  };
}

async function sentFrames(provider: FakeProvider): Promise<InnerMessage[]> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  const values = await Promise.all(provider.sent.map((blob) => openMessage(key, blob)));
  return values.filter(isInnerMessage);
}

async function waitForTargetedHello(provider: FakeProvider): Promise<void> {
  await vi.waitFor(async () => {
    const frames = await sentFrames(provider);
    expect(frames.some((frame) =>
      frame.t === "hello" && frame.docs.some((doc) => doc.c === "scene:scene-1")
    )).toBe(true);
  });
}

describe("local scene-write targeted delivery", () => {
  it("pushes the full stored closed scene with its epoch", async () => {
    const ctx = await makeHarness({ knownEpoch: 2, appliedEpoch: 2 });
    ctx.notify();
    await vi.waitFor(async () => {
      const pushed = (await sentFrames(ctx.provider)).find((frame) =>
        frame.t === "diff" && frame.c === "scene:scene-1"
      );
      expect(pushed).toMatchObject({ u: ctx.stateBase64, e: 2 });
    });
    ctx.engine.stop();
  });

  it("does not redundantly push the open scene", async () => {
    const ctx = await makeHarness();
    ctx.engine.attachLiveDoc("scene-1", textDoc("open"));
    ctx.notify(); await waitForTargetedHello(ctx.provider);
    const frames = await sentFrames(ctx.provider);
    expect(frames.some((frame) => frame.t === "diff" && frame.c === "scene:scene-1")).toBe(false);
    ctx.engine.stop();
  });

  it("does not push a scene it is behind on", async () => {
    const ctx = await makeHarness({ knownEpoch: 1 });
    ctx.notify(); await waitForTargetedHello(ctx.provider);
    const frames = await sentFrames(ctx.provider);
    expect(frames.some((frame) => frame.t === "diff" && frame.c === "scene:scene-1")).toBe(false);
    ctx.engine.stop();
  });
});
