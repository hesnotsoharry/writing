import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMobileDb } from "../db/database";
import type { DbClient } from "../shared/dbClient";
import { readThemePreference, writeThemePreference } from "./themePreference";

vi.mock("../db/database", () => ({ getMobileDb: vi.fn() }));

describe("theme preference", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each(["system", "light", "dark"] as const)("round-trips %s in device-local app_meta", async (preference) => {
    let value: string | null = null;
    const db: DbClient = {
      select: vi.fn(async () => value ? [{ value }] : []) as DbClient["select"],
      execute: vi.fn(async (_sql: string, params?: unknown[]) => {
        value = typeof params?.[1] === "string" ? params[1] : null;
        return { rowsAffected: 1, lastInsertId: 0 };
      }),
    };
    vi.mocked(getMobileDb).mockResolvedValue(db);
    await writeThemePreference(preference);
    await expect(readThemePreference()).resolves.toBe(preference);
  });
});
