import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { BoardDocStore } from "../../db/boardDocStore";
import { SqliteBoardDocStore } from "../../db/sqliteBoardDocStore";
import { encodeDoc } from "../../yjs/serialize";

/**
 * Mock the schema module's getDb function.
 * Returns a test double that behaves like tauri-plugin-sql for board_docs queries.
 */
interface MockDb {
  select: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

vi.mock("../../db/schema", () => {
  const mockDb: MockDb = {
    select: vi.fn(),
    execute: vi.fn(),
  };
  return {
    getDb: vi.fn(() => Promise.resolve(mockDb)),
  };
});

describe("BoardDocStore", () => {
  describe("SqliteBoardDocStore", () => {
    let store: BoardDocStore;
    let mockDb: MockDb;

    beforeEach(async () => {
      // Reset mocks before each test.
      const { getDb } = await import("../../db/schema");
      mockDb = await getDb();
      vi.clearAllMocks();

      store = new SqliteBoardDocStore();
    });

    it("returns null when loading a board that has no stored doc", async () => {
      // Arrange: Mock select to return empty rows.
      mockDb.select.mockResolvedValueOnce([]);

      // Act
      const result = await store.load("board-123");

      // Assert
      expect(result).toBeNull();
      expect(mockDb.select).toHaveBeenCalledWith(
        "SELECT state_base64 FROM board_docs WHERE board_id = $1",
        ["board-123"]
      );
    });

    it("lists all stored docs with sync metadata", async () => {
      mockDb.select.mockResolvedValueOnce([
        { board_id: "board-1", state_base64: "state", updated_at: null },
      ]);

      await expect(store.listAll()).resolves.toEqual([
        { id: "board-1", stateBase64: "state", updatedAt: null },
      ]);
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringMatching(/INNER JOIN boards/i),
      );
    });

    it("loads and returns the stored base64 string when a board doc exists", async () => {
      // Arrange: Create a simple Y.Doc and encode it.
      const doc = new Y.Doc();
      doc.getMap("cards");
      const base64 = encodeDoc(doc);

      // Mock select to return the base64 string.
      mockDb.select.mockResolvedValueOnce([{ state_base64: base64 }]);

      // Act
      const result = await store.load("board-456");

      // Assert
      expect(result).toBe(base64);
      expect(mockDb.select).toHaveBeenCalledWith(
        "SELECT state_base64 FROM board_docs WHERE board_id = $1",
        ["board-456"]
      );
    });

    it("saves a base64-encoded doc to board_docs table", async () => {
      // Arrange: Create a doc and encode it.
      const doc = new Y.Doc();
      const base64 = encodeDoc(doc);

      // Mock execute to succeed.
      mockDb.execute.mockResolvedValueOnce(undefined);

      // Act
      await store.save("board-789", base64);

      // Assert: Verify execute was called with an UPSERT that stores the base64.
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(
          /INSERT INTO board_docs.*board_id.*state_base64.*updated_at.*ON CONFLICT/is
        ),
        ["board-789", base64, expect.any(String)]
      );
    });

    it("returns the same base64 after a save-load round-trip", async () => {
      // Arrange: Create a doc with some content and encode it.
      const originalDoc = new Y.Doc();
      originalDoc.getMap("cards").set("card-1", { x: 100, y: 200 });
      const originalBase64 = encodeDoc(originalDoc);

      const boardId = "board-round-trip";

      // Mock execute for save.
      mockDb.execute.mockResolvedValueOnce(undefined);
      // Mock select for load — return what was saved.
      mockDb.select.mockResolvedValueOnce([{ state_base64: originalBase64 }]);

      // Act
      await store.save(boardId, originalBase64);
      const loadedBase64 = await store.load(boardId);

      // Assert
      expect(loadedBase64).toBe(originalBase64);
    });

    it("stores base64 in TEXT column (not binary BLOB)", async () => {
      // This test verifies the schema adheres to the project's gotcha
      // (tauri-plugin-sql BLOB round-trip reliability).
      const base64 = encodeDoc(new Y.Doc());

      mockDb.execute.mockResolvedValueOnce(undefined);

      await store.save("board-text-test", base64);

      // Assert: The second argument (the value) is a string, not a Uint8Array.
      const [, args] = mockDb.execute.mock.calls[0];
      expect(typeof args[1]).toBe("string");
    });

    it("stamps updated_at in the same upsert", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-05T15:30:00.000Z"));
      try {
        await store.save("board-timestamp", "base64-state");

        const [sql, args] = mockDb.execute.mock.calls[0];
        expect(sql).toMatch(/updated_at = excluded\.updated_at/i);
        expect(args).toEqual([
          "board-timestamp",
          "base64-state",
          "2026-08-05T15:30:00.000Z",
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
