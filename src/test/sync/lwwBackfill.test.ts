import { describe, expect, it } from "vitest";

import type { DbClient } from "../../db/dbClient";
import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { seedLwwLedger } from "../../sync/lww/backfill";
import { encodeHlc } from "../../sync/lww/hlc";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import { registerLwwDomains } from "../../sync/lwwDomains";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

const DEVICE = "device-a";

interface Fixture { db: SqlJsTestDb; store: SqliteSyncLwwStore; registry: LwwDomainRegistry }

async function insert(db: DbClient, table: string, row: Record<string, unknown>): Promise<void> {
  const columns = Object.keys(row);
  await db.execute(
    `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    columns.map((column) => row[column]),
  );
}

/**
 * Writes straight into the feature tables — no bridge, no publish, no ledger
 * entry. This is the shape of a user whose writing predates the day sync was
 * switched on, and it is the case no existing test covered.
 */
async function seedPreSyncData(db: DbClient): Promise<void> {
  await insert(db, "projects", { id: "p1", title: "Salt", type: "novel",
    sort_order: 1000, created_at: "now", updated_at: "now" });
  await insert(db, "scenes", { id: "s1", project_id: "p1", folder_id: null,
    title: "Opening", sort_order: 1000, word_count: 0, status: "draft" });
  await insert(db, "boards", { id: "brainstorm-default", project_id: "p1",
    title: "Default Board", sort: 0 });
  await insert(db, "goals", { id: "g1", project_id: "p1", goal_type: "daily",
    target: 500, enabled: 1, created_at: 1_700_000_000_000, config_json: "{}",
    updated_at: "2026-08-01T00:00:00.000Z" });
  await insert(db, "quick_notes", { id: "n1", project_id: "p1", body: "capture",
    created_at: 1_700_000_001_000, filed: 0, source: "share", state: "inbox" });
  await insert(db, "archive", { id: "a1", project_id: "p1", kind: "scene",
    original_id: "s1", title: "Old", sub: null, state_base64: "YWJj",
    archived_at: 1_700_000_002_000 });
  await insert(db, "scene_snapshots", { id: "ss1", scene_id: "s1", label: "Before",
    state_base64: "YWJj", word_count: 10, created_at: 1_700_000_003_000, kind: "manual" });
}

async function setup(): Promise<Fixture> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  const registry = new LwwDomainRegistry();
  registerLwwDomains(registry, db, { aiConversationsEnabled: true });
  await seedPreSyncData(db);
  return { db, store: new SqliteSyncLwwStore(db), registry };
}

function seed(fixture: Fixture, now = Date.now()): Promise<number> {
  return seedLwwLedger({ store: fixture.store, registry: fixture.registry,
    deviceId: DEVICE, now: () => now });
}

async function ledgerRows(db: DbClient): Promise<Array<Record<string, unknown>>> {
  return db.select<Array<Record<string, unknown>>>(
    "SELECT domain, row_id, project_id, hlc, deleted, payload_json FROM sync_lww_rows ORDER BY domain, row_id",
  );
}

describe("seedLwwLedger", () => {
  it("makes every pre-existing row announceable", async () => {
    const fixture = await setup();
    expect(await ledgerRows(fixture.db)).toHaveLength(0);

    await seed(fixture);

    const byDomain = new Map((await ledgerRows(fixture.db))
      .map((row) => [`${row.domain as string}:${row.row_id as string}`, row]));
    expect([...byDomain.keys()].sort()).toEqual([
      "archive:a1", "boards:brainstorm-default", "goals:g1",
      "quick_notes:n1", "scene_snapshots:ss1",
    ]);
    // The observed bug, in one assertion: the board record is now advertisable,
    // so a freshly paired device is not left holding orphan board content.
    expect(byDomain.get("boards:brainstorm-default")?.project_id).toBe("p1");
    expect(byDomain.get("boards:brainstorm-default")?.deleted).toBe(0);
  });

  it("scopes a snapshot by its scene's project, matching what publishing uses", async () => {
    const fixture = await setup();
    await seed(fixture);
    const row = (await ledgerRows(fixture.db))
      .find((candidate) => candidate.row_id === "ss1");
    // scene_snapshots has no project_id column; a mismatch here would file the
    // seeded and the published row into two unrelated scopes.
    expect(row?.project_id).toBe("p1");
  });

  it("never re-seeds a tombstoned row", async () => {
    const fixture = await setup();
    const tombstone = encodeHlc({ physical: 1_700_000_500_000, counter: 0 });
    await fixture.store.putIfNewer({ domain: "boards", projectId: "p1",
      rowId: "brainstorm-default", hlc: tombstone, deviceId: "device-b",
      deleted: true, payloadJson: null, updatedAt: null });

    await seed(fixture);

    const row = (await ledgerRows(fixture.db))
      .find((candidate) => candidate.row_id === "brainstorm-default");
    // Re-seeding this as live would un-delete the board here and then propagate
    // the resurrection to every paired device as the winning version.
    expect(row?.deleted).toBe(1);
    expect(row?.hlc).toBe(tombstone);
  });

  it("is idempotent", async () => {
    const fixture = await setup();
    const first = await seed(fixture);
    const after = await ledgerRows(fixture.db);

    const second = await seed(fixture);

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
    expect(await ledgerRows(fixture.db)).toEqual(after);
  });

  it("seeds a stamp that loses to a later real edit", async () => {
    const fixture = await setup();
    await seed(fixture);
    const seeded = (await fixture.store.get("boards", "brainstorm-default"))!;

    const edit = encodeHlc({ physical: Date.now(), counter: 0 });
    const accepted = await fixture.store.putIfNewer({ domain: "boards", projectId: "p1",
      rowId: "brainstorm-default", hlc: edit, deviceId: "device-b", deleted: false,
      payloadJson: "{}", updatedAt: null });

    expect(accepted).toBe(true);
    expect(seeded.hlc < edit).toBe(true);
  });

  it("stamps from the row's own timestamp, never the clock", async () => {
    const fixture = await setup();
    const now = 1_800_000_000_000;

    await seed(fixture, now);

    const note = (await fixture.store.get("quick_notes", "n1"))!;
    expect(note.hlc).toBe(encodeHlc({ physical: 1_700_000_001_000, counter: 0 }));
    // A goal carries an ISO `updated_at` while everything else is epoch ms; both
    // must resolve, and neither may fall through to `now`.
    const goal = (await fixture.store.get("goals", "g1"))!;
    expect(goal.hlc).toBe(encodeHlc({
      physical: Date.parse("2026-08-01T00:00:00.000Z"), counter: 0,
    }));
  });

  it("leaves a stampless row at the floor rather than at now", async () => {
    const fixture = await setup();
    await seed(fixture, 1_800_000_000_000);
    const board = (await fixture.store.get("boards", "brainstorm-default"))!;
    expect(board.hlc).toBe(encodeHlc({ physical: 0, counter: 0 }));
  });

  it("announces an About page with content but not a blank one", async () => {
    const fixture = await setup();
    await insert(fixture.db, "projects", { id: "p2", title: "Empty", type: "novel",
      sort_order: 2000, created_at: "now", updated_at: "now" });
    await insert(fixture.db, "manuscript_about", { project_id: "p1", synopsis: "A road.",
      genre: null, tone: null, pov: null, notes: null });
    await insert(fixture.db, "manuscript_about", { project_id: "p2", synopsis: null,
      genre: null, tone: null, pov: null, notes: null });

    await seed(fixture);

    // manuscript_about has no timestamp, so two pre-existing devices tie at 0 and
    // device id decides. Keeping blank rows out of the draw stops an untouched
    // About page from winning against a written one.
    expect(await fixture.store.get("manuscript_about", "p1")).not.toBeNull();
    expect(await fixture.store.get("manuscript_about", "p2")).toBeNull();
  });

  it("seeds AI conversations and their messages under the composite row ids", async () => {
    const fixture = await setup();
    await insert(fixture.db, "ai_conversations", { id: "c1", project_id: "p1",
      title: "Chat", last_verb: null, boundary_chapter_id: null, context_config: null,
      created_at: 1_700_000_004_000, updated_at: 1_700_000_005_000 });
    await insert(fixture.db, "ai_messages", { id: "m1", conversation_id: "c1",
      role: "you", verb: "brainstorm", body: "hi", context_json: null, credits_cost: 0,
      created_at: 1_700_000_006_000 });

    await seed(fixture);

    expect(await fixture.store.get("ai_conversations", "conversation:c1")).not.toBeNull();
    const message = await fixture.store.get("ai_conversations", "message:m1");
    expect(message?.projectId).toBe("p1");
  });

  it("skips a domain that cannot enumerate itself", async () => {
    const fixture = await setup();
    fixture.registry.register({
      domain: "opaque",
      readPayload: async () => null,
      projectReceived: async () => undefined,
      applyTombstone: async () => undefined,
    });

    await expect(seed(fixture)).resolves.toBeGreaterThan(0);
    expect(await fixture.store.listRowIds("opaque")).toEqual(new Set());
  });
});
