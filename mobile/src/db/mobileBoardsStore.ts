import type { BoardsStore } from "../shared/boardsStore";
import type { DbClient } from "../shared/dbClient";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";
import { MobileBoardDocStore } from "./syncStores/mobileBoardDocStore";

export class MobileBoardsStore implements BoardsStore {
  readonly docs = new MobileBoardDocStore();
  constructor(private readonly db: DbClient) {}

  list(projectId: string): Promise<Array<{ id: string; project_id: string; title: string; sort: number }>> {
    return this.db.select(
      "SELECT id, project_id, title, sort FROM boards WHERE project_id = ? ORDER BY sort", [projectId],
    );
  }

  async create(board: { id: string; project_id: string; title: string; sort: number }): Promise<void> {
    await this.db.execute("INSERT INTO boards (id, project_id, title, sort) VALUES (?, ?, ?, ?)", [
      board.id, board.project_id, board.title, board.sort,
    ]);
    mobileLocalWrites.notify({ domain: "boards", projectId: board.project_id, rowId: board.id, deleted: false });
  }

  async rename(id: string, title: string): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM boards WHERE id = ?", [id]);
    await this.db.execute("UPDATE boards SET title = ? WHERE id = ?", [title, id]);
    if (rows[0]) mobileLocalWrites.notify({ domain: "boards", projectId: rows[0].project_id, rowId: id, deleted: false });
  }

  async remove(id: string): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM boards WHERE id = ?", [id]);
    await this.db.execute("DELETE FROM board_docs WHERE board_id = ?", [id]);
    await this.db.execute("DELETE FROM boards WHERE id = ?", [id]);
    if (rows[0]) mobileLocalWrites.notify({ domain: "boards", projectId: rows[0].project_id, rowId: id, deleted: true });
  }
}
