import type { DbClient } from "../shared/dbClient";
import type { QuickNote, QuickNoteStore } from "../shared/quickNoteStore";
import { mobileLocalWrites } from "./mobileLocalWriteBridge";

export interface MobileQuickNote extends QuickNote {
  source: string | null;
  state: string;
  updated_at: string | null;
}

export class MobileQuickNoteStore implements QuickNoteStore {
  constructor(private readonly db: DbClient) {}

  async create(projectId: string, body: string, source: string | null = null): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO quick_notes (id, project_id, body, created_at, filed, source, state, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, 'inbox', ?)`, [id, projectId, body, Date.now(), source, now],
    );
    mobileLocalWrites.notify({ domain: "quick_notes", projectId, rowId: id, deleted: false });
    return id;
  }

  listUnfiled(projectId: string): Promise<MobileQuickNote[]> {
    return this.db.select(
      `SELECT id, project_id, body, created_at, filed, source, state, updated_at
       FROM quick_notes WHERE project_id = ? AND state = 'inbox' ORDER BY created_at DESC`, [projectId],
    );
  }

  async countUnfiled(projectId: string): Promise<number> {
    const rows = await this.db.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM quick_notes WHERE project_id = ? AND state = 'inbox'", [projectId],
    );
    return rows[0]?.count ?? 0;
  }

  updateBody(id: string, body: string): Promise<void> { return this.update(id, "body = ?", [body]); }
  markFiled(id: string): Promise<void> { return this.update(id, "filed = 1, state = 'filed'", []); }

  async delete(id: string): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM quick_notes WHERE id = ?", [id]);
    await this.db.execute("DELETE FROM quick_notes WHERE id = ?", [id]);
    if (rows[0]) mobileLocalWrites.notify({ domain: "quick_notes", projectId: rows[0].project_id, rowId: id, deleted: true });
  }

  private async update(id: string, assignment: string, params: unknown[]): Promise<void> {
    const rows = await this.db.select<{ project_id: string }[]>("SELECT project_id FROM quick_notes WHERE id = ?", [id]);
    const updatedAt = new Date().toISOString();
    await this.db.execute(`UPDATE quick_notes SET ${assignment}, updated_at = ? WHERE id = ?`, [...params, updatedAt, id]);
    if (rows[0]) mobileLocalWrites.notify({ domain: "quick_notes", projectId: rows[0].project_id, rowId: id, deleted: false });
  }
}
