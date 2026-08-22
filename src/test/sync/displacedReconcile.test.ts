import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { SqliteSyncOutboxStore } from "../../db/sqliteSyncOutboxStore";
import { buildRowReconciler } from "../../sync/lww/reconcilerWiring";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import { registerLwwDomains } from "../../sync/lwwDomains";
import type { RowMessage } from "../../sync/messages";
import { DurableOutbox } from "../../sync/outbox";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

const PROJECT = "project-1";
const NOTE = "note-1";

function noteRow(body: string): string {
  return JSON.stringify({
    id: NOTE, project_id: PROJECT, body, created_at: 1, filed: 0,
    source: "Typed", state: "inbox",
  });
}

function remoteWrite(payload: string, hlc = "9999"): RowMessage {
  return { t: "row", id: `quick_notes:${NOTE}`, domain: "quick_notes", project: PROJECT,
    row: NOTE, hlc, device: "device-b", deleted: false, payload };
}

describe("a remote row that beats an unsent local edit", () => {
  let db: SqlJsTestDb;
  let registry: LwwDomainRegistry;
  let outbox: DurableOutbox;
  let published: string[];

  async function reconcile(message: RowMessage) {
    const reconciler = buildRowReconciler({
      store: new SqliteSyncLwwStore(db), registry,
      send: () => Promise.resolve(), outbox: () => outbox, observe: () => undefined,
      publish: (mutation) => { published.push(mutation.rowId); return Promise.resolve(true); },
    });
    await reconciler?.receiveRow(message);
  }

  async function localNotes(): Promise<Array<{ id: string; body: string; source: string }>> {
    return db.select("SELECT id, body, source FROM quick_notes ORDER BY body");
  }

  beforeEach(async () => {
    db = await makeSqlJsDb();
    await runMigrations(db);
    registry = new LwwDomainRegistry();
    registerLwwDomains(registry, db);
    outbox = new DurableOutbox(new SqliteSyncOutboxStore(db));
    published = [];
    await db.execute(
      "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?)",
      [PROJECT, "The Salt Road", "novel", 0, 1, 1],
    );
    await db.execute(
      `INSERT INTO quick_notes (id, project_id, body, created_at, filed, source, state)
       VALUES ('${NOTE}', '${PROJECT}', 'my version', 1, 0, 'Typed', 'inbox')`,
    );
  });

  it("keeps the local version as an inbox note instead of overwriting it away", async () => {
    // Our edit is still queued, so the peer has never seen it: a real collision.
    await outbox.enqueue({ domain: "quick_notes", projectId: PROJECT, itemId: NOTE,
      kind: "row", message: remoteWrite(noteRow("my version")) });

    await reconcile(remoteWrite(noteRow("their version")));

    const notes = await localNotes();
    expect(notes.map((note) => note.body)).toEqual(["my version", "their version"]);
    // The winner keeps the original row id; the loser is a new note that says
    // where it came from.
    expect(notes.find((note) => note.body === "their version")?.id).toBe(NOTE);
    expect(notes.find((note) => note.body === "my version")?.source)
      .toBe("Replaced by another device");
  });

  it("publishes the preserved copy so it is not stranded on this device", async () => {
    await outbox.enqueue({ domain: "quick_notes", projectId: PROJECT, itemId: NOTE,
      kind: "row", message: remoteWrite(noteRow("my version")) });
    await reconcile(remoteWrite(noteRow("their version")));
    expect(published).toHaveLength(1);
    expect(published[0]).not.toBe(NOTE);
  });

  it("overwrites silently when we have nothing pending — that is an echo, not a clash", async () => {
    await reconcile(remoteWrite(noteRow("their version")));
    expect((await localNotes()).map((note) => note.body)).toEqual(["their version"]);
  });

  it("keeps nothing when the incoming payload matches what we already hold", async () => {
    await outbox.enqueue({ domain: "quick_notes", projectId: PROJECT, itemId: NOTE,
      kind: "row", message: remoteWrite(noteRow("my version")) });
    await reconcile(remoteWrite(noteRow("my version")));
    expect((await localNotes()).map((note) => note.body)).toEqual(["my version"]);
  });

  it("keeps nothing when the remote row loses", async () => {
    await outbox.enqueue({ domain: "quick_notes", projectId: PROJECT, itemId: NOTE,
      kind: "row", message: remoteWrite(noteRow("my version")) });
    // Land a newer local version in the ledger first so the incoming one is stale.
    await new SqliteSyncLwwStore(db).putIfNewer({
      domain: "quick_notes", projectId: PROJECT, rowId: NOTE, hlc: "9999",
      deviceId: "device-z", deleted: false, payloadJson: noteRow("my version"),
      updatedAt: new Date().toISOString(),
    });
    await reconcile(remoteWrite(noteRow("their version"), "0001"));
    expect((await localNotes()).map((note) => note.body)).toEqual(["my version"]);
  });
});
