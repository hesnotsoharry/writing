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
});
