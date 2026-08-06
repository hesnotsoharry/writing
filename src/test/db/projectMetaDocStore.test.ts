import { beforeEach, describe, expect, it, vi } from "vitest";

import { SqliteProjectMetaDocStore } from "../../db/sqliteProjectMetaDocStore";

interface MockDb { select: ReturnType<typeof vi.fn>; execute: ReturnType<typeof vi.fn> }
vi.mock("../../db/schema", () => {
  const mockDb: MockDb = { select: vi.fn(), execute: vi.fn() };
  return { getDb: vi.fn(() => Promise.resolve(mockDb)) };
});

describe("SqliteProjectMetaDocStore", () => {
  let db: MockDb;
  let store: SqliteProjectMetaDocStore;

  beforeEach(async () => {
    const { getDb } = await import("../../db/schema");
    db = await getDb();
    vi.clearAllMocks();
    store = new SqliteProjectMetaDocStore();
  });

  it("saves base64 text with a sync timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    try {
      await store.save("project-1", "base64-state");
      expect(db.execute).toHaveBeenCalledWith(expect.stringMatching(/state_base64/), [
        "project-1", "base64-state", "2026-08-06T12:00:00.000Z",
      ]);
    } finally { vi.useRealTimers(); }
  });

  it("lists all meta docs using the engine storage surface", async () => {
    db.select.mockResolvedValueOnce([
      { project_id: "project-1", state_base64: "state", updated_at: null },
    ]);
    await expect(store.listAll()).resolves.toEqual([
      { id: "project-1", stateBase64: "state", updatedAt: null },
    ]);
  });
});
