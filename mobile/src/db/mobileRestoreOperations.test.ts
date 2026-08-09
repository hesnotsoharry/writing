/// <reference types="node" />
import { EpochManager } from "@writersnook/sync/epochManager";
import { makeSqlJsDb, type SqlJsTestDb } from "@writersnook/test/support/sqljsDb";
import { applyEncoded, encodeDoc, extractPlainText } from "@writersnook/yjs/serialize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { restoreArchivePlan } from "../features/archive/archiveRestore";
import { promoteNote } from "../features/inbox/inboxModel";
import { restoreSnapshotSafely } from "../features/snapshots/snapshotRestore";
import { runMigrations } from "../shared/migrations";
import { MobileArchiveStore } from "./mobileArchiveStore";
import { MobileBinderStore } from "./mobileBinderStore";
import { MobileEpochOwner } from "./mobileEpochOwner";
import { MobileQuickNoteStore } from "./mobileQuickNoteStore";
import { MobileScenePromotionStore } from "./mobileScenePromotionStore";
import { MobileSnapshotStore } from "./mobileSnapshotStore";
import { MobileEpochStore } from "./syncStores/mobileEpochStore";
import { MobileSceneDocStore } from "./syncStores/mobileSceneDocStore";

let db: SqlJsTestDb;
vi.mock("./database", () => ({ getMobileDb: () => Promise.resolve(db) }));

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
});

function sceneDoc(text: string): string {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  const node = new Y.XmlText(); node.insert(0, text); paragraph.insert(0, [node]);
  doc.getXmlFragment("content").push([paragraph]);
  return encodeDoc(doc);
}

function textOf(stateBase64: string): string {
  const doc = new Y.Doc(); applyEncoded(doc, stateBase64); return extractPlainText(doc);
}

async function seedProject(): Promise<{ binder: MobileBinderStore; projectId: string }> {
  const binder = new MobileBinderStore(db);
  const projectId = await binder.createProject({ title: "Novel", type: "novel" });
  return { binder, projectId };
}

describe("mobile guarded restore operations", () => {
  it("restores a single archived scene with its content intact", async () => {
    const { binder, projectId } = await seedProject();
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "One" });
    const docs = new MobileSceneDocStore(db);
    await docs.save(sceneId, sceneDoc("single scene"), null);
    await binder.archiveScene(sceneId, projectId);
    const archived = (await binder.listArchived(projectId))[0];
    await binder.restoreArchived(archived.id);
    expect(textOf((await docs.load(sceneId)) ?? "")).toBe("single scene");
  });

  it("restores one scene and a multi-scene chapter with ordered epoch handoffs", async () => {
    const { binder, projectId } = await seedProject();
    const folderId = await binder.createFolder({ projectId, title: "Chapter" });
    const sceneIds: string[] = [];
    for (const title of ["One", "Two"]) {
      const id = await binder.createScene({ projectId, folderId, title });
      await db.execute("INSERT INTO scene_docs (scene_id, state_base64) VALUES (?, ?)", [id, sceneDoc(title)]);
      sceneIds.push(id);
    }
    await binder.archiveChapter(folderId, projectId);
    const handoffs: string[] = [];
    const docs = new MobileSceneDocStore(db);
    const store = new MobileArchiveStore(db, {
      replaceThroughEpoch: async ({ sceneId, stateBase64 }) => {
        handoffs.push(sceneId); await docs.save(sceneId, stateBase64 ?? sceneDoc(""), null);
      },
    });
    const plan = await store.getRestorePlan((await store.listArchived(projectId))[0].id);
    if (!plan) throw new Error("missing restore plan");
    await restoreArchivePlan({
      publishBinderMeta: (value) => store.publishRestoredOwnership(value),
      replaceThroughEpoch: (scene, project) => store.handoffRestoredScene(scene, project),
      removeArchiveRow: async () => store.removeRestoredArchive(plan),
    }, plan);
    expect(handoffs).toEqual(sceneIds);
    expect(await Promise.all(sceneIds.map(async (id) => textOf((await docs.load(id)) ?? ""))))
      .toEqual(["One", "Two"]);
    expect(await store.listArchived(projectId)).toEqual([]);
  });

  it("keeps the archive row and completed scenes intact after a partial handoff failure", async () => {
    const { binder, projectId } = await seedProject();
    const folderId = await binder.createFolder({ projectId, title: "Chapter" });
    const first = await binder.createScene({ projectId, folderId, title: "One" });
    const second = await binder.createScene({ projectId, folderId, title: "Two" });
    await db.execute("INSERT INTO scene_docs (scene_id, state_base64) VALUES (?, ?)", [first, sceneDoc("safe one")]);
    await db.execute("INSERT INTO scene_docs (scene_id, state_base64) VALUES (?, ?)", [second, sceneDoc("safe two")]);
    await binder.archiveChapter(folderId, projectId);
    const docs = new MobileSceneDocStore(db); let calls = 0;
    const store = new MobileArchiveStore(db, { replaceThroughEpoch: async (input) => {
      calls += 1; if (calls === 2) throw new Error("handoff failed");
      await docs.save(input.sceneId, input.stateBase64 ?? sceneDoc(""), null);
    } });
    const archived = (await store.listArchived(projectId))[0];
    const plan = await store.getRestorePlan(archived.id);
    if (!plan) throw new Error("missing restore plan");
    await expect(restoreArchivePlan({
      publishBinderMeta: (value) => store.publishRestoredOwnership(value),
      replaceThroughEpoch: (scene, project) => store.handoffRestoredScene(scene, project),
      removeArchiveRow: async () => store.removeRestoredArchive(plan),
    }, plan)).rejects.toThrow("handoff failed");
    expect((await store.listArchived(projectId))[0].id).toBe(archived.id);
    expect(textOf((await docs.load(first)) ?? "")).toBe("safe one");
    expect((await binder.loadProject(projectId)).scenes.map(({ id }) => id)).toEqual([first, second]);
  });

  it("rejects stale peer bytes after restore and queues meta before replacement", async () => {
    const { binder, projectId } = await seedProject();
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "Scene" });
    const docs = new MobileSceneDocStore(db); await docs.save(sceneId, sceneDoc("restored"), null);
    const owner = new MobileEpochOwner(db, docs);
    const stamp = await owner.replaceThroughEpoch({
      projectId, sceneId, stateBase64: sceneDoc("restored"), plaintext: "restored",
    });
    const manager = new EpochManager({
      sceneStore: docs, epochStore: new MobileEpochStore(db), updateWordCount: async () => undefined,
    });
    await manager.initialize("owner");
    const metaRows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM project_meta_docs WHERE project_id = ?", [projectId],
    );
    manager.readMetaUpdate(Uint8Array.from(Buffer.from(metaRows[0].state_base64, "base64")), projectId);
    expect(stamp.n).toBe(1);
    expect(manager.accepts(sceneId, 0)).toBe(false);
    expect(textOf((await docs.load(sceneId)) ?? "")).toBe("restored");
    expect(await docs.loadProjection(sceneId)).toBe("restored");
    const outbox = await db.select<{ domain: string; item_id: string }[]>(
      "SELECT domain, item_id FROM sync_outbox ORDER BY created_at, id",
    );
    expect(outbox).toEqual([
      { domain: "meta", item_id: projectId }, { domain: "scene", item_id: sceneId },
    ]);
  });

  it("restores a snapshot wholesale after first persisting a safety snapshot", async () => {
    const { binder, projectId } = await seedProject();
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "Scene" });
    const docs = new MobileSceneDocStore(db); await docs.save(sceneId, sceneDoc("discarded"), null);
    const snapshots = new MobileSnapshotStore(db);
    const target = await snapshots.takeSnapshot({ sceneId, label: null, stateBase64: sceneDoc("restored"), wordCount: 1 });
    const owner = new MobileEpochOwner(db, docs);
    await restoreSnapshotSafely({
      getSnapshot: (id) => snapshots.getSnapshot(id),
      readCurrentScene: async () => ({ stateBase64: (await docs.load(sceneId)) ?? "", wordCount: 1 }),
      takeSafetySnapshot: async (input) => (await snapshots.takeSnapshot({ ...input, label: null, kind: "auto" })).id,
      publishSnapshot: async () => undefined,
      replaceThroughEpoch: async (input) => { await owner.replaceThroughEpoch(input); },
    }, { projectId, sceneId, snapshotId: target.id });
    expect(textOf((await docs.load(sceneId)) ?? "")).toBe("restored");
    expect(await snapshots.listSnapshots(sceneId)).toHaveLength(2);
    expect((await new MobileEpochStore(db).load())[sceneId].n).toBe(1);
  });
});

describe("mobile promotion delivery", () => {
  it("replays to one scene and leaves an offline scene outbox entry", async () => {
    const { projectId } = await seedProject();
    const notes = new MobileQuickNoteStore(db); const noteId = await notes.create(projectId, "Thought");
    const note = (await notes.listUnfiled(projectId))[0];
    const scenes = new MobileScenePromotionStore(db); const docs = new MobileSceneDocStore(db);
    const run = () => promoteNote({
      findSceneByKey: (key) => scenes.findSceneByKey(key),
      createScene: (input) => scenes.createScene(input),
      sceneDocExists: async (id) => (await docs.load(id)) !== null,
      saveSceneDoc: (id, state, text) => docs.save(id, state, text),
      publishScene: (id) => scenes.publishScene(id), markFiled: (id) => notes.markFiled(id),
      syncAfterSave: (id) => scenes.queueScene(id),
    }, note, sceneDoc("Thought"));
    const first = await run(); const second = await run();
    expect(second).toBe(first);
    expect((await db.select<{ count: number }[]>("SELECT COUNT(*) AS count FROM scenes"))[0].count).toBe(1);
    expect((await db.select<{ filed: number }[]>("SELECT filed FROM quick_notes WHERE id = ?", [noteId]))[0].filed).toBe(1);
    expect(await db.select<{ domain: string; item_id: string }[]>(
      "SELECT domain, item_id FROM sync_outbox WHERE domain = 'scene'",
    )).toEqual([{ domain: "scene", item_id: first }]);
  });
});
