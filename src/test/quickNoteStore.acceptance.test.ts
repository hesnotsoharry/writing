// ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 13, Phase 1 (boundary: persistent storage).
// Pre-impl oracle: locks the SqliteQuickNoteStore + promoteNoteToScene + noteBodyToSceneDoc
// contract from the consumer's perspective. The implementer builds the data layer to satisfy
// this WITHOUT modifying this file. See roadmap/wave-13-quickcapture-inbox.md.
//
// Contract under test:
//   SqliteQuickNoteStore(dbProvider?: () => Promise<DbHandle>)   // default getDb in production
//     create(projectId, body): Promise<string>                  // new id; created_at = Date.now(); filed = 0
//     listUnfiled(projectId): Promise<QuickNote[]>              // filed = 0, project-scoped, created_at DESC
//     countUnfiled(projectId): Promise<number>
//     updateBody(id, body): Promise<void>
//     markFiled(id): Promise<void>
//     delete(id): Promise<void>
//   QuickNote = { id: string; project_id: string; body: string; created_at: number; filed: number }
//   noteBodyToSceneDoc(body): string                            // base64 Yjs update; extractPlainText === body
//   promoteNoteToScene(deps, { note, projectId }): Promise<string>  // new sceneId; creates scene + scene_docs + markFiled
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { InMemoryBinderStore } from "../db/binderStore";
import { runMigrations } from "../db/migrations";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import type { DbHandle } from "../db/schema";
import {
  noteBodyToSceneDoc,
  promoteNoteToScene,
} from "../features/quickcapture/promoteNoteToScene";
import { SqliteQuickNoteStore } from "../features/quickcapture/SqliteQuickNoteStore";
import { applyEncoded, extractPlainText } from "../yjs/serialize";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

const PROJ_A = "project-a";
const PROJ_B = "project-b";

async function freshDb(): Promise<SqlJsTestDb> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  return db;
}

function storeOn(db: DbHandle): SqliteQuickNoteStore {
  return new SqliteQuickNoteStore(() => Promise.resolve(db));
}

describe("SqliteQuickNoteStore — CRUD contract", () => {
  it("create() persists a project-scoped unfiled note retrievable via listUnfiled/countUnfiled", async () => {
    const db = await freshDb();
    try {
      const store = storeOn(db);
      await store.create(PROJ_A, "first thought");
      await store.create(PROJ_A, "second thought");
      await store.create(PROJ_B, "other project");

      const aNotes = await store.listUnfiled(PROJ_A);
      expect(aNotes.map((n) => n.body).sort()).toEqual([
        "first thought",
        "second thought",
      ]);
      expect(await store.countUnfiled(PROJ_A)).toBe(2);
      expect(await store.countUnfiled(PROJ_B)).toBe(1);
      // Shape: created_at is a number (epoch ms), filed is 0 for a fresh note.
      expect(typeof aNotes[0].created_at).toBe("number");
      expect(aNotes[0].filed).toBe(0);
      expect(aNotes[0].project_id).toBe(PROJ_A);
    } finally {
      db.close();
    }
  });

  it("listUnfiled returns notes newest-first (created_at DESC)", async () => {
    const db = await freshDb();
    try {
      // Seed with explicit, distinct created_at so ordering is deterministic.
      await db.execute(
        "INSERT INTO quick_notes (id, project_id, body, created_at, filed) VALUES ($1,$2,$3,$4,0)",
        ["n1", PROJ_A, "oldest", 1000]
      );
      await db.execute(
        "INSERT INTO quick_notes (id, project_id, body, created_at, filed) VALUES ($1,$2,$3,$4,0)",
        ["n2", PROJ_A, "middle", 2000]
      );
      await db.execute(
        "INSERT INTO quick_notes (id, project_id, body, created_at, filed) VALUES ($1,$2,$3,$4,0)",
        ["n3", PROJ_A, "newest", 3000]
      );
      const notes = await storeOn(db).listUnfiled(PROJ_A);
      expect(notes.map((n) => n.body)).toEqual(["newest", "middle", "oldest"]);
    } finally {
      db.close();
    }
  });

  it("markFiled removes a note from listUnfiled/countUnfiled (soft, not deleted)", async () => {
    const db = await freshDb();
    try {
      const store = storeOn(db);
      const id = await store.create(PROJ_A, "to be filed");
      await store.markFiled(id);
      expect(await store.countUnfiled(PROJ_A)).toBe(0);
      expect(await store.listUnfiled(PROJ_A)).toEqual([]);
      // Row still exists (filed=1), not deleted.
      const rows = await db.select<{ filed: number }[]>(
        "SELECT filed FROM quick_notes WHERE id = $1",
        [id]
      );
      expect(rows[0].filed).toBe(1);
    } finally {
      db.close();
    }
  });

  it("updateBody persists the new body", async () => {
    const db = await freshDb();
    try {
      const store = storeOn(db);
      const id = await store.create(PROJ_A, "before");
      await store.updateBody(id, "after");
      const notes = await store.listUnfiled(PROJ_A);
      expect(notes[0].body).toBe("after");
    } finally {
      db.close();
    }
  });

  it("delete removes the row entirely", async () => {
    const db = await freshDb();
    try {
      const store = storeOn(db);
      const id = await store.create(PROJ_A, "ephemeral");
      await store.delete(id);
      expect(await store.countUnfiled(PROJ_A)).toBe(0);
      const rows = await db.select<{ id: string }[]>(
        "SELECT id FROM quick_notes WHERE id = $1",
        [id]
      );
      expect(rows).toEqual([]);
    } finally {
      db.close();
    }
  });
});

describe("noteBodyToSceneDoc — Yjs encoder round-trip", () => {
  it("encodes a single-line body recoverable via extractPlainText", () => {
    const doc = new Y.Doc();
    applyEncoded(doc, noteBodyToSceneDoc("a single line of thought"));
    expect(extractPlainText(doc)).toBe("a single line of thought");
  });

  it("encodes a multi-line body as one paragraph per line", () => {
    const body = "first paragraph\nsecond paragraph\nthird";
    const doc = new Y.Doc();
    applyEncoded(doc, noteBodyToSceneDoc(body));
    expect(extractPlainText(doc)).toBe(body);
  });

  // Edge inputs the round-trip contract must hold for, even though the capture
  // UI guards against empty bodies — locks the encoder against future regressions.
  it.each([
    ["empty body", ""],
    ["whitespace-only body", "   "],
    ["trailing newline", "a thought\n"],
    ["consecutive blank lines", "a\n\nb"],
  ])("round-trips %s", (_label, body) => {
    const doc = new Y.Doc();
    applyEncoded(doc, noteBodyToSceneDoc(body));
    expect(extractPlainText(doc)).toBe(body);
  });
});

describe("promoteNoteToScene — orchestration", () => {
  it("creates a Short-pieces scene seeded with the note body and files the note", async () => {
    const db = await freshDb();
    try {
      const quickNoteStore = storeOn(db);
      const binderStore = new InMemoryBinderStore();
      const sceneDocStore = new InMemorySceneDocStore();
      await binderStore.createProject({ title: "Salt Road", type: "novel" });

      const body = "promote me into a scene\nwith two lines";
      await quickNoteStore.create(PROJ_A, body);
      const note = (await quickNoteStore.listUnfiled(PROJ_A))[0];

      const sceneId = await promoteNoteToScene(
        { binderStore, sceneDocStore, quickNoteStore },
        { note, projectId: PROJ_A }
      );

      // A single scene now exists in the project, in Short pieces (folder_id null).
      const { scenes } = await binderStore.loadProject(PROJ_A);
      expect(scenes).toHaveLength(1);
      expect(scenes[0].id).toBe(sceneId);
      expect(scenes[0].folder_id).toBeNull();
      expect(scenes[0].title.length).toBeGreaterThan(0);

      // The scene doc round-trips to the note body; projection is set.
      const base64 = await sceneDocStore.load(sceneId);
      expect(base64).not.toBeNull();
      const doc = new Y.Doc();
      applyEncoded(doc, base64 as string);
      expect(extractPlainText(doc)).toBe(body);
      expect(await sceneDocStore.loadProjection(sceneId)).toBe(body);

      // The note is filed and no longer in the inbox.
      expect(await quickNoteStore.countUnfiled(PROJ_A)).toBe(0);
    } finally {
      db.close();
    }
  });
});
