import { type DbHandle,getDb } from "../../db/schema";

export interface QuickNote {
  id: string;
  project_id: string;
  body: string;
  created_at: number;
  filed: number;
}

export class SqliteQuickNoteStore {
  constructor(private dbProvider: () => Promise<DbHandle> = getDb) {}

  async create(projectId: string, body: string): Promise<string> {
    const db = await this.dbProvider();
    const id = crypto.randomUUID();
    const created_at = Date.now();
    await db.execute(
      "INSERT INTO quick_notes (id, project_id, body, created_at, filed) VALUES ($1,$2,$3,$4,0)",
      [id, projectId, body, created_at]
    );
    return id;
  }

  async listUnfiled(projectId: string): Promise<QuickNote[]> {
    const db = await this.dbProvider();
    return db.select<QuickNote[]>(
      "SELECT id, project_id, body, created_at, filed FROM quick_notes WHERE project_id=$1 AND filed=0 ORDER BY created_at DESC",
      [projectId]
    );
  }

  async countUnfiled(projectId: string): Promise<number> {
    const db = await this.dbProvider();
    const rows = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM quick_notes WHERE project_id=$1 AND filed=0",
      [projectId]
    );
    return rows[0]?.n ?? 0;
  }

  async updateBody(id: string, body: string): Promise<void> {
    const db = await this.dbProvider();
    await db.execute(
      "UPDATE quick_notes SET body=$1 WHERE id=$2",
      [body, id]
    );
  }

  async markFiled(id: string): Promise<void> {
    const db = await this.dbProvider();
    await db.execute(
      "UPDATE quick_notes SET filed=1 WHERE id=$1",
      [id]
    );
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbProvider();
    await db.execute(
      "DELETE FROM quick_notes WHERE id=$1",
      [id]
    );
  }
}
