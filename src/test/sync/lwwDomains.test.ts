import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../db/dbClient";
import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { LwwReconciler } from "../../sync/lww/reconciler";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import {
  createLwwLocalBridges,
  registerLwwDomains,
} from "../../sync/lwwDomains";
import type { RowMessage } from "../../sync/messages";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

interface Fixture {
  domain: string;
  rowId: string;
  projectId: string;
  table: string;
  key: string;
  payload: Record<string, unknown>;
  changed: Record<string, unknown>;
}

const fixtures: Fixture[] = [
  { domain: "goals", rowId: "g1", projectId: "p1", table: "goals", key: "id",
    payload: { id: "g1", project_id: "p1", goal_type: "daily", target: 500,
      enabled: 1, created_at: 1, config_json: "{\"days\":[1,2]}", updated_at: "one" },
    changed: { target: 900, updated_at: "two" } },
  { domain: "quick_notes", rowId: "n1", projectId: "p1", table: "quick_notes", key: "id",
    payload: { id: "n1", project_id: "p1", body: "capture", created_at: 2,
      filed: 0, source: "share", state: "inbox" },
    changed: { body: "edited", filed: 1, state: "filed" } },
  { domain: "archive", rowId: "a1", projectId: "p1", table: "archive", key: "id",
    payload: { id: "a1", project_id: "p1", kind: "scene", original_id: "s1",
      title: "Old scene", sub: null, state_base64: "{\"doc\":\"YWJj\"}", archived_at: 3 },
    changed: { title: "Winning archive" } },
  { domain: "scene_snapshots", rowId: "ss1", projectId: "p1",
    table: "scene_snapshots", key: "id",
    payload: { id: "ss1", scene_id: "s1", label: "Before", state_base64: "YWJj",
      word_count: 10, created_at: 4, kind: "manual" }, changed: { label: "After" } },
  { domain: "boards", rowId: "b1", projectId: "p1", table: "boards", key: "id",
    payload: { id: "b1", project_id: "p1", title: "Plot", sort: 1024 },
    changed: { title: "Winning board", sort: 1536 } },
  { domain: "manuscript_about", rowId: "p1", projectId: "p1",
    table: "manuscript_about", key: "project_id",
    payload: { project_id: "p1", synopsis: "A", genre: "Fantasy", tone: "Warm",
      pov: "Third", notes: "None" }, changed: { synopsis: "Winner" } },
  { domain: "ai_conversations", rowId: "conversation:c1", projectId: "p1",
    table: "ai_conversations", key: "id",
    payload: { id: "c1", project_id: "p1", title: "Chat", last_verb: null,
      boundary_chapter_id: null, context_config: null, created_at: 5, updated_at: 5 },
    changed: { title: "Winning chat", updated_at: 6 } },
];

async function setup(): Promise<{ db: SqlJsTestDb; registry: LwwDomainRegistry }> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  const registry = new LwwDomainRegistry();
  registerLwwDomains(registry, db, { aiConversationsEnabled: true });
  return { db, registry };
}

function message(
  fixture: Fixture,
  payload: Record<string, unknown>,
  version: string,
  options: { device?: string; deleted?: boolean } = {},
): RowMessage {
  const { device = "a", deleted = false } = options;
  return { t: "row", id: `${fixture.domain}:${fixture.rowId}`, domain: fixture.domain,
    project: fixture.projectId, row: fixture.rowId, hlc: version, device, deleted,
    payload: deleted ? null : JSON.stringify(payload) };
}

async function readRow(db: DbClient, fixture: Fixture): Promise<Record<string, unknown> | null> {
  const rows = await db.select<Array<Record<string, unknown>>>(
    `SELECT * FROM ${fixture.table} WHERE ${fixture.key} = ?`,
    [fixture.rowId.replace(/^conversation:/, "")],
  );
  return rows[0] ?? null;
}

describe.each(fixtures)("$domain LWW domain", (fixture) => {
  it("round-trips the complete row", async () => {
    const source = await setup(); const target = await setup();
    try {
      const adapter = source.registry.get(fixture.domain)!;
      await adapter.projectReceived(fixture.rowId, fixture.projectId, JSON.stringify(fixture.payload));
      const payload = await adapter.readPayload(fixture.rowId);
      const receiver = new LwwReconciler(
        new SqliteSyncLwwStore(target.db), target.registry, async () => undefined,
      );
      await receiver.receiveRow({ ...message(fixture, fixture.payload,
        "000000000000001-000000"), payload });
      expect(await readRow(target.db, fixture)).toMatchObject(fixture.payload);
    } finally { source.db.close(); target.db.close(); }
  });

  it("converges concurrent writes to the same winner in either arrival order", async () => {
    const first = await setup(); const second = await setup();
    const winner = { ...fixture.payload, ...fixture.changed };
    const low = message(fixture, fixture.payload, "000000000000010-000000",
      { device: "device-a" });
    const high = message(fixture, winner, "000000000000010-000000",
      { device: "device-b" });
    try {
      const receiveA = new LwwReconciler(new SqliteSyncLwwStore(first.db), first.registry,
        async () => undefined);
      const receiveB = new LwwReconciler(new SqliteSyncLwwStore(second.db), second.registry,
        async () => undefined);
      await receiveA.receiveRow(low); await receiveA.receiveRow(high);
      await receiveB.receiveRow(high); await receiveB.receiveRow(low);
      expect(await readRow(first.db, fixture)).toEqual(await readRow(second.db, fixture));
      expect(await readRow(first.db, fixture)).toMatchObject(winner);
    } finally { first.db.close(); second.db.close(); }
  });

  it("does not resurrect after a tombstone followed by a stale write", async () => {
    const { db, registry } = await setup();
    try {
      const receiver = new LwwReconciler(new SqliteSyncLwwStore(db), registry, async () => undefined);
      await receiver.receiveRow(message(fixture, fixture.payload, "000000000000020-000000"));
      await receiver.receiveRow(message(fixture, fixture.payload, "000000000000030-000000",
        { deleted: true }));
      await receiver.receiveRow(message(fixture, fixture.payload, "000000000000025-000000",
        { device: "z" }));
      expect(await readRow(db, fixture)).toBeNull();
    } finally { db.close(); }
  });
});

describe("origin-aware LWW bridges", () => {
  it.each(fixtures)("$domain local writes fire and remote writes do not fire", async (fixture) => {
    const publish = vi.fn().mockResolvedValue(true);
    const bridges = createLwwLocalBridges(publish, () => true);
    await fireLocalBridge(fixture, bridges);
    expect(publish).toHaveBeenCalledWith({ domain: fixture.domain,
      projectId: fixture.projectId, rowId: fixture.rowId, deleted: false });
    const { db, registry } = await setup();
    try {
      const receiver = new LwwReconciler(new SqliteSyncLwwStore(db), registry, async () => undefined);
      await receiver.receiveRow(message(fixture, fixture.payload, "000000000000001-000000",
        { device: "remote" }));
      expect(publish).toHaveBeenCalledTimes(1);
    } finally { db.close(); }
  });
});

type LwwLocalBridges = ReturnType<typeof createLwwLocalBridges>;

async function fireLocalBridge(fixture: Fixture, bridges: LwwLocalBridges): Promise<void> {
  if (fixture.domain === "ai_conversations") {
    await bridges.aiConversations.conversationSaved(fixture.projectId, "c1"); return;
  }
  const byDomain: Record<string, LwwLocalBridges["goals"]> = {
    goals: bridges.goals, quick_notes: bridges.quickNotes, archive: bridges.archive,
    scene_snapshots: bridges.sceneSnapshots, boards: bridges.boards,
    manuscript_about: bridges.manuscriptAbout,
  };
  await byDomain[fixture.domain].saved(fixture.projectId, fixture.rowId);
}

describe("domain boundaries", () => {
  it("the goals payload excludes progress, streak, baseline and met-day state", () => {
    const goal = fixtures.find(({ domain }) => domain === "goals")!.payload;
    expect(Object.keys(goal).sort()).toEqual([
      "config_json", "created_at", "enabled", "goal_type", "id", "project_id", "target", "updated_at",
    ]);
  });

  it("the registered goals reader cannot advertise device-local progress state", async () => {
    const { db, registry } = await setup();
    const fixture = fixtures.find(({ domain }) => domain === "goals")!;
    try {
      await registry.get("goals")!.projectReceived("g1", "p1", JSON.stringify(fixture.payload));
      const payload: unknown = JSON.parse(await registry.get("goals")!.readPayload("g1") ?? "null");
      expect(Object.keys(payload as Record<string, unknown>).sort()).toEqual(Object.keys(fixture.payload).sort());
    } finally { db.close(); }
  });

  it("receiving a snapshot leaves the live scene document byte-identical", async () => {
    const { db, registry } = await setup();
    try {
      await db.execute("INSERT INTO scene_docs (scene_id, state_base64) VALUES (?, ?)", ["s1", "LIVE_BYTES"]);
      const fixture = fixtures.find(({ domain }) => domain === "scene_snapshots")!;
      const receiver = new LwwReconciler(new SqliteSyncLwwStore(db), registry, async () => undefined);
      await receiver.receiveRow(message(fixture, fixture.payload, "000000000000001-000000"));
      const docs = await db.select<Array<{ state_base64: string }>>(
        "SELECT state_base64 FROM scene_docs WHERE scene_id = ?", ["s1"],
      );
      expect(docs[0].state_base64).toBe("LIVE_BYTES");
    } finally { db.close(); }
  });

  it("round-trips a large multi-scene archive manifest intact", async () => {
    const { db, registry } = await setup();
    const fixture = fixtures.find(({ domain }) => domain === "archive")!;
    const scenes = Array.from({ length: 20 }, (_, index) => ({
      id: `s${index}`, title: `Scene ${index}`, meta: { word_count: index },
      doc: "eA==".repeat(20_000),
    }));
    const payload = { ...fixture.payload, kind: "chapter", state_base64: JSON.stringify({ scenes }) };
    try {
      const receiver = new LwwReconciler(new SqliteSyncLwwStore(db), registry, async () => undefined);
      await receiver.receiveRow(message(fixture, payload, "000000000000001-000000"));
      expect((await readRow(db, fixture))?.state_base64).toBe(payload.state_base64);
    } finally { db.close(); }
  });
});
