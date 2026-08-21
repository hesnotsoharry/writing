import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb } from "./support/sqljsDb";

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

describe("migration 22 — sync protocol v1.3", () => {
  it("creates durable sync tables, indexes, and feature columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const tables = await db.select<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      expect(tables.map(({ name }) => name)).toEqual(expect.arrayContaining([
        "project_domain_docs", "sync_lww_rows", "sync_outbox",
        "sync_pending_replacements",
      ]));
      const goalColumns = await db.select<Array<{ name: string }>>("PRAGMA table_info(goals)");
      const noteColumns = await db.select<Array<{ name: string }>>("PRAGMA table_info(quick_notes)");
      expect(goalColumns.map(({ name }) => name)).toEqual(expect.arrayContaining([
        "config_json", "updated_at",
      ]));
      expect(noteColumns.map(({ name }) => name)).toEqual(expect.arrayContaining([
        "source", "state", "updated_at",
      ]));
      expect(MIGRATIONS).toContainEqual(
        expect.objectContaining({ version: 22, name: "sync-protocol-v13" }),
      );
    } finally { db.close(); }
  });

  it("runs from a partial v21 fixture without assuming feature tables exist", async () => {
    const db = await makeSqlJsDb();
    try {
      await db.execute("PRAGMA user_version = 21");
      await runMigrations(db);
      const version = await db.select<Array<{ user_version: number }>>("PRAGMA user_version");
      expect(version[0].user_version).toBe(LATEST);
    } finally { db.close(); }
  });
});
