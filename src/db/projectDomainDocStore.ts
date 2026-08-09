import type { DbClient } from "./dbClient";

export interface ProjectDomainDoc {
  domain: string; projectId: string; stateBase64: string; updatedAt: string | null;
}

export interface ProjectDomainDocStore {
  load(domain: string, projectId: string): Promise<string | null>;
  save(domain: string, projectId: string, stateBase64: string): Promise<void>;
  listAll(): Promise<ProjectDomainDoc[]>;
}

export class DbProjectDomainDocStore implements ProjectDomainDocStore {
  constructor(private readonly db: DbClient) {}

  async load(domain: string, projectId: string): Promise<string | null> {
    const rows = await this.db.select<Array<{ state_base64: string }>>(
      "SELECT state_base64 FROM project_domain_docs WHERE domain = ? AND project_id = ?",
      [domain, projectId],
    );
    return rows[0]?.state_base64 ?? null;
  }

  async save(domain: string, projectId: string, stateBase64: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO project_domain_docs (domain, project_id, state_base64, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(domain, project_id) DO UPDATE SET
         state_base64 = excluded.state_base64, updated_at = excluded.updated_at`,
      [domain, projectId, stateBase64, new Date().toISOString()],
    );
  }

  async listAll(): Promise<ProjectDomainDoc[]> {
    const rows = await this.db.select<Array<{
      domain: string; project_id: string; state_base64: string; updated_at: string | null;
    }>>("SELECT domain, project_id, state_base64, updated_at FROM project_domain_docs");
    return rows.map((row) => ({
      domain: row.domain, projectId: row.project_id,
      stateBase64: row.state_base64, updatedAt: row.updated_at,
    }));
  }
}
