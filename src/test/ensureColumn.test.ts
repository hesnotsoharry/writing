import { describe, expect, it, vi } from "vitest";

import type { DbHandle } from "../db/schema";
import { ensureColumn } from "../db/schema";

/**
 * Unit tests for the ensureColumn idempotent column-migration helper.
 *
 * Contract:
 *   - When PRAGMA table_info reports the column ABSENT, ensureColumn must issue
 *     an ALTER TABLE … ADD COLUMN statement.
 *   - When PRAGMA table_info reports the column PRESENT, ensureColumn must NOT
 *     issue any ALTER TABLE statement.
 *
 * The db argument is a test double implementing the DbHandle interface.
 * We do NOT mock ensureColumn itself — it is the subject under test.
 */

function makeDb(columnNames: string[]): DbHandle & { executeCalls: string[] } {
  const executeCalls: string[] = [];
  return {
    executeCalls,
    select: vi.fn().mockResolvedValue(
      columnNames.map((name, cid) => ({ cid, name, type: "TEXT", notnull: 0, dflt_value: null, pk: 0 }))
    ) as DbHandle["select"],
    execute: vi.fn().mockImplementation((sql: string) => {
      executeCalls.push(sql);
      return Promise.resolve();
    }) as DbHandle["execute"],
  };
}

describe("ensureColumn", () => {
  it("issues ALTER TABLE when the target column is absent from table_info", async () => {
    const db = makeDb(["scene_id", "state_base64"]);

    await ensureColumn(db, "scene_docs", "plaintext_projection", "TEXT");

    expect(db.executeCalls).toHaveLength(1);
    expect(db.executeCalls[0]).toMatch(/ALTER TABLE scene_docs ADD COLUMN plaintext_projection TEXT/);
  });

  it("does NOT issue ALTER TABLE when the target column is already present in table_info", async () => {
    const db = makeDb(["scene_id", "state_base64", "plaintext_projection"]);

    await ensureColumn(db, "scene_docs", "plaintext_projection", "TEXT");

    expect(db.executeCalls).toHaveLength(0);
  });

  it("queries the correct table via PRAGMA table_info", async () => {
    const db = makeDb(["scene_id", "state_base64"]);

    await ensureColumn(db, "scene_docs", "plaintext_projection", "TEXT");

    expect(db.select).toHaveBeenCalledWith("PRAGMA table_info(scene_docs)");
  });
});
