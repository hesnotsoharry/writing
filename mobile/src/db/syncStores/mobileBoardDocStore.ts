// Mobile mirror of src/db/sqliteBoardDocStore.ts, over the mobile DbClient.
// SQL is identical to desktop's — mirrored, not shared (portable-boundary rule).
import type { BoardDocStore } from "../../shared/boardDocStore";
import { getMobileDb } from "../database";

export class MobileBoardDocStore implements BoardDocStore {
  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    const db = await getMobileDb();
    // Mirror of sqliteBoardDocStore: never advertise a board doc whose
    // boards row is gone, or a tombstone is re-seeded on hello.
    const rows = await db.select<Array<{
      board_id: string; state_base64: string; updated_at: string | null;
    }>>(`SELECT board_docs.board_id, board_docs.state_base64, board_docs.updated_at
       FROM board_docs INNER JOIN boards ON boards.id = board_docs.board_id`);
    return rows.map((row) => ({
      id: row.board_id, stateBase64: row.state_base64, updatedAt: row.updated_at,
    }));
  }

  async load(boardId: string): Promise<string | null> {
    const db = await getMobileDb();
    const rows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM board_docs WHERE board_id = $1", [boardId]
    );
    return rows[0]?.state_base64 ?? null;
  }

  async save(boardId: string, base64: string): Promise<void> {
    const db = await getMobileDb();
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
