import { describe, expect, it } from "vitest";

import { runMigrations } from "../../db/migrations";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { SqliteSyncOutboxStore } from "../../db/sqliteSyncOutboxStore";
import { encodeHlc } from "../../sync/lww/hlc";
import { LwwPublisher } from "../../sync/lww/publisher";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import { DurableOutbox } from "../../sync/outbox";
import { makeSqlJsDb } from "../support/sqljsDb";

const FUTURE = encodeHlc({ physical: Date.now() + 10 * 60_000, counter: 0 });

class BlindMaxStore extends SqliteSyncLwwStore {
  override maxHlc(): Promise<string | null> { return Promise.resolve(null); }
}

function fakeRegistry(): LwwDomainRegistry {
  const registry = new LwwDomainRegistry();
  registry.register({
    domain: "fake",
    readPayload: async () => "{\"title\":\"local\"}",
    projectReceived: async () => undefined,
    applyTombstone: async () => undefined,
  });
  return registry;
}

describe("LWW publisher clock", () => {
  it("re-arms from the ledger max after a process restart", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    const store = new SqliteSyncLwwStore(db);
    try {
      await store.putIfNewer({
        domain: "fake", projectId: "p1", rowId: "r1", hlc: FUTURE,
        deviceId: "device-b", deleted: false, payloadJson: "{\"title\":\"remote\"}",
        updatedAt: null,
      });
      const publisher = new LwwPublisher({
        store, registry: fakeRegistry(),
        outbox: new DurableOutbox(new SqliteSyncOutboxStore(db)),
        send: async () => undefined, deviceId: () => "device-a",
      });
      expect(await publisher.publish({
        domain: "fake", projectId: "p1", rowId: "r1", deleted: false,
      })).toBe(true);
      const written = await store.get("fake", "r1");
      expect(written?.hlc && written.hlc > FUTURE).toBe(true);
      expect(written?.deviceId).toBe("device-a");
      expect(written?.payloadJson).toBe("{\"title\":\"local\"}");
    } finally { db.close(); }
  });

  it("persists the clock and reloads it even when the ledger max is hidden", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    let persisted: string | null = FUTURE;
    const store = new BlindMaxStore(db);
    try {
      const publisher = new LwwPublisher({
        store, registry: fakeRegistry(),
        outbox: new DurableOutbox(new SqliteSyncOutboxStore(db)),
        send: async () => undefined, deviceId: () => "device-a",
        loadClock: async () => persisted,
        saveClock: async (hlc) => { persisted = hlc; },
      });
      expect(await publisher.publish({
        domain: "fake", projectId: "p1", rowId: "r1", deleted: false,
      })).toBe(true);
      expect(persisted && persisted > FUTURE).toBe(true);
      const restarted = new LwwPublisher({
        store: new BlindMaxStore(db), registry: fakeRegistry(),
        outbox: new DurableOutbox(new SqliteSyncOutboxStore(db)),
        send: async () => undefined, deviceId: () => "device-a",
        loadClock: async () => persisted,
      });
      expect(await restarted.publish({
        domain: "fake", projectId: "p1", rowId: "r1", deleted: false,
      })).toBe(true);
    } finally { db.close(); }
  });

  it("retries a refused local edit after observing the row that beat it", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    const setup = new SqliteSyncLwwStore(db);
    const store = new BlindMaxStore(db);
    try {
      await setup.putIfNewer({
        domain: "fake", projectId: "p1", rowId: "r1", hlc: FUTURE,
        deviceId: "device-b", deleted: false, payloadJson: "{\"title\":\"remote\"}",
        updatedAt: null,
      });
      const publisher = new LwwPublisher({
        store, registry: fakeRegistry(),
        outbox: new DurableOutbox(new SqliteSyncOutboxStore(db)),
        send: async () => undefined, deviceId: () => "device-a",
      });
      expect(await publisher.publish({
        domain: "fake", projectId: "p1", rowId: "r1", deleted: false,
      })).toBe(true);
      expect((await store.get("fake", "r1"))?.deviceId).toBe("device-a");
    } finally { db.close(); }
  });
});
