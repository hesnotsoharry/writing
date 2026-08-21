import type { DbClient } from "./dbClient";
import { ensureColumn } from "./ensureColumn";

async function tableExists(db: DbClient, table: string): Promise<boolean> {
  const rows = await db.select<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table],
  );
  return rows.length > 0;
}

async function createSyncTables(db: DbClient): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS project_domain_docs (
    domain TEXT, project_id TEXT, state_base64 TEXT NOT NULL, updated_at TEXT,
    PRIMARY KEY(domain, project_id)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sync_lww_rows (
    domain TEXT, project_id TEXT, row_id TEXT, hlc TEXT NOT NULL,
    device_id TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT, updated_at TEXT, PRIMARY KEY(domain, row_id)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sync_outbox (
    id TEXT PRIMARY KEY, domain TEXT NOT NULL, project_id TEXT,
    item_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT,
    created_at TEXT NOT NULL, acked_at TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS sync_pending_replacements (
    scene_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, epoch_n INTEGER NOT NULL,
    epoch_device TEXT NOT NULL, state_base64 TEXT, received_at TEXT NOT NULL,
    snapshot_id TEXT
  )`);
}

async function createSyncIndexes(db: DbClient): Promise<void> {
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_sync_lww_project ON sync_lww_rows (domain, project_id, row_id)",
  );
  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_item ON sync_outbox (domain, item_id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending ON sync_outbox (acked_at, created_at, id)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_sync_pending_project ON sync_pending_replacements (project_id)",
  );
}

async function addFeatureColumns(db: DbClient): Promise<void> {
  if (await tableExists(db, "goals")) {
    await ensureColumn(db, "goals", "config_json", "TEXT NOT NULL DEFAULT '{}'");
    await ensureColumn(db, "goals", "updated_at", "TEXT");
  }
  if (await tableExists(db, "quick_notes")) {
    await ensureColumn(db, "quick_notes", "source", "TEXT");
    await ensureColumn(db, "quick_notes", "state", "TEXT NOT NULL DEFAULT 'inbox'");
    await ensureColumn(db, "quick_notes", "updated_at", "TEXT");
  }
}

/** Protocol v1.3 durable domain docs, LWW metadata, outbox and held epochs. */
export async function migration_022_sync_protocol_v13(db: DbClient): Promise<void> {
  await createSyncTables(db);
  await createSyncIndexes(db);
  await addFeatureColumns(db);
}

/**
 * Give `manuscript_about` an `updated_at` so its LWW seed can be ordered.
 *
 * It was the only replicated row domain with no timestamp column. First-sync
 * seeding stamps a row from its own timestamp, so an About row fell back to
 * stamp 0 — and two devices that both predate sync then tied at 0 with the
 * winner decided by lexicographic device id. Because the projection overwrites
 * every column, that coin flip could silently erase a whole About page
 * (synopsis, genre, tone, POV, notes) on one of them.
 *
 * Deliberately NOT added to the domain's replicated column list. `parsePayload`
 * requires every listed column to be present, so a payload from a peer on an
 * older build — which has no such column — would throw and the row would be
 * dropped. The column's job is to order this device's seed, not to travel.
 */
export async function migration_023_about_updated_at(db: DbClient): Promise<void> {
  if (!await tableExists(db, "manuscript_about")) return;
  await ensureColumn(db, "manuscript_about", "updated_at", "TEXT");
}
