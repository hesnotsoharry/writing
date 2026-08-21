import type { DbClient } from "../../db/dbClient";
import type { LwwDomainAdapter, LwwSeedRow } from "../lww/registry";

/**
 * How to enumerate a domain's pre-existing rows for the first-sync ledger seed.
 *
 * Everything is an SQL expression rather than a column name because two of the
 * domains need more than a column: `scene_snapshots` reaches its project by
 * joining `scenes`, and `goals` has a nullable `updated_at` that has to fall
 * back to `created_at`.
 */
export interface SqlDomainSeed {
  /** Yields the row's project scope. Omit for a table with no project column. */
  project?: string;
  /**
   * Yields the row's own timestamp — epoch ms or an ISO string, both accepted.
   * Omit for a table that keeps none; those rows seed at 0.
   */
  stamp?: string;
  /** FROM clause, when the scope needs a join. Defaults to the table alone. */
  from?: string;
  /** Restricts which rows are worth announcing at all. */
  where?: string;
}

export interface SqlDomainDefinition {
  domain: string;
  table: string;
  key: string;
  columns: readonly string[];
  seed?: SqlDomainSeed;
}

interface SeedDbRow { row_id: string; project_id: string | null; stamp: unknown }

/**
 * Epoch ms from whatever the column holds. The schema is inconsistent by
 * history — `created_at` columns are INTEGER ms, `goals.updated_at` was added
 * later as TEXT ISO — and an unparseable or missing stamp must degrade to 0
 * (the oldest possible version) rather than to "now", which would outrank a
 * genuine remote edit or tombstone.
 */
function toStampMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  return 0;
}

function seedSql(definition: SqlDomainDefinition, seed: SqlDomainSeed): string {
  return `SELECT ${definition.table}.${definition.key} AS row_id,
       ${seed.project ?? "NULL"} AS project_id, ${seed.stamp ?? "NULL"} AS stamp
     FROM ${seed.from ?? definition.table}${seed.where ? ` WHERE ${seed.where}` : ""}`;
}

async function listSeedRows(
  db: DbClient, definition: SqlDomainDefinition, seed: SqlDomainSeed,
): Promise<LwwSeedRow[]> {
  const rows = await db.select<SeedDbRow[]>(seedSql(definition, seed));
  return rows.map((row) => ({
    rowId: row.row_id, projectId: row.project_id, stampMs: toStampMs(row.stamp),
  }));
}

function placeholders(length: number): string {
  return Array.from({ length }, () => "?").join(", ");
}

function updateAssignments(columns: readonly string[], key: string): string {
  return columns.filter((column) => column !== key)
    .map((column) => `${column}=excluded.${column}`).join(", ");
}

function parsePayload(payloadJson: string, columns: readonly string[]): Record<string, unknown> {
  const parsed: unknown = JSON.parse(payloadJson);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("LWW row payload must be an object");
  }
  const row = parsed as Record<string, unknown>;
  if (columns.some((column) => !(column in row))) throw new TypeError("LWW row payload is incomplete");
  return row;
}

export function createSqlDomainAdapter(
  db: DbClient,
  definition: SqlDomainDefinition,
): LwwDomainAdapter {
  const columnList = definition.columns.join(", ");
  const seed = definition.seed;
  return {
    domain: definition.domain,
    async readPayload(rowId) {
      const rows = await db.select<Array<Record<string, unknown>>>(
        `SELECT ${columnList} FROM ${definition.table} WHERE ${definition.key} = ?`, [rowId],
      );
      return rows[0] ? JSON.stringify(rows[0]) : null;
    },
    async projectReceived(rowId, _projectId, payloadJson) {
      const row = parsePayload(payloadJson, definition.columns);
      if (row[definition.key] !== rowId) throw new TypeError("LWW row id does not match payload");
      const assignments = updateAssignments(definition.columns, definition.key);
      await db.execute(
        `INSERT INTO ${definition.table} (${columnList}) VALUES (${placeholders(definition.columns.length)})
         ON CONFLICT(${definition.key}) DO UPDATE SET ${assignments}`,
        definition.columns.map((column) => row[column]),
      );
    },
    async applyTombstone(rowId) {
      await db.execute(`DELETE FROM ${definition.table} WHERE ${definition.key} = ?`, [rowId]);
    },
    ...(seed ? { listSeedRows: () => listSeedRows(db, definition, seed) } : {}),
  };
}
