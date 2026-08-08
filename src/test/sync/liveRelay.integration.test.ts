/**
 * Opt-in end-to-end integration: two real SyncEngines (real RelayProvider, real
 * crypto) against a LIVE relay worker. Skipped unless SYNC_LIVE_RELAY is set —
 * start the relay first:  cd relay-worker && npx wrangler dev --port 8788
 * then:  SYNC_LIVE_RELAY=ws://127.0.0.1:8788 npm run test -- liveRelay
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import { InMemorySnapshotStore } from "../../db/inMemorySnapshotStore";
import { InMemoryProjectMetaDocStore } from "../../db/projectMetaDocStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import type { AppliedEpochStore } from "../../db/syncEpochStore";
import { SyncEngine } from "../../sync/engine";
import { generateMasterKey } from "../../sync/keys";
import type { MetaApplyTarget } from "../../sync/meta/applyExec";
import type {
  SortOrderRewrite, SqlFolderRow, SqlProjectionSnapshot, SqlSceneRow,
} from "../../sync/meta/applyPlan";
import {
  buildFromSql, bumpEpoch, type EpochStamp, getDocEpochs, getScenes, type MetaProject, setScene,
} from "../../sync/meta/metaDoc";
import { RelayProvider } from "../../sync/provider";
import { applyEncoded, encodeDoc, extractPlainText } from "../../yjs/serialize";

const RELAY_URL = process.env.SYNC_LIVE_RELAY;

class MemoryDocStore implements SceneDocStore, BoardDocStore {
  readonly rows = new Map<string, { stateBase64: string; updatedAt: string | null }>();

  async load(id: string): Promise<string | null> {
    return this.rows.get(id)?.stateBase64 ?? null;
  }
  async save(id: string, base64: string): Promise<void> {
    this.rows.set(id, { stateBase64: base64, updatedAt: new Date().toISOString() });
  }
  async loadProjection(): Promise<string | null> {
    return null;
  }
  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    return [...this.rows.entries()].map(([id, r]) => ({ id, ...r }));
  }
}

class MemoryEpochStore implements AppliedEpochStore {
  value: Record<string, EpochStamp> = {};
  async load(): Promise<Record<string, EpochStamp>> { return { ...this.value }; }
  async save(value: Record<string, EpochStamp>): Promise<void> { this.value = { ...value }; }
}

function replaceById<T extends { id: string }>(rows: T[], row: T): void {
  const index = rows.findIndex(({ id }) => id === row.id);
  if (index < 0) rows.push(row);
  else rows[index] = row;
}

class MemoryMetaTarget implements MetaApplyTarget {
  project: MetaProject | null = null;
  readonly snapshot: SqlProjectionSnapshot = { folders: [], scenes: [], labels: [], sceneLabels: [] };
  async ensureProject(project: MetaProject): Promise<void> { this.project = project; }
  async load(): Promise<SqlProjectionSnapshot> {
    return {
      folders: this.snapshot.folders.map((row) => ({ ...row })),
      scenes: this.snapshot.scenes.map((row) => ({ ...row })),
      labels: this.snapshot.labels.map((row) => ({ ...row })),
      sceneLabels: this.snapshot.sceneLabels.map((row) => ({ ...row })),
    };
  }
  async upsertFolder(row: SqlFolderRow): Promise<void> { replaceById(this.snapshot.folders, row); }
  async upsertScene(row: SqlSceneRow): Promise<void> { replaceById(this.snapshot.scenes, row); }
  async applyLabel(): Promise<void> { return; }
  async delete(): Promise<void> { return; }
  async rewriteSort(op: SortOrderRewrite): Promise<void> {
    if (op.kind === "label") {
      const row = this.snapshot.labels.find(({ id }) => id === op.id);
      if (row) row.sort = op.sortOrder;
      return;
    }
    const rows: Array<{ id: string; sort_order: number }> = op.kind === "folder"
      ? this.snapshot.folders : this.snapshot.scenes;
    const row = rows.find(({ id }) => id === op.id);
    if (row) row.sort_order = op.sortOrder;
  }
}

function sceneDocWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  paragraph.insert(0, [t]);
  doc.getXmlFragment("content").push([paragraph]);
  return doc;
}

type MetaSaveListener = (projectId: string, epochs: Record<string, EpochStamp>) => void;

interface EngineMemory {
  metaStore?: InMemoryProjectMetaDocStore;
  metaTarget?: MemoryMetaTarget;
  snapshots?: InMemorySnapshotStore;
  epochs?: MemoryEpochStore;
  metaSaves?: { listener: MetaSaveListener | null };
  /** Long value = "if this converges, it was pushed, not swept". */
  sweepMs?: number;
}

function makeEngine(
  deviceId: string, masterKey: Uint8Array, sceneStore: MemoryDocStore,
  memory: EngineMemory = {}
) {
  return new SyncEngine({
    relayUrl: RELAY_URL as string,
    sceneStore,
    boardStore: new MemoryDocStore(),
    metaStore: memory.metaStore,
    metaApplyTarget: memory.metaTarget,
    snapshotStore: memory.snapshots,
    epochStore: memory.epochs,
    subscribeMetaSaves: memory.metaSaves ? (listener) => {
      memory.metaSaves!.listener = listener;
      return () => { memory.metaSaves!.listener = null; };
    } : undefined,
    readMasterKey: async () => masterKey,
    getDeviceId: async () => deviceId,
    providerFactory: (url, room, device) => new RelayProvider(url, room, device),
    updateWordCount: async () => undefined,
    sweepMs: memory.sweepMs ?? 2_000,
    saveDebounceMs: 100,
  });
}

async function until(check: () => boolean | Promise<boolean>, ms = 15_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("condition not met in time");
}

describe.runIf(RELAY_URL)("live relay end-to-end", () => {
  it("converges a fresh peer and streams live edits", async () => {
    const masterKey = generateMasterKey();
    const storeA = new MemoryDocStore();
    const storeB = new MemoryDocStore();

    const docA = sceneDocWithText("hello from A");
    await storeA.save("s1", encodeDoc(docA));

    const engineA = makeEngine("device-A", masterKey, storeA);
    const engineB = makeEngine("device-B", masterKey, storeB);
    await engineA.start();
    await engineB.start();

    // Sweep: B (fresh) receives A's full state for s1.
    await until(() => storeB.rows.has("s1"));
    const received = new Y.Doc();
    Y.applyUpdate(received, Uint8Array.from(atob(storeB.rows.get("s1")!.stateBase64), (c) => c.charCodeAt(0)));
    expect(received.getXmlFragment("content").toString()).toContain("hello from A");

    // Live: A opens the scene and types; B's store follows.
    engineA.attachLiveDoc("s1", docA);
    (docA.getXmlFragment("content").get(0) as Y.XmlElement).push([new Y.XmlText(" and more")]);
    await until(() => {
      const row = storeB.rows.get("s1");
      if (!row) return false;
      const d = new Y.Doc();
      Y.applyUpdate(d, Uint8Array.from(atob(row.stateBase64), (c) => c.charCodeAt(0)));
      return d.getXmlFragment("content").toString().includes("and more");
    });

    engineA.stop();
    engineB.stop();
  }, 30_000);

  // A write to a scene that is NOT open has no live channel, so before the
  // localSceneWrites bridge it reached the peer only when that peer's next hello
  // sweep came asking. The 60s sweep here is the point: if this converges, it
  // converged because the write was PUSHED, not because anything swept.
  it("pushes a closed-scene local write without waiting for a sweep", async () => {
    const masterKey = generateMasterKey();
    const storeA = new MemoryDocStore();
    const storeB = new MemoryDocStore();
    await storeA.save("s1", encodeDoc(sceneDocWithText("before")));

    const engineA = makeEngine("device-A", masterKey, storeA, { sweepMs: 60_000 });
    const engineB = makeEngine("device-B", masterKey, storeB, { sweepMs: 60_000 });
    await engineA.start();
    await engineB.start();
    await until(() => storeB.rows.has("s1"));

    // Rewrite s1 while it is closed (no attachLiveDoc), exactly as Replace-All and
    // note-promotion do, then fire the bridge notification those paths now send.
    await storeA.save("s1", encodeDoc(sceneDocWithText("closed-scene rewrite")));
    const startedAt = Date.now();
    engineA.notifyLocalSave("s1");

    await until(() => {
      const row = storeB.rows.get("s1");
      if (!row) return false;
      const doc = new Y.Doc();
      Y.applyUpdate(doc, Uint8Array.from(atob(row.stateBase64), (c) => c.charCodeAt(0)));
      return doc.getXmlFragment("content").toString().includes("closed-scene rewrite");
    }, 20_000);
    const elapsed = Date.now() - startedAt;
    // Comfortably inside one sweep; the debounce alone is 100ms here.
    expect(elapsed).toBeLessThan(10_000);

    engineA.stop();
    engineB.stop();
  }, 40_000);

  it("clones project structure and converges live rename and reorder changes", async () => {
    const masterKey = generateMasterKey();
    const storeA = new MemoryDocStore();
    const storeB = new MemoryDocStore();
    const metaA = new InMemoryProjectMetaDocStore();
    const metaB = new InMemoryProjectMetaDocStore();
    const targetB = new MemoryMetaTarget();
    const initial = buildFromSql({
      project: { id: "p1", title: "Relay Novel", type: "novel" },
      folders: [{ id: "f1", project_id: "p1", title: "Act One", sort_order: 1000 }],
      scenes: [
        { id: "s1", project_id: "p1", folder_id: "f1", title: "First", synopsis: null,
          status: "blank", sort_order: 1000 },
        { id: "s2", project_id: "p1", folder_id: "f1", title: "Second", synopsis: null,
          status: "blank", sort_order: 2000 },
      ],
      labels: [], sceneLabels: [],
    });
    await metaA.save("p1", encodeDoc(initial));
    const engineA = makeEngine("structure-A", masterKey, storeA, { metaStore: metaA });
    const engineB = makeEngine("structure-B", masterKey, storeB, {
      metaStore: metaB, metaTarget: targetB,
    });
    try {
      await engineA.start();
      await engineB.start();
      await until(() => targetB.project?.title === "Relay Novel"
        && targetB.snapshot.scenes.length === 2);

      const changed = new Y.Doc();
      applyEncoded(changed, (await metaA.load("p1"))!);
      const [first, second] = getScenes(changed).sort((a, b) => a.sortKey < b.sortKey ? -1 : 1);
      setScene(changed, { ...first, title: "First renamed", sortKey: second.sortKey });
      setScene(changed, { ...second, sortKey: first.sortKey });
      await metaA.save("p1", encodeDoc(changed));

      await until(() => {
        const ordered = [...targetB.snapshot.scenes].sort((a, b) => a.sort_order - b.sort_order);
        return ordered[0]?.id === "s2"
          && targetB.snapshot.scenes.find(({ id }) => id === "s1")?.title === "First renamed";
      });
    } finally {
      engineA.stop();
      engineB.stop();
    }
  }, 35_000);

  it("takes a safety snapshot and discards paused divergence after an epoch restore", async () => {
    const masterKey = generateMasterKey();
    const storeA = new MemoryDocStore();
    const storeB = new MemoryDocStore();
    const metaA = new InMemoryProjectMetaDocStore();
    const metaB = new InMemoryProjectMetaDocStore();
    const snapshotsB = new InMemorySnapshotStore();
    const epochsA = new MemoryEpochStore();
    const epochsB = new MemoryEpochStore();
    const initialMeta = buildFromSql({
      project: { id: "p1", title: "Epoch Novel", type: "novel" },
      folders: [], scenes: [], labels: [], sceneLabels: [],
    });
    await metaA.save("p1", encodeDoc(initialMeta));
    await storeA.save("s1", encodeDoc(sceneDocWithText("shared beginning")));
    let engineA = makeEngine("epoch-A", masterKey, storeA, { metaStore: metaA, epochs: epochsA });
    const engineB = makeEngine("epoch-B", masterKey, storeB, {
      metaStore: metaB, metaTarget: new MemoryMetaTarget(), snapshots: snapshotsB, epochs: epochsB,
    });
    try {
      await engineA.start();
      await engineB.start();
      await until(() => storeB.rows.has("s1") && metaB.load("p1") !== null);

      engineB.pause();
      await storeB.save("s1", encodeDoc(sceneDocWithText("paused B divergence")));
      const restoredMeta = new Y.Doc();
      applyEncoded(restoredMeta, (await metaA.load("p1"))!);
      bumpEpoch(restoredMeta, "s1", "epoch-A");
      await metaA.save("p1", encodeDoc(restoredMeta));
      await storeA.save("s1", encodeDoc(sceneDocWithText("A restored replacement")));
      epochsA.value = { s1: { n: 1, d: "epoch-A" } };
      engineA.stop();
      engineA = makeEngine("epoch-A", masterKey, storeA, { metaStore: metaA, epochs: epochsA });
      await engineA.start();
      engineB.resume();

      await until(() => epochsB.value.s1?.n === 1);
      const received = new Y.Doc();
      applyEncoded(received, (await storeB.load("s1"))!);
      expect(extractPlainText(received)).toBe("A restored replacement");
      expect(await snapshotsB.listSnapshots("s1")).toHaveLength(1);
      const [snapshot] = await snapshotsB.listSnapshots("s1");
      const savedDivergence = await snapshotsB.getSnapshot(snapshot.id);
      const diverged = new Y.Doc();
      applyEncoded(diverged, savedDivergence!.stateBase64);
      expect(extractPlainText(diverged)).toBe("paused B divergence");
    } finally {
      engineA.stop();
      engineB.stop();
    }
  }, 40_000);

  it("converges concurrent restores on the epoch owner without waiting for a sweep", async () => {
    const masterKey = generateMasterKey();
    const storeA = new MemoryDocStore(); const storeB = new MemoryDocStore();
    const metaA = new InMemoryProjectMetaDocStore();
    const metaB = new InMemoryProjectMetaDocStore();
    const epochsA = new MemoryEpochStore(); const epochsB = new MemoryEpochStore();
    const savesA: { listener: MetaSaveListener | null } = { listener: null };
    const savesB: { listener: MetaSaveListener | null } = { listener: null };
    const initial = buildFromSql({
      project: { id: "p1", title: "Concurrent Restore", type: "novel" },
      folders: [], scenes: [], labels: [], sceneLabels: [],
    });
    await metaA.save("p1", encodeDoc(initial));
    await storeA.save("s1", encodeDoc(sceneDocWithText("shared")));
    const engineA = makeEngine("restore-A", masterKey, storeA, {
      metaStore: metaA, epochs: epochsA, metaSaves: savesA, sweepMs: 60_000,
    });
    const engineB = makeEngine("restore-B", masterKey, storeB, {
      metaStore: metaB, metaTarget: new MemoryMetaTarget(), epochs: epochsB,
      metaSaves: savesB, sweepMs: 60_000,
    });
    try {
      await engineA.start(); await engineB.start();
      await until(() => storeB.rows.has("s1") && metaB.load("p1") !== null);
      engineA.pause(); engineB.pause();

      const localA = new Y.Doc(); const localB = new Y.Doc();
      applyEncoded(localA, (await metaA.load("p1"))!);
      applyEncoded(localB, (await metaB.load("p1"))!);
      const stampA = bumpEpoch(localA, "s1", "restore-A");
      const stampB = bumpEpoch(localB, "s1", "restore-B");
      await metaA.save("p1", encodeDoc(localA)); await metaB.save("p1", encodeDoc(localB));
      await storeA.save("s1", encodeDoc(sceneDocWithText("replacement A")));
      await storeB.save("s1", encodeDoc(sceneDocWithText("replacement B")));
      savesA.listener?.("p1", { s1: stampA }); savesB.listener?.("p1", { s1: stampB });
      await until(() => epochsA.value.s1?.d === "restore-A"
        && epochsB.value.s1?.d === "restore-B");
      const startedAt = Date.now();
      engineA.resume(); engineB.resume();

      await until(async () => {
        const mergedA = new Y.Doc(); const mergedB = new Y.Doc();
        applyEncoded(mergedA, (await metaA.load("p1"))!);
        applyEncoded(mergedB, (await metaB.load("p1"))!);
        const ownerA = getDocEpochs(mergedA).s1?.d;
        const ownerB = getDocEpochs(mergedB).s1?.d;
        if (!ownerA || ownerA !== ownerB) return false;
        const expected = ownerA === "restore-A" ? "replacement A" : "replacement B";
        const docA = new Y.Doc(); const docB = new Y.Doc();
        applyEncoded(docA, (await storeA.load("s1"))!);
        applyEncoded(docB, (await storeB.load("s1"))!);
        return extractPlainText(docA) === expected && extractPlainText(docB) === expected;
      }, 20_000);
      expect(Date.now() - startedAt).toBeLessThan(10_000);
    } finally {
      engineA.stop(); engineB.stop();
    }
  }, 40_000);

  it("clones a fresh mobile-shaped peer's project and scene prose from a desktop-shaped peer", async () => {
    // Mirrors mobile/src/sync/mobileEngine.ts's buildMobileEngineOptions()
    // composition (S4 blueprint step 5): every store option present except
    // `ensureProjectMetas`/`subscribeMetaSaves` — mobile is always the
    // "joined" side and never bootstraps or edits project meta locally, so
    // makeEngine's peer-B here never receives those two hooks either. Unlike
    // the "clones project structure" scenario above, this asserts scene
    // *prose* clone-down too (not just structure), and never calls
    // `attachLiveDoc` on either side — S4 mobile is read-only, no live bridge.
    const masterKey = generateMasterKey();
    const desktopScenes = new MemoryDocStore();
    const mobileScenes = new MemoryDocStore();
    const desktopMeta = new InMemoryProjectMetaDocStore();
    const mobileMeta = new InMemoryProjectMetaDocStore();
    const mobileTarget = new MemoryMetaTarget();

    await desktopScenes.save("s1", encodeDoc(sceneDocWithText("cloned from desktop")));
    const initial = buildFromSql({
      project: { id: "p1", title: "Mobile Clone Novel", type: "novel" },
      folders: [{ id: "f1", project_id: "p1", title: "Chapter One", sort_order: 1000 }],
      scenes: [{ id: "s1", project_id: "p1", folder_id: "f1", title: "Opening", synopsis: null,
        status: "draft", sort_order: 1000 }],
      labels: [], sceneLabels: [],
    });
    await desktopMeta.save("p1", encodeDoc(initial));

    const desktopEngine = makeEngine("desktop-peer", masterKey, desktopScenes, { metaStore: desktopMeta });
    const mobileEngine = makeEngine("mobile-peer", masterKey, mobileScenes, {
      metaStore: mobileMeta, metaTarget: mobileTarget,
    });
    try {
      await desktopEngine.start();
      await mobileEngine.start();

      await until(() => mobileTarget.project?.title === "Mobile Clone Novel"
        && mobileTarget.snapshot.scenes.some(({ id }) => id === "s1")
        && mobileScenes.rows.has("s1"));

      expect(mobileTarget.snapshot.folders).toEqual([
        { id: "f1", project_id: "p1", title: "Chapter One", sort_order: 1000 },
      ]);
      const clonedScene = mobileTarget.snapshot.scenes.find(({ id }) => id === "s1");
      expect(clonedScene).toMatchObject({ project_id: "p1", folder_id: "f1", title: "Opening" });

      const clonedDoc = new Y.Doc();
      applyEncoded(clonedDoc, mobileScenes.rows.get("s1")!.stateBase64);
      expect(extractPlainText(clonedDoc)).toBe("cloned from desktop");
    } finally {
      desktopEngine.stop();
      mobileEngine.stop();
    }
  }, 30_000);
});
