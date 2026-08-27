import { beforeEach, describe, expect, it } from "vitest";

import type { DbClient } from "../../db/dbClient";
import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { seedLwwLedger } from "../../sync/lww/backfill";
import { LwwReconciler, PUSH_BATCH_SIZE } from "../../sync/lww/reconciler";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import { registerLwwDomains } from "../../sync/lwwDomains";
import {
  isRowMessage, type RowAckMessage, type RowHelloMessage, type RowMessage,
} from "../../sync/messages";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

type AnyRowFrame = RowMessage | RowAckMessage | RowHelloMessage;

interface Side {
  db: SqlJsTestDb;
  store: SqliteSyncLwwStore;
  registry: LwwDomainRegistry;
  reconciler: LwwReconciler;
  sent: AnyRowFrame[];
}

/** Delivers frames one at a time so an answered summary is fully handled
 *  before the next frame, mirroring the engine's serialized inbound chain. */
class Pipe {
  private readonly queue: Array<() => Promise<void>> = [];

  enqueue(task: () => Promise<void>): void { this.queue.push(task); }

  async drain(): Promise<void> {
    let guard = 0;
    while (this.queue.length > 0) {
      if (++guard > 200) throw new Error("frames never settled — the two sides are ping-ponging");
      await this.queue.shift()?.();
    }
  }
}

async function deliver(target: Side, message: AnyRowFrame): Promise<void> {
  if (message.t === "row-hello") { await target.reconciler.receiveSummary(message); return; }
  if (message.t === "row") { await target.reconciler.receiveRow(message); }
}

async function makeSide(pipe: Pipe, peer: () => Side): Promise<Side> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  const registry = new LwwDomainRegistry();
  registerLwwDomains(registry, db);
  const sent: AnyRowFrame[] = [];
  const store = new SqliteSyncLwwStore(db);
  const reconciler = new LwwReconciler(store, registry, async (message) => {
    sent.push(message);
    pipe.enqueue(() => deliver(peer(), message));
  });
  return { db, store, registry, reconciler, sent };
}

/** Rows written before sync existed: straight into the tables, no ledger entry. */
async function writePreSyncRows(db: DbClient): Promise<void> {
  await db.execute(
    "INSERT INTO projects (id,title,type,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    ["p1", "Salt", "novel", 1000, "now", "now"],
  );
  await db.execute(
    "INSERT INTO boards (id,project_id,title,sort) VALUES (?,?,?,?)",
    ["brainstorm-default", "p1", "Default Board", 0],
  );
  await db.execute(
    `INSERT INTO goals (id,project_id,goal_type,target,enabled,created_at,config_json,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["g1", "p1", "daily", 500, 1, 1_700_000_000_000, "{}", "2026-08-01T00:00:00.000Z"],
  );
}

function helloFrames(side: Side): RowHelloMessage[] {
  return side.sent.filter((frame): frame is RowHelloMessage => frame.t === "row-hello");
}

describe("LWW pull reconciliation", () => {
  let pipe: Pipe;
  let a: Side;
  let b: Side;

  beforeEach(async () => {
    pipe = new Pipe();
    // eslint-disable-next-line prefer-const
    let sides: { a: Side; b: Side };
    a = await makeSide(pipe, () => sides.b);
    b = await makeSide(pipe, () => sides.a);
    sides = { a, b };
    await writePreSyncRows(a.db);
    await seedLwwLedger({ store: a.store, registry: a.registry, deviceId: "device-a" });
  });

  it("backfills a peer that has nothing to announce", async () => {
    await a.reconciler.sendAllSummaries();
    await pipe.drain();

    const boards = await b.db.select<Array<{ id: string; title: string }>>(
      "SELECT id, title FROM boards",
    );
    // The whole point: B never announced anything, so under push-only
    // reconciliation this row could never reach it.
    expect(boards).toEqual([{ id: "brainstorm-default", title: "Default Board" }]);
    const goals = await b.db.select<Array<{ id: string }>>("SELECT id FROM goals");
    expect(goals).toEqual([{ id: "g1" }]);
  });

  it("answers each scope exactly once", async () => {
    await a.reconciler.sendAllSummaries();
    await pipe.drain();

    const answered = helloFrames(b).map((frame) => `${frame.domain}:${frame.project ?? ""}`);
    // One answer per scope, no more. Losing this guard turns the answer into an
    // unbounded exchange of summaries between the two devices.
    expect(answered).toEqual(["boards:p1", "goals:p1"]);
    expect(new Set(answered).size).toBe(answered.length);
  });

  it("materialises a seeded row's payload so the frame is valid on the wire", async () => {
    const seeded = await a.store.get("boards", "brainstorm-default");
    expect(seeded?.payloadJson).toBeNull();

    await a.reconciler.sendAllSummaries();
    await pipe.drain();

    const rows = a.sent.filter(isRowMessage);
    const board = rows.find((row) => row.row === "brainstorm-default");
    // A `{deleted:false, payload:null}` frame fails validation at the receiver
    // and is silently dropped, so the row would never arrive.
    expect(board?.payload).not.toBeNull();
    expect(isRowMessage(board)).toBe(true);
    expect(board?.hlc).toBe(seeded?.hlc);
  });

  it("says nothing about a seeded row whose table row has since gone", async () => {
    await a.db.execute("DELETE FROM boards WHERE id = ?", ["brainstorm-default"]);

    await a.reconciler.sendAllSummaries();
    await pipe.drain();

    expect(a.sent.filter(isRowMessage).map((row) => row.row)).toEqual(["g1"]);
    expect(await b.db.select("SELECT id FROM boards")).toEqual([]);
  });

  it("does not answer a scope where the peer told it nothing new", async () => {
    await a.reconciler.sendAllSummaries();
    await pipe.drain();
    b.sent.length = 0;

    await a.reconciler.sendAllSummaries();
    await pipe.drain();

    // B now knows every row A named, so there is nothing to pull.
    expect(helloFrames(b)).toEqual([]);
  });

  it("delivers a large backfill in full, yielding between batches", async () => {
    const total = PUSH_BATCH_SIZE * 2 + 3;
    for (let index = 0; index < total; index += 1) {
      await a.db.execute(
        "INSERT INTO quick_notes (id,project_id,body,created_at,filed,source,state) VALUES (?,?,?,?,?,?,?)",
        [`n${String(index).padStart(3, "0")}`, "p1", `note ${index}`, 1_700_000_000_000 + index,
          0, "share", "inbox"],
      );
    }
    await seedLwwLedger({ store: a.store, registry: a.registry, deviceId: "device-a" });

    await a.reconciler.sendAllSummaries();
    await pipe.drain();

    const received = await b.db.select<Array<{ n: number }>>(
      "SELECT COUNT(*) AS n FROM quick_notes",
    );
    // Pacing must never become capping: the peer needs every row, and nothing
    // re-sends row summaries on the sweep to deliver a stranded remainder.
    expect(received[0].n).toBe(total);
  });

  it("re-arms the answer after a reconnect", async () => {
    await a.reconciler.sendAllSummaries();
    await pipe.drain();
    // Simulate a disconnect that loses B's projection but not A's ledger, so B
    // has something to pull again. Without reset() the spent guard would keep
    // B silent forever.
    await b.db.execute("DELETE FROM boards");
    await b.db.execute("DELETE FROM sync_lww_rows");
    b.reconciler.reset();
    b.sent.length = 0;

    await a.reconciler.sendAllSummaries();
    await pipe.drain();

    expect(helloFrames(b).length).toBeGreaterThan(0);
    expect(await b.db.select("SELECT id FROM boards")).toEqual([{ id: "brainstorm-default" }]);
  });

  it("does not let a third device's summary pages pollute another peer's seen set", async () => {
    const store = a.store;
    const hlc = "000000000001000-000000";
    for (const rowId of ["r1", "r2", "r-needed"]) {
      await store.putIfNewer({
        domain: "boards", projectId: "p1", rowId, hlc, deviceId: "device-a",
        deleted: false, payloadJson: JSON.stringify({
          id: rowId, project_id: "p1", title: rowId, sort: 0,
        }), updatedAt: null,
      });
    }
    a.sent.length = 0;
    const summary = (
      sender: string, ids: string[], more: boolean, cursor?: string,
    ): RowHelloMessage => ({
      t: "row-hello", domain: "boards", project: "p1", sender, more, cursor,
      rows: ids.map((id) => ({ id, hlc, device: sender, deleted: false })),
    });

    await a.reconciler.receiveSummary(summary("device-b", ["r1"], true, "r1"));
    await a.reconciler.receiveSummary(summary("device-c", ["r-needed"], true, "r-needed"));
    await a.reconciler.receiveSummary(summary("device-b", ["r2"], false));

    const pushed = a.sent.filter(isRowMessage).map((frame) => frame.row).sort();
    expect(pushed).toContain("r-needed");
    expect(pushed.filter((row) => row === "r1")).toHaveLength(0);
  });
});
