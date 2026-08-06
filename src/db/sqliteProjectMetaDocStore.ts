import type { ProjectMetaDocStore } from "./projectMetaDocStore";
import { getDb } from "./schema";

export class SqliteProjectMetaDocStore implements ProjectMetaDocStore {
  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    const db = await getDb();
    const rows = await db.select<Array<{
      project_id: string; state_base64: string; updated_at: string | null;
    }>>("SELECT project_id, state_base64, updated_at FROM project_meta_docs");
    return rows.map((row) => ({
      id: row.project_id, stateBase64: row.state_base64, updatedAt: row.updated_at,
    }));
  }

  async load(projectId: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM project_meta_docs WHERE project_id = $1", [projectId]
    );
    return rows[0]?.state_base64 ?? null;
  }

  async save(projectId: string, base64: string): Promise<void> {
    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO project_meta_docs (project_id, state_base64, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(project_id) DO UPDATE SET
         state_base64 = excluded.state_base64,
         updated_at = excluded.updated_at`,
      [projectId, base64, updatedAt]
    );
  }
}
