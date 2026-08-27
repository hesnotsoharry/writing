import { describe, expect, it } from "vitest";

import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { SqliteSyncOutboxStore } from "../../db/sqliteSyncOutboxStore";
import { LwwPublisher } from "../../sync/lww/publisher";
import { LwwReconciler } from "../../sync/lww/reconciler";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import type { RowMessage } from "../../sync/messages";
import { DurableOutbox } from "../../sync/outbox";
import { makeSqlJsDb } from "../support/sqljsDb";

describe("generic LWW replication", () => {
  it("uses a test-only registered domain and learns shadow ownership before projection", async () => {
    const dbA = await makeSqlJsDb(); const dbB = await makeSqlJsDb();
    await runMigrations(dbA); await runMigrations(dbB);
    try {
      const storeA = new SqliteSyncLwwStore(dbA); const storeB = new SqliteSyncLwwStore(dbB);
      const outbox = new DurableOutbox(new SqliteSyncOutboxStore(dbA));
      const registryA = new LwwDomainRegistry(); const registryB = new LwwDomainRegistry();
      registryA.register({ domain: "fake", readPayload: async () => "{\"title\":\"local\"}",
        projectReceived: async () => undefined, applyTombstone: async () => undefined });
      let projected = false; let shadowExistedAtProjection = false;
      registryB.register({ domain: "fake", readPayload: async () => null,
        projectReceived: async () => {
          shadowExistedAtProjection = await storeB.get("fake", "r1") !== null; projected = true;
        }, applyTombstone: async () => undefined });
      const sent: RowMessage[] = [];
      const publisher = new LwwPublisher({ store: storeA, registry: registryA, outbox,
        send: async (message) => { sent.push(message); }, deviceId: () => "device-a" });
      expect(await publisher.publish({
        domain: "fake", projectId: "p1", rowId: "r1", deleted: false,
      })).toBe(true);
      expect(await new SqliteSyncOutboxStore(dbA).listPending()).toHaveLength(1);
      const receiver = new LwwReconciler(storeB, registryB, async () => undefined);
      const ack = await receiver.receiveRow(sent[0]);
      expect({ projected, shadowExistedAtProjection }).toEqual({
        projected: true, shadowExistedAtProjection: true,
      });
      expect(ack?.id).toBe("fake:r1");
      await outbox.acknowledge(ack!.id);
      expect(await new SqliteSyncOutboxStore(dbA).listPending()).toHaveLength(0);
    } finally { dbA.close(); dbB.close(); }
  });

  it("re-projects an identical retry after a failed first projection", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    try {
      const store = new SqliteSyncLwwStore(db);
      const registry = new LwwDomainRegistry();
      let attempts = 0;
      registry.register({
        domain: "fake",
        readPayload: async () => null,
        projectReceived: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("SQLITE_BUSY");
        },
        applyTombstone: async () => undefined,
      });
      const receiver = new LwwReconciler(store, registry, async () => undefined);
      const inbound = {
        t: "row" as const, id: "fake:r1", domain: "fake", project: "p1", row: "r1",
        hlc: "000000000001000-000000", device: "device-a", deleted: false,
        payload: "{\"title\":\"hello\"}",
      };
      await expect(receiver.receiveRow(inbound)).rejects.toThrow("SQLITE_BUSY");
      expect(await store.get("fake", "r1")).not.toBeNull();
      const ack = await receiver.receiveRow(inbound);
      expect(attempts).toBe(2);
      expect(ack?.id).toBe("fake:r1");
    } finally { db.close(); }
  });
});
