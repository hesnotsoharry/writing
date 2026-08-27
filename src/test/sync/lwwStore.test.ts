import { describe, expect, it } from "vitest";

import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import type { SyncLwwRow } from "../../db/syncLwwStore";
import { makeSqlJsDb } from "../support/sqljsDb";

const row = (overrides: Partial<SyncLwwRow> = {}): SyncLwwRow => ({
  domain: "fake", projectId: "p1", rowId: "r1",
  hlc: "000000000001000-000000", deviceId: "device-a", deleted: false,
  payloadJson: "{\"value\":1}", updatedAt: null, ...overrides,
});

describe("LWW shadow store", () => {
  it("does not resurrect a tombstoned row with a stale write", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    try {
      const store = new SqliteSyncLwwStore(db);
      await store.putIfNewer(row({ hlc: "000000000002000-000000", deleted: true,
        payloadJson: null }));
      expect(await store.putIfNewer(row())).toBe(false);
      expect(await store.get("fake", "r1")).toMatchObject({ deleted: true, payloadJson: null });
    } finally { db.close(); }
  });

  it("reports the highest HLC across the ledger", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    try {
      const store = new SqliteSyncLwwStore(db);
      expect(await store.maxHlc()).toBeNull();
      await store.putIfNewer(row({ hlc: "000000000001000-000000" }));
      await store.putIfNewer(row({ rowId: "r2", hlc: "000000000009000-000000" }));
      expect(await store.maxHlc()).toBe("000000000009000-000000");
    } finally { db.close(); }
  });

  it("converges concurrent writes regardless of arrival order", async () => {
    const dbA = await makeSqlJsDb(); const dbB = await makeSqlJsDb();
    await runMigrations(dbA); await runMigrations(dbB);
    try {
      const a = new SqliteSyncLwwStore(dbA); const b = new SqliteSyncLwwStore(dbB);
      const left = row({ deviceId: "device-a", payloadJson: "{\"winner\":false}" });
      const right = row({ deviceId: "device-b", payloadJson: "{\"winner\":true}" });
      await a.putIfNewer(left); await a.putIfNewer(right);
      await b.putIfNewer(right); await b.putIfNewer(left);
      expect(await a.get("fake", "r1")).toEqual(await b.get("fake", "r1"));
      expect((await a.get("fake", "r1"))?.deviceId).toBe("device-b");
    } finally { dbA.close(); dbB.close(); }
  });
});
