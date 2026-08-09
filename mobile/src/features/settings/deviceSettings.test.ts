import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../shared/dbClient";
import { DEVICE_SETTINGS_DEFAULTS, DeviceSettingsStore } from "./deviceSettings";

describe("device-local settings", () => {
  it("round-trips only through app_meta, never a synced store", async () => {
    let stored: string | null = null; const sql: string[] = [];
    const db: DbClient = { select: vi.fn(async () => stored ? [{ value: stored }] : []) as DbClient["select"],
      execute: vi.fn(async (statement: string, params?: unknown[]) => {
        sql.push(statement); stored = typeof params?.[1] === "string" ? params[1] : stored;
        return { rowsAffected: 1, lastInsertId: 0 };
      }) };
    const store = new DeviceSettingsStore(db); const next = { ...DEVICE_SETTINGS_DEFAULTS, spellCheck: false, proseSize: 21 };
    await store.write(next); await expect(store.read()).resolves.toEqual(next);
    expect(sql.every((statement) => statement.includes("app_meta"))).toBe(true);
    expect(sql.join(" ")).not.toMatch(/sync_|project_meta|lww/i);
  });
});
