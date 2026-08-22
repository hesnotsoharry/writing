/// <reference types="node" />
import { DbProjectDomainDocStore } from "@writersnook/db/projectDomainDocStore";
import { applyBibleDoc } from "@writersnook/sync/bible/bibleApplyExec";
import { buildBibleFromSql } from "@writersnook/sync/bible/bibleDoc";
import { DbBibleApplyTarget } from "@writersnook/sync/bible/dbBibleApplyTarget";
import { makeSqlJsDb, type SqlJsTestDb } from "@writersnook/test/support/sqljsDb";
import { encodeDoc } from "@writersnook/yjs/serialize";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../shared/migrations";
import { MobileAiContextStore } from "./mobileAiContextStore";
import { MobileAiConversationStore } from "./mobileAiConversationStore";
import { ensureAllMobileProjectBibles, subscribeMobileBibleSaves } from "./mobileBibleLocalBridge";
import { MobileBinderStore } from "./mobileBinderStore";
import { MobileBoardsStore } from "./mobileBoardsStore";
import { MobileGoalsStore } from "./mobileGoalsStore";
import { MobileLabelStore } from "./mobileLabelStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";
import { MobileMetaApplyTarget } from "./mobileMetaApplyTarget";
import { ensureAllMobileProjectMetas, subscribeMobileMetaSaves } from "./mobileMetaBridge";
import { MobileQuickNoteStore } from "./mobileQuickNoteStore";
import { MobileSearchStore } from "./mobileSearchStore";
import { MobileSnapshotStore } from "./mobileSnapshotStore";
import { MobileStoryBibleStore } from "./mobileStoryBibleStore";
import {
  getAiContextStore,
  getAiConversationStore,
  getArchiveStore,
  getBinderStore,
  getBoardsStore,
  getGoalsStore,
  getLabelStore,
  getQuickNoteStore,
  getSearchStore,
  getSnapshotStore,
  getStoryBibleStore,
} from "./stores";
import { MobileProjectMetaDocStore } from "./syncStores/mobileProjectMetaDocStore";

let db: SqlJsTestDb;
vi.mock("./database", () => ({ getMobileDb: () => Promise.resolve(db) }));
beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
});

async function project(store: MobileBinderStore): Promise<string> {
  return store.createProject({ title: "Novel", type: "novel" });
}

describe("mobile binder store", () => {
  it("round-trips create, move, rename, metadata, duplicate, archive, and restore", async () => {
    const store = new MobileBinderStore(db);
    const projectId = await project(store);
    const first = await store.createFolder({ projectId, title: "One" });
    const second = await store.createFolder({ projectId, title: "Two" });
    const sceneId = await store.createScene({ projectId, folderId: first, title: "Opening" });
    await db.execute(
      "INSERT INTO scene_docs (scene_id, state_base64, plaintext_projection) VALUES (?, ?, ?)",
      [sceneId, "encoded-content", "opening prose"],
    );
    await store.renameScene(sceneId, "Arrival");
    await store.setSceneStatus(sceneId, "draft");
    await store.setSceneSynopsis(sceneId, "A beginning");
    await store.moveScene(sceneId, second, 0);
    const loaded = await store.loadProject(projectId);
    expect(loaded.scenes[0]).toMatchObject({
      id: sceneId, folder_id: second, title: "Arrival", status: "draft", synopsis: "A beginning",
    });

    const copyId = await store.duplicateScene(sceneId);
    expect(copyId).not.toBe(sceneId);
    await db.execute("UPDATE scene_docs SET plaintext_projection = 'changed' WHERE scene_id = ?", [copyId]);
    const source = await db.select<{ plaintext_projection: string }[]>(
      "SELECT plaintext_projection FROM scene_docs WHERE scene_id = ?", [sceneId],
    );
    expect(source[0].plaintext_projection).toBe("opening prose");

    await store.archiveScene(sceneId, projectId);
    expect((await store.loadProject(projectId)).scenes.some(({ id }) => id === sceneId)).toBe(false);
    const archived = await store.listArchived(projectId);
    await store.restoreArchived(archived[0].id);
    const restoredDoc = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM scene_docs WHERE scene_id = ?", [sceneId],
    );
    expect(restoredDoc[0].state_base64).toBe("encoded-content");
  });

  it("reorders with normalized 1000-point sort values", async () => {
    const store = new MobileBinderStore(db);
    const projectId = await project(store);
    const folderId = await store.createFolder({ projectId, title: "Chapter" });
    const ids: string[] = [];
    for (const title of ["A", "B", "C"]) {
      ids.push(await store.createScene({ projectId, folderId, title }));
    }
    await store.moveScene(ids[2], folderId, 0);
    const rows = await db.select<{ id: string; sort_order: number }[]>(
      "SELECT id, sort_order FROM scenes ORDER BY sort_order", [],
    );
    expect(rows).toEqual([
      { id: ids[2], sort_order: 1000 }, { id: ids[0], sort_order: 2000 },
      { id: ids[1], sort_order: 3000 },
    ]);
  });
});

describe("mobile labels and quick notes", () => {
  it("assigns labels independently of scene names", async () => {
    const binder = new MobileBinderStore(db);
    const projectId = await project(binder);
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "Old" });
    const labels = new MobileLabelStore(db);
    const label = await labels.createLabel(projectId, "Tension", "clay");
    await labels.assignLabel(sceneId, label.id);
    await binder.renameScene(sceneId, "New");
    expect(await labels.getSceneLabels(sceneId)).toEqual([label]);
    await labels.unassignLabel(sceneId, label.id);
    expect(await labels.getSceneLabels(sceneId)).toEqual([]);
  });

  it("creates, counts, edits, files, and deletes stateful notes", async () => {
    const projectId = await project(new MobileBinderStore(db));
    const notes = new MobileQuickNoteStore(db);
    const id = await notes.create(projectId, "Capture", "share-sheet");
    expect(await notes.countUnfiled(projectId)).toBe(1);
    await notes.updateBody(id, "Edited");
    expect(await notes.listUnfiled(projectId)).toMatchObject([{ body: "Edited", state: "inbox" }]);
    await notes.markFiled(id);
    expect(await notes.countUnfiled(projectId)).toBe(0);
    await notes.delete(id);
    expect(await db.select("SELECT * FROM quick_notes")).toEqual([]);
  });
});

describe("mobile Story Bible", () => {
  it("handles legacy, generic, custom fields, reciprocal relations, and scene links", async () => {
    const binder = new MobileBinderStore(db);
    const projectId = await project(binder);
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "Scene" });
    const bible = new MobileStoryBibleStore(db);
    const character = await bible.createCharacter(projectId, "Mara", null);
    const item = await bible.createEntity(projectId, "item", "Key", null);
    const custom = await bible.createCustomType({ projectId, name: "Creature", icon: "paw", color: "moss" });
    expect((await bible.listCustomTypes(projectId))[0].id).toBe(custom.id);
    const field = await bible.addEntityField(character.id, "fact", "age");
    await bible.setEntityField(character.id, "fact", "age", "42");
    await bible.reorderEntityFields([{ id: field.id, sort: 3 }]);
    expect(await bible.getEntityFields(character.id)).toMatchObject([{ value: "42", sort: 3 }]);
    const relation = await bible.addRelation(projectId, {
      fromEntity: character.id, toEntity: item.id, label: "Carries", reciprocalLabel: "Carried by",
    });
    expect(await bible.listRelations(projectId)).toHaveLength(2);
    await bible.deleteRelation(relation.id);
    expect(await bible.listRelations(projectId)).toHaveLength(0);
    await bible.replaceSceneLinks(sceneId, [{ entityType: "character", entityId: character.id }]);
    expect(await bible.findScenesForEntity(character.id)).toEqual([sceneId]);
    await bible.deleteEntityField(field.id);
    expect(await bible.getEntityFields(character.id)).toEqual([]);
  });
});

describe("mobile search and rich goals", () => {
  it("searches only plaintext projections at start, middle, and end", async () => {
    const binder = new MobileBinderStore(db);
    const projectId = await project(binder);
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "Loose" });
    await db.execute(
      "INSERT INTO scene_docs (scene_id, state_base64, plaintext_projection) VALUES (?, ?, ?)",
      [sceneId, "not-valid-yjs", "needle middle needle"],
    );
    const matches = await new MobileSearchStore(db).searchManuscript(projectId, "needle");
    expect(matches[0]).toMatchObject({ subtitle: "Short pieces", offsets: [0, 14] });
    expect(await new MobileSearchStore(db).searchManuscript(projectId, "absent")).toEqual([]);
  });

  it("round-trips unknown goal config keys", async () => {
    const projectId = await project(new MobileBinderStore(db));
    const goals = new MobileGoalsStore(db);
    const config = { deadline: "2030-01-01", qualifiers: ["weekday"], future: { nested: true } };
    await goals.upsertGoal({ projectId, goalType: "daily", target: 500, enabled: true, config });
    expect((await goals.getGoals(projectId))[0].config).toEqual(config);
  });
});

describe("local-write ping-pong guard", () => {
  it("notifies a local Bible mutation but not raw remote projection", async () => {
    const projectId = await project(new MobileBinderStore(db));
    const docs = new DbProjectDomainDocStore(db);
    await docs.save("bible", projectId, encodeDoc(buildBibleFromSql({
      entities: [], entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    })));
    const listener = vi.fn(); const unsubscribe = subscribeMobileBibleSaves(listener);
    await new MobileStoryBibleStore(db).createCharacter(projectId, "Local", null);
    expect(listener).toHaveBeenCalledTimes(1);
    await applyBibleDoc(projectId, buildBibleFromSql({
      entities: [{ id: "remote", projectId, storage: "character", entityType: "character",
        name: "Remote", notes: null, aliases: null, excludeFromAi: false }],
      entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    }), new DbBibleApplyTarget(db));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("notifies local meta writes but not remote projection writes", async () => {
    const binder = new MobileBinderStore(db);
    const projectId = await project(binder);
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "Local" });
    const listener = vi.fn();
    const unsubscribe = subscribeMobileMetaSaves(listener);
    await binder.renameScene(sceneId, "Renamed locally");
    expect(listener).toHaveBeenCalledTimes(1);
    await new MobileMetaApplyTarget().upsertScene({
      id: sceneId, project_id: projectId, folder_id: null, title: "Remote",
      synopsis: null, status: "draft", sort_order: 1000,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  /**
   * `word_count` is NOT part of the project-meta projection: `SqlSceneRow`
   * (src/sync/meta/applyPlan.ts) has no such field, `loadProjection` never
   * selects it, and the planner never diffs it. It is owned by the scene-doc
   * path instead — `mergeStoredScene` recomputes it from the merged Yjs doc
   * (src/sync/storedDocMerge.ts) and calls `updateWordCount`, wired on mobile
   * in src/sync/mobileEngine.ts. Desktop's sqliteMetaApplyTarget.upsertScene
   * is character-identical to this one. So the meta path must seed 0 on
   * INSERT and leave a local count ALONE on conflict — adding word_count to
   * the ON CONFLICT clause would zero a correct count on every meta apply.
   */
  it("leaves word_count to the scene-doc path: seeds 0, never clobbers on conflict", async () => {
    const binder = new MobileBinderStore(db);
    const projectId = await project(binder);
    const target = new MobileMetaApplyTarget();
    const remote = { project_id: projectId, folder_id: null, title: "Remote", synopsis: null,
      status: "draft" as const, sort_order: 1000 };

    await target.upsertScene({ id: "scene-new", ...remote });
    const seeded = await binder.loadProject(projectId);
    expect(seeded.scenes.find(({ id }) => id === "scene-new")?.word_count).toBe(0);

    await binder.setSceneWordCount("scene-new", 412);
    await target.upsertScene({ id: "scene-new", ...remote, title: "Renamed remotely" });
    const applied = await binder.loadProject(projectId);
    const row = applied.scenes.find(({ id }) => id === "scene-new");
    expect(row?.title).toBe("Renamed remotely");
    expect(row?.word_count).toBe(412);
  });

  it.each(["goals", "quick-notes"])("notifies local %s writes but suppresses remote application", async (domain) => {
    const projectId = await project(new MobileBinderStore(db));
    const listener = vi.fn();
    const unsubscribe = mobileLocalWrites.subscribe(listener);
    if (domain === "goals") {
      const store = new MobileGoalsStore(db);
      await store.upsertGoal({ projectId, goalType: "daily", target: 1, enabled: true });
      expect(listener).toHaveBeenCalledTimes(1);
      await mobileLocalWrites.runRemote(() => store.upsertGoal({ projectId, goalType: "daily", target: 2, enabled: true }));
    } else {
      const store = new MobileQuickNoteStore(db);
      await store.create(projectId, "local");
      expect(listener).toHaveBeenCalledTimes(1);
      await mobileLocalWrites.runRemote(() => store.create(projectId, "remote"));
    }
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it.each([
    ["boards", async (projectId: string) => {
      const store = new MobileBoardsStore(db);
      await store.create({ id: crypto.randomUUID(), project_id: projectId, title: "Board", sort: 0 });
    }],
    ["manuscript_about", async (projectId: string) => {
      await new MobileAiContextStore(db).setManuscriptAbout(projectId, {
        synopsis: "S", genre: "G", tone: "T", pov: "P", notes: "N",
      });
    }],
    ["ai_conversations", async (projectId: string) => {
      await new MobileAiConversationStore(db).createConversation(projectId);
    }],
    ["archive", async (projectId: string) => {
      const binder = new MobileBinderStore(db);
      const sceneId = await binder.createScene({ projectId, folderId: null, title: "Archive me" });
      await binder.archiveScene(sceneId, projectId);
    }],
    ["scene_snapshots", async (projectId: string) => {
      const binder = new MobileBinderStore(db);
      const sceneId = await binder.createScene({ projectId, folderId: null, title: "Snapshot me" });
      await new MobileSnapshotStore(db).takeSnapshot({
        sceneId, label: null, stateBase64: "state", wordCount: 0,
      });
    }],
  ])("notifies local %s writes and suppresses remote application", async (domain, mutate) => {
    const projectId = await project(new MobileBinderStore(db));
    const listener = vi.fn();
    const unsubscribe = mobileLocalWrites.subscribe(listener);
    await mutate(projectId);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ domain, projectId });
    await mobileLocalWrites.runRemote(() => mutate(projectId));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("mobile creation-time and ensure-sweep bootstrap", () => {
  it("bootstraps both a meta doc and an empty bible doc when a project is created", async () => {
    const projectId = await project(new MobileBinderStore(db));
    expect(await new MobileProjectMetaDocStore().load(projectId)).not.toBeNull();
    const bible = await new DbProjectDomainDocStore(db).load("bible", projectId);
    expect(bible).not.toBeNull();
  });

  it("ensure sweeps backfill a project with SQL rows but no docs yet", async () => {
    // Simulate a project stranded before creation-time bootstrap existed: insert
    // the SQL row directly, bypassing MobileBinderStore.createProject.
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ["stranded", "Stranded", "novel", 1000, now, now],
    );
    await ensureAllMobileProjectMetas();
    await ensureAllMobileProjectBibles();
    expect(await new MobileProjectMetaDocStore().load("stranded")).not.toBeNull();
    expect(await new DbProjectDomainDocStore(db).load("bible", "stranded")).not.toBeNull();
  });

  it("ensure sweeps do not touch or overwrite a project's existing docs", async () => {
    const binder = new MobileBinderStore(db);
    const projectId = await project(binder);
    const sceneId = await binder.createScene({ projectId, folderId: null, title: "Scene" });
    await binder.renameScene(sceneId, "Renamed before sweep");
    await new MobileStoryBibleStore(db).createCharacter(projectId, "Mara", null);

    const metaBefore = await new MobileProjectMetaDocStore().load(projectId);
    const bibleBefore = await new DbProjectDomainDocStore(db).load("bible", projectId);

    await ensureAllMobileProjectMetas();
    await ensureAllMobileProjectBibles();

    expect(await new MobileProjectMetaDocStore().load(projectId)).toBe(metaBefore);
    expect(await new DbProjectDomainDocStore(db).load("bible", projectId)).toBe(bibleBefore);
  });
});

describe("store accessor seam", () => {
  it("memoises every UI store getter", async () => {
    const getters = [
      getBinderStore, getLabelStore, getStoryBibleStore, getGoalsStore,
      getQuickNoteStore, getSnapshotStore, getBoardsStore, getArchiveStore,
      getSearchStore, getAiConversationStore, getAiContextStore,
    ];
    for (const getter of getters) expect(await getter()).toBe(await getter());
  });
});
