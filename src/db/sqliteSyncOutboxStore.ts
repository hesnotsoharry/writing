import type { SyncOutboxEntry, SyncOutboxStore } from "../sync/outbox";
import type { DbClient } from "./dbClient";

interface OutboxDbRow {
  id: string; domain: string; project_id: string | null; item_id: string;
  kind: string; payload: string | null; created_at: string; acked_at: string | null;
}
const fromDb = (row: OutboxDbRow): SyncOutboxEntry => ({
  id: row.id, domain: row.domain, projectId: row.project_id, itemId: row.item_id,
  kind: row.kind, payload: row.payload, createdAt: row.created_at, ackedAt: row.acked_at,
});

export class SqliteSyncOutboxStore implements SyncOutboxStore {
  constructor(private readonly db: DbClient) {}
  async enqueue(
    entry: Omit<SyncOutboxEntry, "id" | "createdAt" | "ackedAt">,
  ): Promise<SyncOutboxEntry> {
    const existing = await this.find(entry.domain, entry.itemId);
    const id = existing?.id ?? `${entry.domain}:${entry.itemId}`;
    const createdAt = existing?.createdAt ?? new Date().toISOString();
    await this.db.execute(
      `INSERT INTO sync_outbox
       (id, domain, project_id, item_id, kind, payload, created_at, acked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(domain, item_id) DO UPDATE SET project_id=excluded.project_id,
       kind=excluded.kind, payload=excluded.payload, acked_at=NULL`,
      [id, entry.domain, entry.projectId, entry.itemId, entry.kind, entry.payload, createdAt],
    );
    return { ...entry, id, createdAt, ackedAt: null };
  }
  async listPending(): Promise<SyncOutboxEntry[]> {
    const rows = await this.db.select<OutboxDbRow[]>(
      "SELECT * FROM sync_outbox WHERE acked_at IS NULL ORDER BY created_at, id",
    );
    return rows.map(fromDb);
  }
  async acknowledge(id: string): Promise<void> {
    await this.db.execute("UPDATE sync_outbox SET acked_at = ? WHERE id = ?", [new Date().toISOString(), id]);
  }
  async acknowledgeItem(domain: string, itemId: string): Promise<void> {
    await this.db.execute(
      "UPDATE sync_outbox SET acked_at = ? WHERE domain = ? AND item_id = ?",
      [new Date().toISOString(), domain, itemId],
    );
  }
  async removeItem(domain: string, itemId: string): Promise<void> {
    await this.db.execute("DELETE FROM sync_outbox WHERE domain = ? AND item_id = ?", [domain, itemId]);
  }
  private async find(domain: string, itemId: string): Promise<SyncOutboxEntry | null> {
    const rows = await this.db.select<OutboxDbRow[]>(
      "SELECT * FROM sync_outbox WHERE domain = ? AND item_id = ?", [domain, itemId],
    );
    return rows[0] ? fromDb(rows[0]) : null;
  }
}
