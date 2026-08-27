import type { BoardDocStore } from "./boardDocStore";
import { getDb } from "./schema";

export class SqliteBoardDocStore implements BoardDocStore {
  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    const db = await getDb();
    // Join is the stop-syncing half of a board tombstone: an orphan
    // board_docs row must not be advertised on hello, or the deleting
    // device is re-seeded with content it just removed.
    const rows = await db.select<Array<{
      board_id: string; state_base64: string; updated_at: string | null;
    }>>(
      `SELECT board_docs.board_id, board_docs.state_base64, board_docs.updated_at
       FROM board_docs INNER JOIN boards ON boards.id = board_docs.board_id`
    );
    return rows.map((row) => ({
      id: row.board_id, stateBase64: row.state_base64, updatedAt: row.updated_at,
    }));
  }

  async load(boardId: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM board_docs WHERE board_id = $1",
      [boardId]
    );
    return rows[0]?.state_base64 ?? null;
  }

  async save(boardId: string, base64: string): Promise<void> {
    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO board_docs (board_id, state_base64, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(board_id) DO UPDATE SET
         state_base64 = excluded.state_base64,
         updated_at = excluded.updated_at`,
      [boardId, base64, updatedAt]
    );
  }
}
