import type { DbClient } from "../../db/dbClient";

export interface QuickNote {
  id: string;
  project_id: string;
  body: string;
  created_at: number;
  filed: number;
}

export interface QuickNoteStore {
  create(projectId: string, body: string): Promise<string>;
  listUnfiled(projectId: string): Promise<QuickNote[]>;
  countUnfiled(projectId: string): Promise<number>;
  updateBody(id: string, body: string): Promise<void>;
  markFiled(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

class DbQuickNoteStore implements QuickNoteStore {
  constructor(private readonly db: DbClient) {}

  async create(projectId: string, body: string): Promise<string> {
    const id = crypto.randomUUID();
    const created_at = Date.now();
    // source/state written explicitly rather than relying on the column
    // DEFAULT — desktop has one capture path (⌘K) so source is always null,
    // but a divergent default between desktop and mobile's own explicit
    // writes (mobile/src/db/mobileQuickNoteStore.ts) is the kind of thing
    // that's cheap to keep aligned and expensive to debug later.
    await this.db.execute(
      "INSERT INTO quick_notes (id, project_id, body, created_at, filed, source, state) VALUES ($1,$2,$3,$4,0,$5,$6)",
      [id, projectId, body, created_at, null, "inbox"]
    );
    return id;
  }

  async listUnfiled(projectId: string): Promise<QuickNote[]> {
    return this.db.select<QuickNote[]>(
      "SELECT id, project_id, body, created_at, filed FROM quick_notes WHERE project_id=$1 AND filed=0 ORDER BY created_at DESC",
      [projectId]
    );
  }

  async countUnfiled(projectId: string): Promise<number> {
    const rows = await this.db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM quick_notes WHERE project_id=$1 AND filed=0",
      [projectId]
    );
    return rows[0]?.n ?? 0;
  }

  async updateBody(id: string, body: string): Promise<void> {
    await this.db.execute(
      "UPDATE quick_notes SET body=$1 WHERE id=$2",
      [body, id]
    );
  }

  async markFiled(id: string): Promise<void> {
    // `state` is the column mobile actually queries by (state = 'inbox') —
    // leaving it at 'inbox' after a desktop file meant a desktop-filed note
    // counted as unfiled forever on mobile. Set both so either side's query
    // agrees on filed status.
    await this.db.execute(
      "UPDATE quick_notes SET filed=1, state='filed' WHERE id=$1",
      [id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.execute(
      "DELETE FROM quick_notes WHERE id=$1",
      [id]
    );
  }
}

export function makeQuickNoteStore(db: DbClient): QuickNoteStore {
  return new DbQuickNoteStore(db);
}
