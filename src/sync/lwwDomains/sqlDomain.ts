import type { DbClient } from "../../db/dbClient";
import type { LwwDomainAdapter } from "../lww/registry";

export interface SqlDomainDefinition {
  domain: string;
  table: string;
  key: string;
  columns: readonly string[];
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
  };
}
