import { toUint8Array } from "js-base64";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { runMigrations } from "../../db/migrations";
import { getDb } from "../../db/schema";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";
import { SqliteProjectDomainDocStore } from "../../db/sqliteProjectDomainDocStore";
import { SqliteStoryBibleStore } from "../../db/sqliteStoryBibleStore";
import { readBibleDoc } from "../../sync/bible/bibleDoc";
import {
  bootstrapProjectBible, ensureAllProjectBibles, subscribeBibleSaves,
} from "../../sync/bible/desktopBibleBridge";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

vi.mock("../../db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../db/schema")>();
  return { ...actual, getDb: vi.fn() };
});

let db: SqlJsTestDb;
let binder: SqliteBinderStore;
const docStore = new SqliteProjectDomainDocStore();

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  binder = new SqliteBinderStore();
});

afterEach(() => {
  db.close();
  vi.clearAllMocks();
});

async function readStoredBibleDoc(projectId: string) {
  const encoded = await docStore.load("bible", projectId);
  if (encoded === null) throw new Error(`Missing bible doc for ${projectId}`);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, toUint8Array(encoded));
  return { doc, encoded };
}

describe("desktop bible local bridge", () => {
  it("bootstraps an empty bible doc at project creation, regardless of device role", async () => {
    await db.execute("INSERT INTO app_meta (key, value) VALUES ('sync_role', 'joined')");
    const projectId = await binder.createProject({ title: "Local", type: "novel" });
    const { doc } = await readStoredBibleDoc(projectId);
    expect(readBibleDoc(doc).entities).toEqual([]);
  });

  it("notifies subscribers immediately when creation-time bootstrap runs", async () => {
    const heard: Array<{ projectId: string }> = [];
    const unsubscribe = subscribeBibleSaves((projectId) => heard.push({ projectId }));
    const projectId = await binder.createProject({ title: "Local", type: "novel" });
    unsubscribe();
    expect(heard).toEqual([{ projectId }]);
  });

  it("is idempotent: re-bootstrapping an existing bible doc is a no-op", async () => {
    const projectId = await binder.createProject({ title: "Local", type: "novel" });
    await new SqliteStoryBibleStore().createCharacter(projectId, "Mara", null);
    const before = (await readStoredBibleDoc(projectId)).encoded;
    await bootstrapProjectBible(projectId);
    const after = (await readStoredBibleDoc(projectId)).encoded;
    expect(after).toBe(before);
  });

  it("ensure-sweep backfills a docless project regardless of device role", async () => {
    // Simulate a project stranded before creation-time bootstrap existed: insert
    // the SQL row directly, bypassing SqliteBinderStore.createProject.
    await db.execute(
      "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
      ["stranded", "Stranded", "novel", 1000, "2024-01-01", "2024-01-01"]
    );
    await db.execute("INSERT INTO app_meta (key, value) VALUES ('sync_role', 'joined')");
    await ensureAllProjectBibles();
    expect(await docStore.load("bible", "stranded")).not.toBeNull();
  });

  it("ensure-sweep does not touch or overwrite a project's existing bible doc", async () => {
    const projectId = await binder.createProject({ title: "Local", type: "novel" });
    await new SqliteStoryBibleStore().createCharacter(projectId, "Mara", null);
    const before = (await readStoredBibleDoc(projectId)).encoded;
    await ensureAllProjectBibles();
    const after = (await readStoredBibleDoc(projectId)).encoded;
    expect(after).toBe(before);
    const { doc } = await readStoredBibleDoc(projectId);
    expect(readBibleDoc(doc).entities.map(({ name }) => name)).toEqual(["Mara"]);
  });
});
