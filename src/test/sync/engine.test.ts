import { fromUint8Array } from "js-base64";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import { runMigrations } from "../../db/migrations";
import { InMemoryProjectMetaDocStore } from "../../db/projectMetaDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { SqliteSyncOutboxStore } from "../../db/sqliteSyncOutboxStore";
import { SyncEngine, type SyncProvider } from "../../sync/engine";
import { openMessage, sealMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import { registerLwwDomains } from "../../sync/lwwDomains";
import type { InnerMessage } from "../../sync/messages";
import { buildFromSql, getScenes } from "../../sync/meta/metaDoc";
import type { ConnectionState } from "../../sync/provider";
import { SYNC_ORIGIN } from "../../yjs/bindPersistence";
import { encodeDoc, extractPlainText } from "../../yjs/serialize";
import { makeSqlJsDb } from "../support/sqljsDb";

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

  it("loads and persists last-peer-seen when a hello proves presence", async () => {
    const provider = new FakeProvider(); const saveSeen = vi.fn().mockResolvedValue(undefined);
    const engine = new SyncEngine({
      relayUrl: "wss://relay.test", sceneStore: new MemorySceneStore(),
      boardStore: new MemoryBoardStore(), readMasterKey: () => Promise.resolve(MASTER_KEY),
      getDeviceId: () => Promise.resolve("device-a"), providerFactory: () => provider,
      updateWordCount: () => Promise.resolve(),
      loadLastPeerSeenAt: () => Promise.resolve("2026-01-01T00:00:00.000Z"),
      saveLastPeerSeenAt: saveSeen,
    });
    await engine.start(); await waitForSent(provider);
    expect(engine.status()).toMatchObject({
      lastPeerSeenAt: "2026-01-01T00:00:00.000Z",
      queue: { scenes: 0, notes: 0, boards: 0, rows: 0 }, behind: [],
    });
    await deliver(provider, { t: "hello", device: "device-b", docs: [] });
    await vi.waitFor(() => expect(saveSeen).toHaveBeenCalledOnce());
    expect(engine.status().peerSeen).toBe(true);
    engine.stop();
  });

  it("routes an encrypted credential offer to mobile and returns its ACK", async () => {
    const { engine, provider } = makeEngine();
    const consume = vi.fn(async (offer: Extract<InnerMessage, { t: "credential-offer" }>) => ({
      t: "credential-ack" as const, id: offer.id, accepted: true,
    }));
    engine.onCredentialOffer(consume);
    await engine.start(); await waitForSent(provider); provider.sent.length = 0;

    const offer: Extract<InnerMessage, { t: "credential-offer" }> = {
      t: "credential-offer", id: "offer-1", managed: {
        aiLicenseKey: "managed-license", aiModel: "model", aiEnabled: true,
      },
    };
    await deliver(provider, offer);
    await waitForSent(provider);

    expect(consume).toHaveBeenCalledWith(offer);
    expect(await decodeSent(provider)).toEqual([
      { t: "credential-ack", id: "offer-1", accepted: true },
    ]);
    engine.stop();
  });

  it("sends exactly one encrypted managed credential offer and reports its ACK", async () => {
    const { engine, provider } = makeEngine();
    const receiveAck = vi.fn();
    engine.onCredentialAck(receiveAck);
    await engine.start(); await waitForSent(provider); provider.sent.length = 0;

    const id = await engine.sendCredentialOffer({
      aiTrialKey: "managed-trial", aiModel: "model", aiEnabled: false,
    });
    await waitForSent(provider);
    const sent = await decodeSent(provider);
    expect(sent).toEqual([{ t: "credential-offer", id, managed: {
      aiTrialKey: "managed-trial", aiModel: "model", aiEnabled: false,
    } }]);

    await deliver(provider, { t: "credential-ack", id: id!, accepted: true });
    await vi.waitFor(() => expect(receiveAck).toHaveBeenCalledWith({
      t: "credential-ack", id, accepted: true,
    }));
    engine.stop();
  });

  it("bootstraps meta and Bible docs before reading the master key", async () => {
    const ready = new Set<string>();
    const engine = new SyncEngine({
      relayUrl: "wss://relay.test", sceneStore: new MemorySceneStore(),
      boardStore: new MemoryBoardStore(), ensureProjectMetas: async () => { ready.add("meta"); },
      ensureProjectBibles: async () => { ready.add("bible"); },
      readMasterKey: async () => {
        expect([...ready].sort()).toEqual(["bible", "meta"]); return null;
      },
      getDeviceId: async () => "device-a", providerFactory: () => new FakeProvider(),
      updateWordCount: async () => undefined,
    });
    await engine.start(); expect(engine.status().state).toBe("off");
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

  it("keeps scene and meta convergence with a v1.2-shaped peer", async () => {
    const provider = new FakeProvider(); const scenes = new MemorySceneStore();
    const metas = new InMemoryProjectMetaDocStore();
    seed(scenes, "s1", textDoc("v1.3 scene"));
    await metas.save("p1", encodeDoc(buildFromSql({
      project: { id: "p1", title: "Compatible", type: "novel" }, folders: [],
      scenes: [{ id: "s1", project_id: "p1", folder_id: null, title: "Opening",
        synopsis: null, status: "draft", sort_order: 1000 }], labels: [], sceneLabels: [],
    })));
    const engine = new SyncEngine({
      relayUrl: "wss://relay.test", sceneStore: scenes, boardStore: new MemoryBoardStore(),
      metaStore: metas, readMasterKey: () => Promise.resolve(MASTER_KEY),
      getDeviceId: () => Promise.resolve("v13"), providerFactory: () => provider,
      updateWordCount: () => Promise.resolve(),
    });
    await engine.start(); await waitForSent(provider); provider.sent.length = 0;
    // No capabilities field: exactly the hello shape emitted by v1.2.
    await deliver(provider, { t: "hello", device: "v12", docs: [] });
    await vi.waitFor(async () => expect((await decodeSent(provider)).length).toBe(2));
    const v12Scene = new Y.Doc(); const v12Meta = new Y.Doc();
    for (const message of await decodeSent(provider)) {
      if (message.t !== "diff") continue;
      if (message.c === "scene:s1") Y.applyUpdate(v12Scene, toUpdate(message.u));
      if (message.c === "meta:p1") Y.applyUpdate(v12Meta, toUpdate(message.u));
    }
    expect(extractPlainText(v12Scene)).toBe("v1.3 scene");
    expect(getScenes(v12Meta)[0]).toMatchObject({ id: "s1", title: "Opening" });
    engine.stop();
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
    // Two notifies collapse into ONE flush — which is now a pair: the hello that
    // advertises, plus the content frame that actually delivers it (a hello alone
    // left the peer waiting for its own 60s sweep). Four frames would mean the
    // debounce broke.
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ t: "hello", docs: [{ c: "scene:saved" }] });
    expect(sent[1]).toMatchObject({ t: "diff", c: "scene:saved" });
    engine.stop();
  });

  it("does not flush queued AI rows after conversation sync is disabled", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    const registry = new LwwDomainRegistry();
    const domains = registerLwwDomains(registry, db, { aiConversationsEnabled: true });
    const adapter = registry.get("ai_conversations")!;
    await adapter.projectReceived("conversation:c1", "p1", JSON.stringify({
      id: "c1", project_id: "p1", title: "private prompt", last_verb: null,
      boundary_chapter_id: null, context_config: null, created_at: 1, updated_at: 1,
    }));
    await adapter.projectReceived("message:m1", "p1", JSON.stringify({
      id: "m1", conversation_id: "c1", role: "you", verb: "ask",
      body: "private prompt body", context_json: null, credits_cost: null, created_at: 2,
    }));
    const provider = new FakeProvider();
    const engine = new SyncEngine({
      relayUrl: "wss://relay.test", sceneStore: new MemorySceneStore(),
      boardStore: new MemoryBoardStore(), lwwRegistry: registry,
      lwwStore: new SqliteSyncLwwStore(db), outboxStore: new SqliteSyncOutboxStore(db),
      readMasterKey: () => Promise.resolve(MASTER_KEY),
      getDeviceId: () => Promise.resolve("device-a"), providerFactory: () => provider,
      updateWordCount: () => Promise.resolve(),
    });
    expect(await engine.publishRow({ domain: "ai_conversations", projectId: "p1",
      rowId: "conversation:c1", deleted: false })).toBe(true);
    expect(await engine.publishRow({ domain: "ai_conversations", projectId: "p1",
      rowId: "message:m1", deleted: false })).toBe(true);
    const pending = await new SqliteSyncOutboxStore(db).listPending();
    expect(pending).toHaveLength(2);
    expect(pending.every(({ payload }) => payload?.includes('"device":"device-a"'))).toBe(true);
    domains.setAiConversationsEnabled(false);

    await engine.start(); await waitForSent(provider); await flush();
    const sent = await decodeSent(provider);
    expect(sent.filter((message) => message.t === "row"
      && message.domain === "ai_conversations")).toHaveLength(0);
    expect(sent.filter((message) => message.t === "row-hello"
      && message.domain === "ai_conversations")).toHaveLength(0);
    engine.stop(); db.close();
  });
});

function toUpdate(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
