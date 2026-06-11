import type { BoardsStore } from "./boardsStore";
import { getDb } from "./schema";

export class SqliteBoardsStore implements BoardsStore {
  async list(
    projectId: string
  ): Promise<Array<{ id: string; project_id: string; title: string; sort: number }>> {
    const db = await getDb();
    return db.select<Array<{ id: string; project_id: string; title: string; sort: number }>>(
      "SELECT id, project_id, title, sort FROM boards WHERE project_id = $1 ORDER BY sort ASC",
      [projectId]
    );
  }

  async create(board: {
    id: string;
    project_id: string;
    title: string;
    sort: number;
  }): Promise<void> {
    const db = await getDb();
    await db.execute(
      "INSERT INTO boards (id, project_id, title, sort) VALUES ($1, $2, $3, $4)",
      [board.id, board.project_id, board.title, board.sort]
    );
  }

  async rename(id: string, title: string): Promise<void> {
    const db = await getDb();
    await db.execute("UPDATE boards SET title = $1 WHERE id = $2", [title, id]);
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM board_docs WHERE board_id = $1", [id]);
    await db.execute("DELETE FROM boards WHERE id = $1", [id]);
  }
}
