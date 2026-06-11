import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardsStore } from "../../db/boardsStore";
import { SqliteBoardsStore } from "../../db/sqliteBoardsStore";

/**
 * Mock the schema module's getDb function.
 * Returns a test double that behaves like tauri-plugin-sql.
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

describe("BoardsStore", () => {
  describe("SqliteBoardsStore", () => {
    let store: BoardsStore;
    let mockDb: MockDb;

    beforeEach(async () => {
      const { getDb } = await import("../../db/schema");
      mockDb = await getDb();
      vi.clearAllMocks();

      store = new SqliteBoardsStore();
    });

    it("lists boards for a project ordered by sort ascending", async () => {
      // Arrange: Mock select to return boards ordered by sort.
      mockDb.select.mockResolvedValueOnce([
        { id: "board-1", project_id: "proj-a", title: "First Board", sort: 0 },
        { id: "board-2", project_id: "proj-a", title: "Second Board", sort: 1 },
      ]);

      // Act
      const result = await store.list("proj-a");

      // Assert
      expect(result).toEqual([
        { id: "board-1", project_id: "proj-a", title: "First Board", sort: 0 },
        { id: "board-2", project_id: "proj-a", title: "Second Board", sort: 1 },
      ]);
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringMatching(/ORDER BY sort/i),
        ["proj-a"]
      );
    });

    it("returns empty array when no boards exist for a project", async () => {
      // Arrange
      mockDb.select.mockResolvedValueOnce([]);

      // Act
      const result = await store.list("proj-b");

      // Assert
      expect(result).toEqual([]);
    });

    it("creates a board with the provided id, project_id, title, and sort", async () => {
      // Arrange
      mockDb.execute.mockResolvedValueOnce(undefined);

      // Act
      await store.create({
        id: "board-new",
        project_id: "proj-c",
        title: "New Board",
        sort: 2,
      });

      // Assert
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/INSERT INTO boards/i),
        ["board-new", "proj-c", "New Board", 2]
      );
    });

    it("renames a board by id", async () => {
      // Arrange
      mockDb.execute.mockResolvedValueOnce(undefined);

      // Act
      await store.rename("board-123", "Updated Title");

      // Assert
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE boards.*title.*WHERE id/i),
        ["Updated Title", "board-123"]
      );
    });

    it("removes a board by id and deletes its board_docs row", async () => {
      // Arrange: Mock execute to succeed (called twice: delete board_docs, then delete board).
      mockDb.execute.mockResolvedValueOnce(undefined);
      mockDb.execute.mockResolvedValueOnce(undefined);

      // Act
      await store.remove("board-456");

      // Assert: Verify both deletes were called.
      const calls = mockDb.execute.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      // Check that a DELETE on board_docs with the board_id occurred.
      const board_docsDelete = calls.some((call) =>
        String(call[0]).match(/DELETE FROM board_docs.*board_id/i)
      );
      expect(board_docsDelete).toBe(true);

      // Check that a DELETE on boards with the id occurred.
      const boardsDelete = calls.some((call) =>
        String(call[0]).match(/DELETE FROM boards.*WHERE id/i)
      );
      expect(boardsDelete).toBe(true);
    });

    it("filters boards by project_id when listing", async () => {
      // Arrange: Set up mock to return only boards from proj-x.
      mockDb.select.mockResolvedValueOnce([
        { id: "board-x1", project_id: "proj-x", title: "Board X1", sort: 0 },
      ]);

      // Act
      await store.list("proj-x");

      // Assert: Verify the query includes the project_id filter.
      const query = mockDb.select.mock.calls[0][0];
      const bindValue = mockDb.select.mock.calls[0][1];
      expect(query).toMatch(/WHERE project_id/i);
      expect(bindValue).toContain("proj-x");
    });
  });
});
