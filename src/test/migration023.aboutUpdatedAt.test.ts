import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { sqliteSetManuscriptAbout } from "../db/sqliteAiContextStore";
import { SqliteSyncLwwStore } from "../db/sqliteSyncLwwStore";
import { seedLwwLedger } from "../sync/lww/backfill";
import { LwwDomainRegistry } from "../sync/lww/registry";
import { registerLwwDomains } from "../sync/lwwDomains";
import { makeSqlJsDb } from "./support/sqljsDb";

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

describe("migration 23 — manuscript_about.updated_at", () => {
  it("adds the column and reaches the latest version", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const columns = await db.select<Array<{ name: string; type: string }>>(
        "PRAGMA table_info(manuscript_about)",
      );
      expect(columns.map(({ name }) => name)).toContain("updated_at");
      expect(columns.find(({ name }) => name === "updated_at")?.type).toBe("TEXT");
      expect((await db.select<Array<{ user_version: number }>>("PRAGMA user_version"))[0]
        .user_version).toBe(LATEST);
    } finally { db.close(); }
  });

  it("is individually idempotent", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const migration = MIGRATIONS.find(({ version }) => version === 23);
      await migration?.up(db);
      await migration?.up(db);
      const columns = await db.select<Array<{ name: string }>>(
        "PRAGMA table_info(manuscript_about)",
      );
      expect(columns.filter(({ name }) => name === "updated_at")).toHaveLength(1);
    } finally { db.close(); }
  });

  it("tolerates a DB that never got the manuscript_about table", async () => {
    const db = await makeSqlJsDb();
    try {
      const migration = MIGRATIONS.find(({ version }) => version === 23);
      await expect(migration?.up(db)).resolves.toBeUndefined();
    } finally { db.close(); }
  });

  it("gives the About row a real seed stamp instead of the floor", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        "INSERT INTO projects (id,title,type,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)",
        ["p1", "Salt", "novel", 1000, "now", "now"],
      );
      await sqliteSetManuscriptAbout(db, "p1", { synopsis: "A road.", genre: "",
        tone: "", pov: "", notes: "" });

      const registry = new LwwDomainRegistry();
      registerLwwDomains(registry, db);
      const store = new SqliteSyncLwwStore(db);
      await seedLwwLedger({ store, registry, deviceId: "device-a" });

      const seeded = await store.get("manuscript_about", "p1");
      // Stamp 0 is the tie that made two pre-sync devices decide a whole About
      // page on lexicographic device id.
      expect(seeded?.hlc).not.toBe("000000000000000-000000");
    } finally { db.close(); }
  });
});
