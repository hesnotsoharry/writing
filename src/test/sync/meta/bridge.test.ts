import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { runMigrations } from "../../../db/migrations";
import { getDb } from "../../../db/schema";
import { SqliteBinderStore } from "../../../db/sqliteBinderStore";
import { SqliteLabelStore } from "../../../db/sqliteLabelStore";
import { SqliteMetaApplyTarget } from "../../../db/sqliteMetaApplyTarget";
import { SqliteProjectMetaDocStore } from "../../../db/sqliteProjectMetaDocStore";
import { exclusiveMetaDoc } from "../../../sync/exclusiveLock";
import { applyMetaDoc } from "../../../sync/meta/applyExec";
import {
  bootstrapProjectMeta, ensureAllProjectMetas, withProjectMeta,
} from "../../../sync/meta/bridge";
import {
  buildFromSql,
  getFolders,
  getLabels,
  getSceneLabels,
  getScenes,
  getTombstones,
  removeWithTombstone,
  setScene,
} from "../../../sync/meta/metaDoc";
import { keyBetween } from "../../../sync/meta/sortKey";
import { mergeStoredMeta } from "../../../sync/storedDocMerge";
import { applyEncoded } from "../../../yjs/serialize";
import { makeSqlJsDb, type SqlJsTestDb } from "../../support/sqljsDb";

vi.mock("../../../db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../db/schema")>();
  return { ...actual, getDb: vi.fn() };
});

let db: SqlJsTestDb;
let binder: SqliteBinderStore;
let labels: SqliteLabelStore;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  binder = new SqliteBinderStore();
  labels = new SqliteLabelStore();
});

afterEach(() => {
  db.close();
  vi.clearAllMocks();
});

async function settle(projectId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await withProjectMeta(projectId, () => undefined);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await withProjectMeta(projectId, () => undefined);
}

async function readDoc(projectId: string): Promise<Y.Doc> {
  const encoded = await new SqliteProjectMetaDocStore().load(projectId);
  if (encoded === null) throw new Error(`Missing meta doc for ${projectId}`);
  const doc = new Y.Doc();
  applyEncoded(doc, encoded);
  return doc;
}

async function createBootstrappedProject(): Promise<{
  projectId: string; firstFolder: string; secondFolder: string;
}> {
  const projectId = await binder.createProject({ title: "Novel", type: "novel" });
  const firstFolder = await binder.createFolder({ projectId, title: "One" });
  const secondFolder = await binder.createFolder({ projectId, title: "Two" });
  await bootstrapProjectMeta(projectId);
  return { projectId, firstFolder, secondFolder };
}

describe("project meta local bridge", () => {
  it("creates a remote project row before applying its structure", async () => {
    const doc = buildFromSql({
      project: { id: "remote-project", title: "Remote Novel", type: "novel" },
      folders: [{
        id: "remote-folder", project_id: "remote-project", title: "Act One", sort_order: 1000,
      }],
      scenes: [], labels: [], sceneLabels: [],
    });
    await applyMetaDoc("remote-project", doc, new SqliteMetaApplyTarget());
    const projects = await db.select<Array<{ title: string }>>(
      "SELECT title FROM projects WHERE id = 'remote-project'"
    );
    const folders = await db.select<Array<{ project_id: string }>>(
      "SELECT project_id FROM folders WHERE id = 'remote-folder'"
    );
    expect(projects).toEqual([{ title: "Remote Novel" }]);
    expect(folders).toEqual([{ project_id: "remote-project" }]);
  });

  it("bootstraps a project's meta doc at creation time, regardless of device role", async () => {
    await db.execute("INSERT INTO app_meta (key, value) VALUES ('sync_role', 'joined')");
    const projectId = await binder.createProject({ title: "Local", type: "novel" });
    expect(await new SqliteProjectMetaDocStore().load(projectId)).not.toBeNull();
  });

  it("ensure-sweep backfills a docless project regardless of device role", async () => {
    // Simulate a project stranded before creation-time bootstrap existed: insert
    // the SQL row directly, bypassing SqliteBinderStore.createProject.
    await db.execute(
      "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
      ["stranded", "Stranded", "novel", 1000, "2024-01-01", "2024-01-01"]
    );
    await db.execute("INSERT INTO app_meta (key, value) VALUES ('sync_role', 'joined')");
    await ensureAllProjectMetas();
    expect(await new SqliteProjectMetaDocStore().load("stranded")).not.toBeNull();
  });

  it("ensure-sweep does not touch or overwrite a project's existing meta doc", async () => {
    const { projectId } = await createBootstrappedProject();
    await withProjectMeta(projectId, (doc) => setScene(doc, {
      id: "manual-scene", projectId, folderId: null, title: "Manual",
      synopsis: null, status: "blank", sortKey: "a0",
    }));
    const before = await new SqliteProjectMetaDocStore().load(projectId);
    await ensureAllProjectMetas();
    const after = await new SqliteProjectMetaDocStore().load(projectId);
    expect(after).toBe(before);
  });

  it("mirrors create, rename, status, synopsis, and move with stable neighbor keys", async () => {
    const { projectId, firstFolder, secondFolder } = await createBootstrappedProject();
    const createdFolder = await binder.createFolder({ projectId, title: "Three" });
    const first = await binder.createScene({ projectId, folderId: firstFolder, title: "First" });
    const second = await binder.createScene({ projectId, folderId: firstFolder, title: "Second" });
    const moved = await binder.createScene({ projectId, folderId: secondFolder, title: "Moved" });
    await settle(projectId);
    const before = getScenes(await readDoc(projectId));
    const firstKey = before.find(({ id }) => id === first)!.sortKey;
    const secondKey = before.find(({ id }) => id === second)!.sortKey;

    await binder.renameScene(moved, "Renamed");
    await binder.setSceneStatus(moved, "draft");
    await binder.setSceneSynopsis(moved, "New synopsis");
    await binder.moveScene(moved, firstFolder, 1);
    await binder.renameFolder(firstFolder, "Act One");
    await settle(projectId);

    const doc = await readDoc(projectId);
    const scene = getScenes(doc).find(({ id }) => id === moved)!;
    expect(scene).toMatchObject({
      folderId: firstFolder, title: "Renamed", status: "draft", synopsis: "New synopsis",
    });
    expect(firstKey < scene.sortKey && scene.sortKey < secondKey).toBe(true);
    expect(getScenes(doc).find(({ id }) => id === first)!.sortKey).toBe(firstKey);
    expect(getScenes(doc).find(({ id }) => id === second)!.sortKey).toBe(secondKey);
    expect(getFolders(doc).find(({ id }) => id === firstFolder)!.title).toBe("Act One");
    expect(getFolders(doc).find(({ id }) => id === createdFolder)!.title).toBe("Three");
  });

  it("mirrors label CRUD, ordering, and scene-label assignment", async () => {
    const { projectId, firstFolder } = await createBootstrappedProject();
    const sceneId = await binder.createScene({ projectId, folderId: firstFolder, title: "Scene" });
    const first = await labels.createLabel(projectId, "First", "clay");
    const second = await labels.createLabel(projectId, "Second", "sea");
    await settle(projectId);

    await labels.updateLabel(first.id, { name: "Changed", color: "moss" });
    await labels.assignLabel(sceneId, first.id);
    await labels.reorderLabels([second.id, first.id]);
    await settle(projectId);
    let doc = await readDoc(projectId);
    const ordered = getLabels(doc).sort((a, b) => a.sortKey < b.sortKey ? -1 : 1);
    expect(ordered.map(({ id }) => id)).toEqual([second.id, first.id]);
    expect(ordered[1]).toMatchObject({ name: "Changed", color: "moss" });
    expect(getSceneLabels(doc)).toContainEqual({
      id: `${sceneId}:${first.id}`, sceneId, labelId: first.id,
    });

    await labels.unassignLabel(sceneId, first.id);
    await labels.deleteLabel(first.id);
    await settle(projectId);
    doc = await readDoc(projectId);
    expect(getLabels(doc).some(({ id }) => id === first.id)).toBe(false);
    expect(getTombstones(doc)[first.id]?.kind).toBe("label");
    expect(getTombstones(doc)[`${sceneId}:${first.id}`]?.kind).toBe("sceneLabel");
  });

  it("tombstones and restores archived scenes and chapters", async () => {
    const { projectId, firstFolder } = await createBootstrappedProject();
    const sceneId = await binder.createScene({ projectId, folderId: firstFolder, title: "Scene" });
    await settle(projectId);
    await binder.archiveScene(sceneId, projectId);
    await settle(projectId);
    let doc = await readDoc(projectId);
    expect(getScenes(doc).some(({ id }) => id === sceneId)).toBe(false);
    expect(getTombstones(doc)[sceneId]?.kind).toBe("scene");

    const [sceneArchive] = await binder.listArchived(projectId);
    await binder.restoreArchived(sceneArchive.id);
    await settle(projectId);
    doc = await readDoc(projectId);
    expect(getScenes(doc).find(({ id }) => id === sceneId)?.folderId).toBeNull();
    expect(getTombstones(doc)[sceneId]).toBeUndefined();

    const child = await binder.createScene({ projectId, folderId: firstFolder, title: "Child" });
    await settle(projectId);
    await binder.archiveChapter(firstFolder, projectId);
    await settle(projectId);
    doc = await readDoc(projectId);
    expect(getTombstones(doc)[firstFolder]?.kind).toBe("folder");
    expect(getTombstones(doc)[child]?.kind).toBe("scene");
    const [chapterArchive] = await binder.listArchived(projectId);
    await binder.restoreArchived(chapterArchive.id);
    await settle(projectId);
    doc = await readDoc(projectId);
    expect(getFolders(doc).some(({ id }) => id === firstFolder)).toBe(true);
    expect(getScenes(doc).some(({ id }) => id === child)).toBe(true);
  });
});

it("keeps a local tombstone when a remote merge runs on the same lock", async () => {
  const { projectId, firstFolder } = await createBootstrappedProject();
  const sceneId = await binder.createScene({ projectId, folderId: firstFolder, title: "Doomed" });
  await settle(projectId);
  const store = new SqliteProjectMetaDocStore();
  const remote = await readDoc(projectId);
  setScene(remote, {
    id: "remote-scene", projectId, folderId: firstFolder, title: "Remote",
    synopsis: null, status: "blank", sortKey: "zz",
  });
  await Promise.all([
    withProjectMeta(projectId, (doc) => removeWithTombstone(doc, "scene", sceneId)),
    exclusiveMetaDoc(projectId, () => mergeStoredMeta(
      store, projectId, Y.encodeStateAsUpdate(remote),
    )),
  ]);
  const doc = await readDoc(projectId);
  expect(getTombstones(doc)[sceneId]?.kind).toBe("scene");
  expect(getScenes(doc).some(({ id }) => id === "remote-scene")).toBe(true);
});

it("merges independent cloned-meta operations to one consistent order", () => {
  const base = buildFromSql({
    folders: [], labels: [], sceneLabels: [],
    scenes: [
      { id: "a", project_id: "p", folder_id: null, title: "A", synopsis: null,
        status: "blank", sort_order: 1000 },
      { id: "b", project_id: "p", folder_id: null, title: "B", synopsis: null,
        status: "blank", sort_order: 2000 },
    ],
  });
  const initial = Y.encodeStateAsUpdate(base);
  const left = new Y.Doc();
  const right = new Y.Doc();
  Y.applyUpdate(left, initial);
  Y.applyUpdate(right, initial);
  const [a, b] = getScenes(left).sort((x, y) => x.sortKey < y.sortKey ? -1 : 1);
  const leftVector = Y.encodeStateVector(left);
  const rightVector = Y.encodeStateVector(right);
  setScene(left, { ...a, id: "left", title: "Left", sortKey: keyBetween(a.sortKey, b.sortKey) });
  setScene(right, { ...b, id: "right", title: "Right", sortKey: keyBetween(b.sortKey, null) });
  Y.applyUpdate(left, Y.encodeStateAsUpdate(right, rightVector));
  Y.applyUpdate(right, Y.encodeStateAsUpdate(left, leftVector));
  const order = (doc: Y.Doc): string[] => getScenes(doc)
    .sort((x, y) => x.sortKey < y.sortKey ? -1 : 1).map(({ id }) => id);
  expect(order(left)).toEqual(["a", "left", "b", "right"]);
  expect(order(right)).toEqual(order(left));
});
