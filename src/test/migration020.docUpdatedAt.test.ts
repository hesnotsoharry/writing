import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

async function columnNames(db: SqlJsTestDb, table: string): Promise<string[]> {
  const rows = await db.select<{ name: string }[]>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
}

describe("migration 20 — document sync timestamps", () => {
  it("registers migration 20 and reaches the new latest version", async () => {
    const migration = MIGRATIONS.find(({ version }) => version === 20);
    expect(migration?.name).toBe("doc-updated-at");
    expect(LATEST).toBe(21);
  });

  it("adds nullable updated_at columns without backfilling existing rows", async () => {
    const db = await makeSqlJsDb();
    try {
      for (const migration of MIGRATIONS.filter(({ version }) => version <= 19)) {
        await migration.up(db);
      }
      await db.execute(
        "INSERT INTO scene_docs (scene_id, state_base64) VALUES ('scene-1', 'state')"
      );
      await db.execute(
        "INSERT INTO board_docs (board_id, state_base64) VALUES ('board-1', 'state')"
      );
      await db.execute("PRAGMA user_version = 19");

      await runMigrations(db);

      expect(await columnNames(db, "scene_docs")).toContain("updated_at");
      expect(await columnNames(db, "board_docs")).toContain("updated_at");
      const sceneRows = await db.select<{ updated_at: string | null }[]>(
        "SELECT updated_at FROM scene_docs WHERE scene_id = 'scene-1'"
      );
      const boardRows = await db.select<{ updated_at: string | null }[]>(
        "SELECT updated_at FROM board_docs WHERE board_id = 'board-1'"
      );
      expect(sceneRows[0].updated_at).toBeNull();
      expect(boardRows[0].updated_at).toBeNull();
    } finally {
      db.close();
    }
  });

  it("is individually idempotent and tolerates missing partial-fixture tables", async () => {
    const db = await makeSqlJsDb();
    try {
      const migration = MIGRATIONS.find(({ version }) => version === 20);
      expect(migration).toBeDefined();
      await db.execute(
        "CREATE TABLE scene_docs (scene_id TEXT PRIMARY KEY, state_base64 TEXT NOT NULL)"
      );

      await migration?.up(db);
      await migration?.up(db);

      expect(await columnNames(db, "scene_docs")).toContain("updated_at");
    } finally {
      db.close();
    }
  });
});
