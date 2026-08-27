import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb } from "./support/sqljsDb";

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

async function noteStates(db: Awaited<ReturnType<typeof makeSqlJsDb>>): Promise<Array<{
  id: string; filed: number; state: string;
}>> {
  return db.select("SELECT id, filed, state FROM quick_notes ORDER BY id");
}

describe("migration 24 — quick_notes filed/state backfill", () => {
  it("registers as version 24", () => {
    const migration = MIGRATIONS.find(({ version }) => version === 24);
    expect(migration?.name).toBe("quick-notes-filed-state");
    expect(LATEST).toBeGreaterThanOrEqual(24);
  });

  it("repairs filed=1 rows that 022 left at state='inbox'", async () => {
    const db = await makeSqlJsDb();
    try {
      for (const migration of MIGRATIONS.filter(({ version }) => version <= 23)) {
        await migration.up(db);
      }
      await db.execute(
        "INSERT INTO quick_notes (id, project_id, body, created_at, filed, source, state) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        ["filed-note", "p1", "done", 1, 1, null, "inbox"],
      );
      await db.execute(
        "INSERT INTO quick_notes (id, project_id, body, created_at, filed, source, state) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        ["inbox-note", "p1", "todo", 1, 0, null, "inbox"],
      );
      await db.execute("PRAGMA user_version = 23");

      await runMigrations(db);

      expect(await noteStates(db)).toEqual([
        { id: "filed-note", filed: 1, state: "filed" },
        { id: "inbox-note", filed: 0, state: "inbox" },
      ]);
      const version = await db.select<Array<{ user_version: number }>>("PRAGMA user_version");
      expect(version[0].user_version).toBe(LATEST);
    } finally {
      db.close();
    }
  });

  it("backfills on the v21 → latest upgrade path that first adds the state column", async () => {
    const db = await makeSqlJsDb();
    try {
      for (const migration of MIGRATIONS.filter(({ version }) => version <= 21)) {
        await migration.up(db);
      }
      await db.execute(
        "INSERT INTO quick_notes (id, project_id, body, created_at, filed) VALUES ($1,$2,$3,$4,$5)",
        ["old-filed", "p1", "already filed", 1, 1],
      );
      await db.execute(
        "INSERT INTO quick_notes (id, project_id, body, created_at, filed) VALUES ($1,$2,$3,$4,$5)",
        ["old-inbox", "p1", "still inbox", 1, 0],
      );
      await db.execute("PRAGMA user_version = 21");

      await runMigrations(db);

      expect(await noteStates(db)).toEqual([
        { id: "old-filed", filed: 1, state: "filed" },
        { id: "old-inbox", filed: 0, state: "inbox" },
      ]);
    } finally {
      db.close();
    }
  });

  it("is individually idempotent and tolerates a missing quick_notes table", async () => {
    const db = await makeSqlJsDb();
    try {
      const migration = MIGRATIONS.find(({ version }) => version === 24);
      await expect(migration?.up(db)).resolves.toBeUndefined();
      await runMigrations(db);
      await migration?.up(db);
      await migration?.up(db);
    } finally {
      db.close();
    }
  });
});
