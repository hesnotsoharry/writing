/**
 * Oracle test — W52 Phase 4: entity-level "never share with AI" exclusion
 * persists across all three entity tables (characters, locations, generic).
 *
 * Contract under test:
 *   - Migration #18 adds `exclude_from_ai INTEGER NOT NULL DEFAULT 0` to
 *     characters AND locations.
 *   - `sqliteSetEntityExclusion(db, type, id, true)` writes the flag to the DB.
 *   - Reading back via the same SELECT path the store uses surfaces
 *     `exclude_from_ai !== 0` after the write.
 *   - `sqliteSetEntityExclusion(db, type, id, false)` flips the flag back.
 *
 * Uses the real sql.js DB + full migrations (same harness as aiContextStore.test.ts).
 * A buggy `sqliteSetEntityExclusion` OR a wrong routing choice (wrong table)
 * OR a reverted `toPlain` hardcode would fail these assertions — not vacuous.
 *
 * `sqliteSetEntityExclusion` is the extracted free-function that both the
 * SqliteStoryBibleStore class and this test call — matching the
 * `sqliteGetManuscriptAbout` / `sqliteGetSceneText` precedent in sqliteAiContextStore.ts.
 */
import { describe, expect, it } from "vitest";

import { runMigrations } from "../db/migrations";
import type { DbHandle } from "../db/schema";
import { sqliteSetEntityExclusion } from "../db/sqliteEntityDetail";
import { sqliteListEntities } from "../db/sqliteStoryBibleStore";
import { makeSqlJsDb } from "./support/sqljsDb";

const PROJECT = "proj-entity-exclusion-p4";

async function freshDb(): Promise<DbHandle & { close(): void }> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  await db.execute(
    "INSERT INTO projects (id, title, type, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    [PROJECT, "Test", "novel", 0, Date.now(), Date.now()]
  );
  return db;
}

/**
 * Read exclude_from_ai from the correct table using the same SELECT columns
 * that the store's toPlain/toGen helpers use — so a wrong column name fails here too.
 */
async function readFlag(db: DbHandle, type: string, id: string): Promise<boolean | undefined> {
  if (type === "character") {
    const rows = await db.select<{ exclude_from_ai: number }[]>(
      "SELECT exclude_from_ai FROM characters WHERE id = ?", [id]
    );
    return rows[0] !== undefined ? rows[0].exclude_from_ai !== 0 : undefined;
  } else if (type === "location") {
    const rows = await db.select<{ exclude_from_ai: number }[]>(
      "SELECT exclude_from_ai FROM locations WHERE id = ?", [id]
    );
    return rows[0] !== undefined ? rows[0].exclude_from_ai !== 0 : undefined;
  } else {
    const rows = await db.select<{ exclude_from_ai: number }[]>(
      "SELECT exclude_from_ai FROM entities WHERE id = ?", [id]
    );
    return rows[0] !== undefined ? rows[0].exclude_from_ai !== 0 : undefined;
  }
}

describe("entityExclusionPersist — W52 Phase 4", () => {
  it("sqliteSetEntityExclusion persists true then false for a character", async () => {
    const db = await freshDb();
    try {
      const charId = crypto.randomUUID();
      await db.execute(
        "INSERT INTO characters (id, project_id, name, notes, aliases) VALUES (?,?,?,?,?)",
        [charId, PROJECT, "Alice", null, null]
      );

      // Migration #18 DEFAULT 0 means the initial value is false.
      expect(await readFlag(db, "character", charId)).toBe(false);

      // Call the REAL sqliteSetEntityExclusion — routes to characters table.
      await sqliteSetEntityExclusion(db, "character", charId, true);
      expect(await readFlag(db, "character", charId)).toBe(true);

      // Flip back to false.
      await sqliteSetEntityExclusion(db, "character", charId, false);
      expect(await readFlag(db, "character", charId)).toBe(false);
    } finally {
      db.close();
    }
  });

  it("sqliteSetEntityExclusion persists true then false for a location", async () => {
    const db = await freshDb();
    try {
      const locId = crypto.randomUUID();
      await db.execute(
        "INSERT INTO locations (id, project_id, name, notes, aliases) VALUES (?,?,?,?,?)",
        [locId, PROJECT, "London", null, null]
      );

      expect(await readFlag(db, "location", locId)).toBe(false);

      // Call the REAL sqliteSetEntityExclusion — routes to locations table.
      await sqliteSetEntityExclusion(db, "location", locId, true);
      expect(await readFlag(db, "location", locId)).toBe(true);

      await sqliteSetEntityExclusion(db, "location", locId, false);
      expect(await readFlag(db, "location", locId)).toBe(false);
    } finally {
      db.close();
    }
  });

  it("sqliteSetEntityExclusion persists true then false for a generic entity", async () => {
    const db = await freshDb();
    try {
      const entityId = crypto.randomUUID();
      await db.execute(
        "INSERT INTO entities (id, project_id, entity_type, name, notes, aliases) VALUES (?,?,?,?,?,?)",
        [entityId, PROJECT, "item", "Magic Sword", null, null]
      );

      expect(await readFlag(db, "item", entityId)).toBe(false);

      // "item" is not "character" or "location" — routes to entities table.
      await sqliteSetEntityExclusion(db, "item", entityId, true);
      expect(await readFlag(db, "item", entityId)).toBe(true);

      await sqliteSetEntityExclusion(db, "item", entityId, false);
      expect(await readFlag(db, "item", entityId)).toBe(false);
    } finally {
      db.close();
    }
  });

  it("migration #18 adds exclude_from_ai column to characters and locations with DEFAULT 0", async () => {
    const db = await freshDb();
    try {
      const charId = crypto.randomUUID();
      const locId = crypto.randomUUID();
      await db.execute(
        "INSERT INTO characters (id, project_id, name, notes, aliases) VALUES (?,?,?,?,?)",
        [charId, PROJECT, "Bob", null, null]
      );
      await db.execute(
        "INSERT INTO locations (id, project_id, name, notes, aliases) VALUES (?,?,?,?,?)",
        [locId, PROJECT, "Paris", null, null]
      );

      const charRows = await db.select<{ exclude_from_ai: number }[]>(
        "SELECT exclude_from_ai FROM characters WHERE id = ?", [charId]
      );
      expect(charRows[0].exclude_from_ai).toBe(0);

      const locRows = await db.select<{ exclude_from_ai: number }[]>(
        "SELECT exclude_from_ai FROM locations WHERE id = ?", [locId]
      );
      expect(locRows[0].exclude_from_ai).toBe(0);
    } finally {
      db.close();
    }
  });

  it("InMemoryStoryBibleStore.setEntityExclusion mutates all three entity types", async () => {
    // Exercise the in-memory store's setEntityExclusion so a wrong implementation fails.
    const { InMemoryStoryBibleStore } = await import("../db/inMemoryStoryBibleStore");
    const store = new InMemoryStoryBibleStore();

    const char = await store.createCharacter(PROJECT, "Charlie", null);
    const loc = await store.createLocation(PROJECT, "Berlin", null);
    const gen = await store.createEntity(PROJECT, "item", "Map", null);

    // All start at false (default).
    const listBefore = await store.listEntities(PROJECT);
    expect(listBefore.find((e) => e.id === char.id)?.exclude_from_ai).toBeFalsy();
    expect(listBefore.find((e) => e.id === loc.id)?.exclude_from_ai).toBeFalsy();
    expect(listBefore.find((e) => e.id === gen.id)?.exclude_from_ai).toBeFalsy();

    // Set all to true via the REAL setEntityExclusion method.
    await store.setEntityExclusion("character", char.id, true);
    await store.setEntityExclusion("location", loc.id, true);
    await store.setEntityExclusion("item", gen.id, true);

    // Read back through listEntities (the store's read path).
    const listAfter = await store.listEntities(PROJECT);
    expect(listAfter.find((e) => e.id === char.id)?.exclude_from_ai).toBe(true);
    expect(listAfter.find((e) => e.id === loc.id)?.exclude_from_ai).toBe(true);
    expect(listAfter.find((e) => e.id === gen.id)?.exclude_from_ai).toBe(true);

    // Flip character back to false.
    await store.setEntityExclusion("character", char.id, false);
    const listFlipped = await store.listEntities(PROJECT);
    expect(listFlipped.find((e) => e.id === char.id)?.exclude_from_ai).toBe(false);
    // Others stay true.
    expect(listFlipped.find((e) => e.id === loc.id)?.exclude_from_ai).toBe(true);
    expect(listFlipped.find((e) => e.id === gen.id)?.exclude_from_ai).toBe(true);
  });

  it("sqliteListEntities reflects exclude_from_ai=true for a character via rowToEntity", async () => {
    // This case exercises the REAL rowToEntity translation path in sqliteStoryBibleStore.ts.
    // A regression that re-hardcodes `exclude_from_ai: false` in rowToEntity will fail here
    // even though the raw DB value is correct — the boolean conversion is the seam under test.
    const db = await freshDb();
    try {
      const charId = crypto.randomUUID();
      await db.execute(
        "INSERT INTO characters (id, project_id, name, notes, aliases) VALUES (?,?,?,?,?)",
        [charId, PROJECT, "Dana", null, null]
      );

      // Write via the real sqliteSetEntityExclusion — sets exclude_from_ai = 1 in DB.
      await sqliteSetEntityExclusion(db, "character", charId, true);

      // Read back via sqliteListEntities — goes through rowToEntity (exclude_from_ai !== 0).
      const entities = await sqliteListEntities(db, PROJECT);
      const dana = entities.find((e) => e.id === charId);
      expect(dana).toBeDefined();
      expect(dana?.exclude_from_ai).toBe(true);
    } finally {
      db.close();
    }
  });
});
