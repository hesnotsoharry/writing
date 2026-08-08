import { fromUint8Array } from "js-base64";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import { InMemorySnapshotStore } from "../../db/inMemorySnapshotStore";
import { InMemoryProjectMetaDocStore } from "../../db/projectMetaDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import type { AppliedEpochStore } from "../../db/syncEpochStore";
import { SyncEngine, type SyncProvider } from "../../sync/engine";
import { openMessage, sealMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import type { InnerMessage } from "../../sync/messages";
import type { MetaApplyTarget } from "../../sync/meta/applyExec";
import type { SqlFolderRow, SqlProjectionSnapshot, SqlSceneRow } from "../../sync/meta/applyPlan";
import { buildFromSql, bumpEpoch, type MetaProject, setFolder } from "../../sync/meta/metaDoc";
import type { ConnectionState } from "../../sync/provider";
import { applyEncoded, encodeDoc, extractPlainText } from "../../yjs/serialize";

interface Row { id: string; stateBase64: string; updatedAt: string | null }
const MASTER_KEY = new Uint8Array(32).fill(9);

class MemorySceneStore implements SceneDocStore {
  readonly rows = new Map<string, Row>();
  saveCount = 0;
  async listAll(): Promise<Row[]> { return [...this.rows.values()]; }
  async load(id: string): Promise<string | null> { return this.rows.get(id)?.stateBase64 ?? null; }
  async save(id: string, stateBase64: string): Promise<void> {
    this.saveCount += 1; this.rows.set(id, { id, stateBase64, updatedAt: null });
  }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(id: string): Promise<void> { this.rows.delete(id); }
}

class EmptyBoardStore implements BoardDocStore {
  async listAll(): Promise<Row[]> { return []; }
  async load(): Promise<string | null> { return null; }
  async save(): Promise<void> { return; }
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
}

class MemoryEpochStore implements AppliedEpochStore {
  value: Record<string, number> = {};
  async load(): Promise<Record<string, number>> { return { ...this.value }; }
  async save(value: Record<string, number>): Promise<void> { this.value = { ...value }; }
}

class MemoryMetaTarget implements MetaApplyTarget {
  readonly snapshot: SqlProjectionSnapshot = { folders: [], scenes: [], labels: [], sceneLabels: [] };
  project: MetaProject | null = null;
  async ensureProject(project: MetaProject): Promise<void> { this.project = project; }
  async load(): Promise<SqlProjectionSnapshot> { return this.snapshot; }
  async upsertFolder(row: SqlFolderRow): Promise<void> { this.snapshot.folders.push(row); }
  async upsertScene(row: SqlSceneRow): Promise<void> { this.snapshot.scenes.push(row); }
  async applyLabel(): Promise<void> { return; }
  async delete(): Promise<void> { return; }
  async rewriteSort(): Promise<void> { return; }
}

function textDoc(text: string): Y.Doc {
  const doc = new Y.Doc(); const paragraph = new Y.XmlElement("paragraph");
  const value = new Y.XmlText(); value.insert(0, text); paragraph.insert(0, [value]);
  doc.getXmlFragment("content").insert(0, [paragraph]); return doc;
}

function metaDoc(epoch = 0): Y.Doc {
  const doc = buildFromSql({
    project: { id: "project-1", title: "Remote Project", type: "novel" },
    folders: [], scenes: [], labels: [], sceneLabels: [],
  });
  setFolder(doc, { id: "folder-1", projectId: "project-1", title: "Remote", sortKey: "a0" });
  if (epoch > 0) bumpEpoch(doc, "scene-1");
  return doc;
}

interface EngineOverrides {
  subscribeMetaSaves?: (
    cb: (projectId: string, epochs: Record<string, number>) => void
  ) => () => void;
  saveDebounceMs?: number;
}

function makeEngine(
  meta: Y.Doc, scene = textDoc("local divergence"), overrides: EngineOverrides = {}
) {
  const provider = new FakeProvider(); const sceneStore = new MemorySceneStore();
  const metaStore = new InMemoryProjectMetaDocStore(); const epochs = new MemoryEpochStore();
  const snapshots = new InMemorySnapshotStore(); const target = new MemoryMetaTarget();
  sceneStore.rows.set("scene-1", { id: "scene-1", stateBase64: encodeDoc(scene), updatedAt: null });
  void metaStore.save("project-1", encodeDoc(meta));
  const engine = new SyncEngine({
    relayUrl: "wss://relay.test", sceneStore, boardStore: new EmptyBoardStore(), metaStore,
    metaApplyTarget: target, snapshotStore: snapshots, epochStore: epochs,
    ensureProjectMetas: () => Promise.resolve(), readMasterKey: () => Promise.resolve(MASTER_KEY),
    getDeviceId: () => Promise.resolve("device-b"), providerFactory: () => provider,
    updateWordCount: () => Promise.resolve(),
    ...overrides,
  });
  return { engine, provider, sceneStore, metaStore, epochs, snapshots, target };
}

async function deliver(provider: FakeProvider, message: InnerMessage): Promise<void> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  provider.receive(await sealMessage(key, message));
  await vi.waitFor(async () => {
    const sent = await Promise.all(provider.sent.map((blob) => openMessage(key, blob)));
    expect(sent.length).toBeGreaterThan(0);
  });
}

describe("SyncEngine meta and epoch enforcement", () => {
  it("applies remote meta structure and fires onStructureChanged", async () => {
    const local = buildFromSql({ folders: [], scenes: [], labels: [], sceneLabels: [] });
    const ctx = makeEngine(local); const changed = vi.fn(); ctx.engine.onStructureChanged(changed);
    await ctx.engine.start();
    await deliver(ctx.provider, {
      t: "diff", c: "meta:project-1", u: fromUint8Array(Y.encodeStateAsUpdate(metaDoc())),
    });
    await vi.waitFor(() => expect(ctx.target.snapshot.folders[0]?.title).toBe("Remote"));
    expect(ctx.target.project?.title).toBe("Remote Project");
    expect(changed).toHaveBeenCalledOnce(); ctx.engine.stop();
  });

  it("snapshots, replaces wholesale, persists epoch, and ignores stale live", async () => {
    const ctx = makeEngine(metaDoc(1)); await ctx.engine.start();
    await deliver(ctx.provider, {
      t: "diff", c: "scene:scene-1", e: 1,
      u: fromUint8Array(Y.encodeStateAsUpdate(textDoc("restored state"))),
    });
    await vi.waitFor(() => expect(ctx.epochs.value["scene-1"]).toBe(1));
    const stored = new Y.Doc(); applyEncoded(stored, (await ctx.sceneStore.load("scene-1"))!);
    expect(extractPlainText(stored)).toBe("restored state");
    expect(await ctx.snapshots.listSnapshots("scene-1")).toHaveLength(1);
    const saves = ctx.sceneStore.saveCount;
    await deliver(ctx.provider, {
      t: "live", c: "scene:scene-1", e: 0,
      u: fromUint8Array(Y.encodeStateAsUpdate(textDoc("stale"))),
    });
    await deliver(ctx.provider, {
      t: "diff", c: "scene:scene-1",
      u: fromUint8Array(Y.encodeStateAsUpdate(textDoc("epoch-less stale"))),
    });
    expect(ctx.sceneStore.saveCount).toBe(saves); ctx.engine.stop();
  });

  it("reloads an open epoch-replaced scene without mutating its live doc", async () => {
    const ctx = makeEngine(metaDoc(1)); const open = textDoc("live divergence");
    const replaced = vi.fn(); ctx.engine.onDocReplaced(replaced);
    await ctx.engine.start(); ctx.engine.attachLiveDoc("scene-1", open);
    await deliver(ctx.provider, {
      t: "diff", c: "scene:scene-1", e: 1,
      u: fromUint8Array(Y.encodeStateAsUpdate(textDoc("remote restore"))),
    });
    await vi.waitFor(() => expect(replaced).toHaveBeenCalledWith("scene-1"));
    expect(extractPlainText(open)).toBe("live divergence"); ctx.engine.stop();
  });

  // Regression: a behind device used to answer the sweep with the very content
  // the restore discarded, stamped at the NEW epoch — which the restoring peer
  // accepts (accepts() cannot tell the copies apart), merging it back in and
  // silently undoing the restore. Observed live desktop↔desktop 2026-08-07.
  it("does not publish a scene it is behind on", async () => {
    const ctx = makeEngine(metaDoc(1), textDoc("content the restore discarded"));
    await ctx.engine.start();
    const key = (await deriveKeys(MASTER_KEY)).encKey;
    ctx.provider.sent.length = 0;

    await deliver(ctx.provider, {
      t: "hello", device: "peer-a",
      docs: [{ c: "scene:scene-1", sv: fromUint8Array(Y.encodeStateVector(new Y.Doc())), at: null }],
    });
    // deliver() resolves on the FIRST frame; answerHello walks every doc, so wait
    // for it to finish or "no scene push" would pass vacuously.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const frames = async () => Promise.all(
      ctx.provider.sent.map((blob) => openMessage(key, blob) as Promise<{ t: string; c?: string }>)
    );
    const sent = await frames();
    // Positive control: the engine DID answer (meta is not epoch-gated).
    expect(sent.some((frame) => frame.c === "meta:project-1")).toBe(true);
    expect(sent.filter((frame) => frame.c === "scene:scene-1")).toHaveLength(0);
    ctx.engine.stop();
  });

  it("does not publish live edits for a scene it is behind on", async () => {
    const ctx = makeEngine(metaDoc(1)); const open = textDoc("stale local");
    await ctx.engine.start(); ctx.engine.attachLiveDoc("scene-1", open);
    const key = (await deriveKeys(MASTER_KEY)).encKey;
    ctx.provider.sent.length = 0;

    open.getXmlFragment("content").push([new Y.XmlElement("paragraph")]);
    // The publish path is async (sealMessage); give it room to land a frame so
    // an empty `sent` means "suppressed", not "not flushed yet".
    await new Promise((resolve) => setTimeout(resolve, 100));

    const sent = await Promise.all(ctx.provider.sent.map((blob) => openMessage(key, blob)));
    expect(sent.filter((message) => (message as { t: string }).t === "live")).toHaveLength(0);
    ctx.engine.stop();
  });

  // Regression: a local structure change (reorder) used to reach the peer only on
  // its own 60s sweep, because a targeted hello advertises a state vector and
  // answerHello replies with what the PEER lacks — nobody ever pushed ours.
  it("pushes meta content on a local save rather than only advertising", async () => {
    let notify: ((projectId: string, epochs: Record<string, number>) => void) | null = null;
    const ctx = makeEngine(metaDoc(), textDoc("scene"), {
      subscribeMetaSaves: (cb) => { notify = cb; return () => undefined; },
      saveDebounceMs: 10,
    });
    await ctx.engine.start();
    const key = (await deriveKeys(MASTER_KEY)).encKey;
    ctx.provider.sent.length = 0;

    expect(notify).not.toBeNull();
    notify!("project-1", {});

    await vi.waitFor(async () => {
      const sent = await Promise.all(
        ctx.provider.sent.map((blob) => openMessage(key, blob) as Promise<{ t: string; c?: string }>)
      );
      expect(sent.some((frame) => frame.t === "diff" && frame.c === "meta:project-1")).toBe(true);
    });
    ctx.engine.stop();
  });
});
