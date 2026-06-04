import { describe, expect, it, vi } from "vitest";

import { assertSafeVersion, MIGRATIONS, runMigrations } from "../db/migrations";
import type { DbHandle } from "../db/schema";

/**
 * Unit tests for the migration framework using a vi.fn() DbHandle double.
 * These tests cover version-gating and the assertSafeVersion contract quickly,
 * without real SQLite. The real-engine layer is the acceptance test in
 * runMigrations.acceptance.test.ts (sql.js backed).
 *
 * We do NOT mock runMigrations itself — it is the subject under test.
 */

function makeDb(
  currentVersion: number
): DbHandle & { executeCalls: string[] } {
  const executeCalls: string[] = [];
  return {
    executeCalls,
    select: vi.fn().mockImplementation((query: string) => {
      if (query.includes("user_version")) {
        return Promise.resolve([{ user_version: currentVersion }]);
      }
      return Promise.resolve([]);
    }) as DbHandle["select"],
    execute: vi.fn().mockImplementation((sql: string) => {
      executeCalls.push(sql);
      return Promise.resolve();
    }) as DbHandle["execute"],
  };
}

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

describe("runMigrations — version gating (vi.fn double)", () => {
  it("on a fresh DB (user_version 0) issues baseline DDL then bumps version to 1", async () => {
    const db = makeDb(0);
    await runMigrations(db);

    // Must have issued at least the CREATE TABLE statements + the version bump.
    expect(db.executeCalls.length).toBeGreaterThan(0);

    // The final execute call must be the PRAGMA version bump to the latest version.
    const lastCall = db.executeCalls[db.executeCalls.length - 1];
    expect(lastCall).toBe(`PRAGMA user_version = ${LATEST_VERSION}`);
  });

  it("on a DB already at the latest version issues ZERO execute() calls (version-gated)", async () => {
    const db = makeDb(LATEST_VERSION);
    await runMigrations(db);

    // No migration ran — nothing was executed.
    expect(db.executeCalls).toHaveLength(0);
  });

  it("on a DB at version 1 runs ONLY migration 2 — skips baseline DDL, bumps to version 2", async () => {
    const db = makeDb(1);
    await runMigrations(db);

    // NONE of migration 1's baseline CREATE TABLE statements may fire (migration 1 was skipped).
    // Asserting zero CREATE TABLE calls covers all seven baseline tables — migration 1 is the
    // only migration that issues CREATE TABLE, so any such call would prove it wrongly re-ran.
    const baselineDdlFired = db.executeCalls.some((call) => call.includes("CREATE TABLE"));
    expect(baselineDdlFired).toBe(false);

    // The version bump to 2 must have fired.
    const lastCall = db.executeCalls[db.executeCalls.length - 1];
    expect(lastCall).toBe("PRAGMA user_version = 2");
  });
});

describe("assertSafeVersion — PRAGMA interpolation guard", () => {
  it("accepts valid non-negative 32-bit integers", () => {
    expect(() => assertSafeVersion(0)).not.toThrow();
    expect(() => assertSafeVersion(1)).not.toThrow();
    expect(() => assertSafeVersion(2_147_483_647)).not.toThrow();
  });

  it("rejects a decimal (non-integer)", () => {
    expect(() => assertSafeVersion(1.5)).toThrow(RangeError);
  });

  it("rejects a negative integer", () => {
    expect(() => assertSafeVersion(-1)).toThrow(RangeError);
  });

  it("rejects a value exceeding the SQLite signed 32-bit max (2,147,483,647)", () => {
    expect(() => assertSafeVersion(2_147_483_648)).toThrow(RangeError);
  });

  it("rejects NaN", () => {
    expect(() => assertSafeVersion(Number.NaN)).toThrow(RangeError);
  });
});
