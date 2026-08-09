import { afterEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../../db/migrations";
import { SqliteSyncOutboxStore } from "../../db/sqliteSyncOutboxStore";
import { DurableOutbox } from "../../sync/outbox";
import { makeSqlJsDb } from "../support/sqljsDb";

describe("durable sync outbox", () => {
  afterEach(() => vi.useRealTimers());
  it("coalesces repeated edits and survives a store restart", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    try {
      const first = new SqliteSyncOutboxStore(db);
      for (let index = 0; index < 10; index += 1) {
        await first.enqueue({ domain: "scene", projectId: "p1", itemId: "s1",
          kind: "doc", payload: JSON.stringify({ t: "diff", c: "scene:s1", u: String(index) }) });
      }
      const restarted = new SqliteSyncOutboxStore(db);
      expect(await restarted.listPending()).toHaveLength(1);
      expect((await restarted.listPending())[0].payload).toContain('"u":"9"');
    } finally { db.close(); }
  });

  it("clears only after semantic acknowledgement", async () => {
    const db = await makeSqlJsDb(); await runMigrations(db);
    try {
      const store = new SqliteSyncOutboxStore(db);
      const entry = await store.enqueue({ domain: "notes", projectId: "p1", itemId: "n1",
        kind: "row", payload: "{}" });
      expect(await store.listPending()).toHaveLength(1);
      await store.acknowledge(entry.id);
      expect(await store.listPending()).toHaveLength(0);
    } finally { db.close(); }
  });

  it("flushes pending entries in creation order", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const db = await makeSqlJsDb(); await runMigrations(db);
    try {
      const store = new SqliteSyncOutboxStore(db); const outbox = new DurableOutbox(store);
      await outbox.enqueue({ domain: "scene", projectId: "p1", itemId: "s1", kind: "doc",
        message: { t: "diff", c: "scene:s1", u: "a" } });
      vi.setSystemTime(new Date("2026-01-01T00:00:01Z"));
      await outbox.enqueue({ domain: "notes", projectId: "p1", itemId: "n1", kind: "row", message: {
        t: "row", id: "notes:n1", domain: "notes", project: "p1", row: "n1",
        hlc: "000000000001000-000000", device: "a", deleted: false, payload: "{}",
      } });
      const sent: string[] = [];
      await outbox.flush(async (message) => { sent.push(message.t); });
      expect(sent).toEqual(["diff", "row"]);
    } finally { db.close(); }
  });
});
