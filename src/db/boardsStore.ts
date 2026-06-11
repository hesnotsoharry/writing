/** Abstraction over the boards table (CRUD operations). */
export interface BoardsStore {
  /** List all boards for a project, ordered by sort ascending. */
  list(projectId: string): Promise<Array<{ id: string; project_id: string; title: string; sort: number }>>;
  /** Create a new board row. */
  create(board: { id: string; project_id: string; title: string; sort: number }): Promise<void>;
  /** Rename a board by id. */
  rename(id: string, title: string): Promise<void>;
  /** Delete a board and its associated board_docs row (cascading delete). */
  remove(id: string): Promise<void>;
}

/** Test / in-memory implementation. */
export class InMemoryBoardsStore implements BoardsStore {
  private boards = new Map<string, { id: string; project_id: string; title: string; sort: number }>();

  async list(projectId: string): Promise<Array<{ id: string; project_id: string; title: string; sort: number }>> {
    const result = Array.from(this.boards.values())
      .filter((b) => b.project_id === projectId)
      .sort((a, b) => a.sort - b.sort);
    return result;
  }

  async create(board: { id: string; project_id: string; title: string; sort: number }): Promise<void> {
    this.boards.set(board.id, board);
  }

  async rename(id: string, title: string): Promise<void> {
    const board = this.boards.get(id);
    if (board) {
      board.title = title;
    }
  }

  async remove(id: string): Promise<void> {
    this.boards.delete(id);
  }
}
