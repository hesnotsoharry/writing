import { afterEach, describe, expect, it, vi } from "vitest";

import type { BoardDocStore } from "../../db/boardDocStore";
import { runMigrations } from "../../db/migrations";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { SqliteSyncLwwStore } from "../../db/sqliteSyncLwwStore";
import { SqliteSyncOutboxStore } from "../../db/sqliteSyncOutboxStore";
import { SyncEngine, type SyncProvider } from "../../sync/engine";
import { openMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";
import { LwwDomainRegistry } from "../../sync/lww/registry";
import { registerLwwDomains } from "../../sync/lwwDomains";
import type { InnerMessage } from "../../sync/messages";
import type { ConnectionState } from "../../sync/provider";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

const MASTER_KEY = new Uint8Array(32).fill(7);
const SWEEP_MS = 50;

class FakeProvider implements SyncProvider {
  readonly sent: Uint8Array[] = [];
  private connection: ((state: ConnectionState) => void) | null = null;
  connect(): void { this.connection?.("connected"); }
  destroy(): void { this.connection?.("disconnected"); }
  send(blob: Uint8Array): void { this.sent.push(blob); }
  subscribeConnection(cb: (state: ConnectionState) => void): () => void {
    this.connection = cb; cb("disconnected"); return () => { this.connection = null; };
  }
  subscribeFrames(): () => void { return () => undefined; }
}

const emptyDocStore = (): SceneDocStore & BoardDocStore => ({
  listAll: () => Promise.resolve([]),
  load: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  loadProjection: () => Promise.resolve(null),
  delete: () => Promise.resolve(),
} as unknown as SceneDocStore & BoardDocStore);

async function seededDb(): Promise<SqlJsTestDb> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  await db.execute(
    "INSERT INTO projects (id,title,type,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    ["p1", "Salt", "novel", 1000, "now", "now"],
  );
  await db.execute("INSERT INTO boards (id,project_id,title,sort) VALUES (?,?,?,?)",
    ["brainstorm-default", "p1", "Default Board", 0]);
  return db;
}

async function makeEngine(db: SqlJsTestDb) {
  const provider = new FakeProvider();
  const registry = new LwwDomainRegistry();
  registerLwwDomains(registry, db);
  const store = emptyDocStore();
  const engine = new SyncEngine({
    relayUrl: "wss://relay.test", sceneStore: store, boardStore: store,
    readMasterKey: () => Promise.resolve(MASTER_KEY),
    getDeviceId: () => Promise.resolve("device-a"),
    providerFactory: () => provider,
    updateWordCount: vi.fn().mockResolvedValue(undefined),
    lwwStore: new SqliteSyncLwwStore(db), lwwRegistry: registry,
    outboxStore: new SqliteSyncOutboxStore(db), sweepMs: SWEEP_MS,
  });
  return { engine, provider };
}

async function decode(provider: FakeProvider): Promise<InnerMessage[]> {
  const key = (await deriveKeys(MASTER_KEY)).encKey;
  const values = await Promise.all(provider.sent.map((blob) => openMessage(key, blob)));
  return values.filter((value): value is InnerMessage => value !== null);
}

describe("the sweep is a full sync, not just a hello", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("re-announces row summaries on every sweep", async () => {
    const db = await seededDb();
    const { engine, provider } = await makeEngine(db);
    try {
      await engine.start();
      await vi.waitFor(() => expect(provider.sent.length).toBeGreaterThan(0));
      // Drop the connect-time exchange; the sweep is what is under test.
      provider.sent.length = 0;

      await new Promise((resolve) => { setTimeout(resolve, SWEEP_MS * 3); });
      await vi.waitFor(async () => {
        const sent = await decode(provider);
        expect(sent.some((message) => message.t === "row-hello")).toBe(true);
      });

      const sent = await decode(provider);
      // Sending only `hello` made the sweep half a sync: the doc path self-healed
      // on it, the row path did not. A peer that joined a room we were already
      // connected to therefore never heard one row summary — it received every
      // document and none of the records.
      expect(sent.some((message) => message.t === "hello")).toBe(true);
      const rowHello = sent.find((message) => message.t === "row-hello");
      expect(rowHello).toMatchObject({ domain: "boards", project: "p1" });
    } finally { engine.stop(); db.close(); }
  });
});
