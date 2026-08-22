import { describe, expect, it } from "vitest";

import { runMigrations } from "../db/migrations";
import { makeQuickNoteStore } from "../features/quickcapture/quickNoteStore";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * Problem B item 4 (filed/state divergence): markFiled previously set only
 * `filed=1`, leaving `state='inbox'` — mobile queries `state = 'inbox'`
 * (mobile/src/db/mobileQuickNoteStore.ts, read-only reference), so a note
 * desktop filed kept counting as unfiled on mobile forever. Fixed to set
 * both columns. `create` now writes source/state explicitly instead of
 * leaning on the column DEFAULT.
 */

async function freshDb(): Promise<SqlJsTestDb> {
  const db = await makeSqlJsDb();
  await runMigrations(db);
  return db;
}

describe("quickNoteStore — filed/state parity with mobile", () => {
  it("create() writes state='inbox' and source=null explicitly", async () => {
    const db = await freshDb();
    try {
      const store = makeQuickNoteStore(db);
      const id = await store.create("p1", "a thought");
      const rows = await db.select<Array<{ state: string; source: string | null }>>(
        "SELECT state, source FROM quick_notes WHERE id = $1", [id],
      );
      expect(rows[0]).toEqual({ state: "inbox", source: null });
    } finally { db.close(); }
  });

  it("markFiled sets both filed=1 and state='filed' — the mobile query key", async () => {
    const db = await freshDb();
    try {
      const store = makeQuickNoteStore(db);
      const id = await store.create("p1", "to be filed");
      await store.markFiled(id);
      const rows = await db.select<Array<{ filed: number; state: string }>>(
        "SELECT filed, state FROM quick_notes WHERE id = $1", [id],
      );
      expect(rows[0]).toEqual({ filed: 1, state: "filed" });
    } finally { db.close(); }
  });
});
