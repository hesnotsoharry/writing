import type { DbClient } from "./dbClient";
import type { SyncLwwRow, SyncLwwStore } from "./syncLwwStore";

interface LwwDbRow {
  domain: string; project_id: string | null; row_id: string; hlc: string;
  device_id: string; deleted: number; payload_json: string | null; updated_at: string | null;
}
function fromDb(row: LwwDbRow): SyncLwwRow {
  return { domain: row.domain, projectId: row.project_id, rowId: row.row_id,
    hlc: row.hlc, deviceId: row.device_id, deleted: row.deleted !== 0,
    payloadJson: row.payload_json, updatedAt: row.updated_at };
}

export class SqliteSyncLwwStore implements SyncLwwStore {
  constructor(private readonly db: DbClient) {}

  async get(domain: string, rowId: string): Promise<SyncLwwRow | null> {
    const rows = await this.db.select<LwwDbRow[]>(
      "SELECT * FROM sync_lww_rows WHERE domain = ? AND row_id = ?", [domain, rowId],
    );
    return rows[0] ? fromDb(rows[0]) : null;
  }

  async putIfNewer(row: SyncLwwRow): Promise<boolean> {
    const result = await this.db.execute(
      `INSERT INTO sync_lww_rows
       (domain, project_id, row_id, hlc, device_id, deleted, payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(domain, row_id) DO UPDATE SET project_id=excluded.project_id,
       hlc=excluded.hlc, device_id=excluded.device_id, deleted=excluded.deleted,
       payload_json=excluded.payload_json, updated_at=excluded.updated_at
       WHERE excluded.hlc > sync_lww_rows.hlc
          OR (excluded.hlc = sync_lww_rows.hlc
              AND excluded.device_id > sync_lww_rows.device_id)`,
      [row.domain, row.projectId, row.rowId, row.hlc, row.deviceId,
        row.deleted ? 1 : 0, row.payloadJson, row.updatedAt],
    );
    return result.rowsAffected > 0;
  }

  async list(
    domain: string, projectId: string | null, after = "", limit = 512,
  ): Promise<SyncLwwRow[]> {
    const rows = await this.db.select<LwwDbRow[]>(
      `SELECT * FROM sync_lww_rows WHERE domain = ? AND project_id IS ? AND row_id > ?
       ORDER BY row_id LIMIT ?`, [domain, projectId, after, limit],
    );
    return rows.map(fromDb);
  }

  async listRowIds(domain: string): Promise<Set<string>> {
    // No `deleted` filter on purpose — see the interface note.
    const rows = await this.db.select<Array<{ row_id: string }>>(
      "SELECT row_id FROM sync_lww_rows WHERE domain = ?", [domain],
    );
    return new Set(rows.map((row) => row.row_id));
  }

  async listScopes(): Promise<Array<{ domain: string; projectId: string | null }>> {
    const rows = await this.db.select<Array<{ domain: string; project_id: string | null }>>(
      "SELECT DISTINCT domain, project_id FROM sync_lww_rows ORDER BY domain, project_id",
    );
    return rows.map((row) => ({ domain: row.domain, projectId: row.project_id }));
  }
}
