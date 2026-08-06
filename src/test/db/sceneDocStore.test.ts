import { beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteSceneDocStore } from "../../db/sqliteSceneDocStore";

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

vi.mock("../../db/schema", () => {
  const mockDb: MockDb = { select: vi.fn(), execute: vi.fn() };
  return { getDb: vi.fn(() => Promise.resolve(mockDb)) };
});

describe("SqliteSceneDocStore", () => {
  let mockDb: MockDb;
  let store: SqliteSceneDocStore;

  beforeEach(async () => {
    const { getDb } = await import("../../db/schema");
    mockDb = await getDb();
    vi.clearAllMocks();
    store = new SqliteSceneDocStore();
  });

  it.each([
    ["projected", "Visible prose", 3],
    ["state-only", null, 2],
  ])("stamps updated_at for the %s save path", async (_name, plaintext, valueIndex) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T15:30:00.000Z"));
    try {
      await store.save("scene-1", "base64-state", plaintext);

      const [sql, values] = mockDb.execute.mock.calls[0];
      expect(sql).toMatch(/updated_at = excluded\.updated_at/i);
      expect(values[valueIndex]).toBe("2026-08-05T15:30:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("lists all stored docs with sync metadata", async () => {
    mockDb.select.mockResolvedValueOnce([
      { scene_id: "scene-1", state_base64: "state", updated_at: "2026-08-06T10:00:00Z" },
    ]);

    await expect(store.listAll()).resolves.toEqual([
      { id: "scene-1", stateBase64: "state", updatedAt: "2026-08-06T10:00:00Z" },
    ]);
    expect(mockDb.select).toHaveBeenCalledWith(
      "SELECT scene_id, state_base64, updated_at FROM scene_docs",
    );
  });
});
