/**
 * manuscriptSearch.test.ts — unit tests for searchManuscript and replaceInScene.
 *
 * Uses in-memory mocks for both the DB layer and the SnapshotStore so no Tauri
 * runtime is required.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { InMemorySnapshotStore } from "../db/inMemorySnapshotStore";
import { encodeDoc } from "../yjs/serialize";

// ── DB mock ───────────────────────────────────────────────────────────────────
// We mock the schema module before importing the module under test so the
// `getDb()` calls inside manuscriptSearchStore resolve to our in-memory store.

interface SelectCall { sql: string; params: unknown[] }
type SelectHandler = (sql: string, params: unknown[]) => unknown[];

let selectHandler: SelectHandler = () => [];
const executeLog: { sql: string; params: unknown[] }[] = [];

vi.mock("../db/schema", () => ({
  getDb: async () => ({
    select: async <T>(sql: string, params: unknown[] = []): Promise<T> => {
      return selectHandler(sql, params) as T;
    },
    execute: async (sql: string, params: unknown[] = []) => {
      executeLog.push({ sql, params } as SelectCall);
    },
  }),
}));

// Import after mocking.
import { replaceInScene, searchManuscript } from "../db/manuscriptSearchStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDoc(text: string): string {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const para = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  para.insert(0, [t]);
  frag.insert(0, [para]);
  return encodeDoc(doc);
}

interface FolderStub { id: string; title: string }
interface SceneStub { id: string; title: string; folder_id: string | null; state_base64: string | null }

function setupMock(folders: FolderStub[], scenes: SceneStub[]) {
  selectHandler = (sql: string) => {
    if (sql.includes("FROM folders")) return folders;
    if (sql.includes("FROM scenes")) return scenes;
    if (sql.includes("FROM scene_docs")) {
      const scene = scenes[0];
      return scene ? [{ state_base64: scene.state_base64 }] : [];
    }
    return [];
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("searchManuscript", () => {
  beforeEach(() => {
    selectHandler = () => [];
    executeLog.length = 0;
  });

  it("returns empty array when query is shorter than 2 chars", async () => {
    const results = await searchManuscript("proj-1", "a");
    expect(results).toStrictEqual([]);
  });

  it("returns empty array when no scenes match", async () => {
    setupMock(
      [{ id: "ch-1", title: "Chapter One" }],
      [{ id: "s-1", title: "Scene 1", folder_id: "ch-1", state_base64: makeDoc("nothing here") }],
    );
    const results = await searchManuscript("proj-1", "Thornwick");
    expect(results).toStrictEqual([]);
  });

  it("matches a query across multiple scenes and groups by chapter", async () => {
    const b1 = makeDoc("Thornwick is a village in the north.");
    const b2 = makeDoc("She returned to Thornwick at dawn. Thornwick never forgot her.");
    setupMock(
      [{ id: "ch-1", title: "Chapter One" }, { id: "ch-2", title: "Chapter Two" }],
      [
        { id: "s-1", title: "Arrival", folder_id: "ch-1", state_base64: b1 },
        { id: "s-2", title: "Return", folder_id: "ch-2", state_base64: b2 },
      ],
    );

    const results = await searchManuscript("proj-1", "Thornwick");
    expect(results).toHaveLength(2);

    const arrival = results.find((r) => r.sceneId === "s-1");
    expect(arrival).toBeDefined();
    expect(arrival!.chapterTitle).toBe("Chapter One");
    expect(arrival!.offsets).toHaveLength(1);

    const returnScene = results.find((r) => r.sceneId === "s-2");
    expect(returnScene).toBeDefined();
    expect(returnScene!.chapterTitle).toBe("Chapter Two");
    expect(returnScene!.offsets).toHaveLength(2);
  });

  it("matches case-insensitively", async () => {
    setupMock(
      [{ id: "ch-1", title: "Chapter One" }],
      [{ id: "s-1", title: "Scene 1", folder_id: "ch-1", state_base64: makeDoc("THORNWICK is beautiful") }],
    );
    const results = await searchManuscript("proj-1", "thornwick");
    expect(results).toHaveLength(1);
    expect(results[0].offsets).toHaveLength(1);
  });

  it("assigns 'Short pieces' chapter title for scenes with no folder", async () => {
    setupMock(
      [],
      [{ id: "s-1", title: "Loose scene", folder_id: null, state_base64: makeDoc("Thornwick standalone") }],
    );
    const results = await searchManuscript("proj-1", "Thornwick");
    expect(results).toHaveLength(1);
    expect(results[0].chapterTitle).toBe("Short pieces");
  });
});

describe("replaceInScene", () => {
  beforeEach(() => {
    selectHandler = () => [];
    executeLog.length = 0;
  });

  it("returns replacedCount 0 when the query is empty", async () => {
    const store = new InMemorySnapshotStore();
    const result = await replaceInScene("s-1", "", "new", store);
    expect(result.replacedCount).toBe(0);
  });

  it("replaces all occurrences (case-insensitive) and returns the correct count", async () => {
    const base64 = makeDoc("Thornwick is near thornwick village and THORNWICK castle.");
    selectHandler = (sql) => {
      if (sql.includes("FROM scene_docs")) return [{ state_base64: base64 }];
      return [];
    };
    const store = new InMemorySnapshotStore();
    const result = await replaceInScene("s-1", "thornwick", "Thornholm", store);
    expect(result.replacedCount).toBe(3);
  });

  it("takes an auto-snapshot before replacing (Undo guarantee)", async () => {
    const base64 = makeDoc("Thornwick is a village.");
    selectHandler = (sql) => {
      if (sql.includes("FROM scene_docs")) return [{ state_base64: base64 }];
      return [];
    };
    const store = new InMemorySnapshotStore();
    await replaceInScene("s-1", "Thornwick", "Thornholm", store);
    const snaps = await store.listSnapshots("s-1");
    expect(snaps).toHaveLength(1);
    expect(snaps[0].kind).toBe("auto");
  });

  it("persists the mutated scene_doc to the DB", async () => {
    const base64 = makeDoc("Thornwick stands alone.");
    selectHandler = (sql) => {
      if (sql.includes("FROM scene_docs")) return [{ state_base64: base64 }];
      return [];
    };
    const store = new InMemorySnapshotStore();
    executeLog.length = 0;
    await replaceInScene("s-1", "Thornwick", "Thornholm", store);
    const upserts = executeLog.filter((e) => e.sql.includes("INSERT INTO scene_docs"));
    expect(upserts).toHaveLength(1);
  });
});
