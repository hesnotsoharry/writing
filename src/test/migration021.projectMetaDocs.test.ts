import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb } from "./support/sqljsDb";

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

describe("migration 21 — project meta docs", () => {
  it("creates the base64-TEXT store and reaches version 21", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const columns = await db.select<Array<{ name: string; type: string; notnull: number }>>(
        "PRAGMA table_info(project_meta_docs)"
      );
      expect(columns.map(({ name, type, notnull }) => ({ name, type, notnull }))).toEqual([
        { name: "project_id", type: "TEXT", notnull: 0 },
        { name: "state_base64", type: "TEXT", notnull: 1 },
        { name: "updated_at", type: "TEXT", notnull: 0 },
      ]);
      expect((await db.select<{ user_version: number }[]>("PRAGMA user_version"))[0].user_version)
        .toBe(LATEST);
    } finally {
      db.close();
    }
  });

  it("is individually idempotent", async () => {
    const db = await makeSqlJsDb();
    try {
      const migration = MIGRATIONS.find(({ version }) => version === 21);
      await migration?.up(db);
      await migration?.up(db);
      const tables = await db.select<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='project_meta_docs'"
      );
      expect(tables).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});
