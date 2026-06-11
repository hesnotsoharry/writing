import type { BoardDocStore } from "./boardDocStore";
import { getDb } from "./schema";

export class SqliteBoardDocStore implements BoardDocStore {
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
    await db.execute(
      "INSERT INTO board_docs (board_id, state_base64) VALUES ($1, $2) ON CONFLICT(board_id) DO UPDATE SET state_base64 = excluded.state_base64",
      [boardId, base64]
    );
  }
}
