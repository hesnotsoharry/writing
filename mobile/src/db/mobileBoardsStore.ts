import type { BoardsStore } from "../shared/boardsStore";
import type { DbClient } from "../shared/dbClient";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";
import { MobileBoardDocStore } from "./syncStores/mobileBoardDocStore";

/**
 * Title for a project's auto-seeded default board — mirrors the literal
 * "Default Board" desktop writes in `src/binder/BrainstormSection.tsx`
 * (`useBoardsList`'s legacy-seed path). Desktop keeps it as an inline string,
 * not an exported constant, so this has to be hand-matched rather than
 * imported.
 *
 * The board *id* is deliberately NOT desktop's matching literal
 * ("brainstorm-default"): `boards.id` is a bare `TEXT PRIMARY KEY` with no
 * project scope, so desktop's seed — which reuses that one literal id for
 * every project that opens Brainstorm with zero boards — only succeeds for
 * the first project; every later project's INSERT hits a PK conflict that
 * desktop's seed silently swallows, leaving it boardless.
 * That is fine for desktop's Phase-1 upgrade path (there was only ever one
 * project when the literal was introduced), but mobile's whole point is many
 * projects, so seeding here uses a fresh `crypto.randomUUID()` per project
 * instead of copying the collision.
 */
export const DEFAULT_BOARD_TITLE = "Default Board";

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

  /**
   * Give a project a default board if it has none — idempotent, so a project
   * that already has one or more boards is left untouched. Covers both a
   * fresh project at creation time and an older boardless project the board
   * viewer discovers on open (see `BoardViewerScreen.useBoard`).
   */
  async ensureDefaultBoard(projectId: string): Promise<void> {
    const existing = await this.list(projectId);
    if (existing.length > 0) return;
    await this.create({ id: crypto.randomUUID(), project_id: projectId, title: DEFAULT_BOARD_TITLE, sort: 0 });
  }
}
