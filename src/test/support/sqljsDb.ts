import { createRequire } from "node:module";

import type { BindParams } from "sql.js";
import initSqlJs from "sql.js";

import type { DbHandle } from "../../db/schema";

/**
 * A real in-process sql.js engine wrapped as DbHandle.
 * `executeCalls` records every SQL string passed to `execute()` so tests
 * can assert on idempotency (no migration SQL fired on the second run).
 * `close()` frees the WASM memory.
 */
export type SqlJsTestDb = DbHandle & {
  executeCalls: string[];
  close(): void;
};

/**
 * Resolve the sql.js WASM binary path at runtime so this file works from
 * any working directory. `createRequire(import.meta.url)` gives us a
 * CommonJS-style `require.resolve` in ESM — the only reliable cross-platform
 * way to locate a file inside `node_modules` from an ESM module.
 */
function resolveWasmPath(): string {
  const require = createRequire(import.meta.url);
  return require.resolve("sql.js/dist/sql-wasm.wasm");
}

/**
 * Run a SELECT query on the sql.js DB and return results as plain row objects.
 * Uses prepare/bind/step/getAsObject so every column is keyed by name, matching the
 * shape that `@tauri-apps/plugin-sql` select<T>() returns in production.
 */
function runSelect<T>(
  db: import("sql.js").Database,
  query: string,
  bindValues?: unknown[]
): T {
  const stmt = db.prepare(query);
  if (bindValues !== undefined) {
    stmt.bind(bindValues as BindParams);
  }
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  // PRAGMA table_info returns dflt_value as SQLITE_TEXT even for integer/float
  // default expressions (e.g. DEFAULT 0 → "0"). Coerce numeric-looking dflt_value
  // strings to their JavaScript number equivalents so tests can assert toBe(0) etc.
  if (/PRAGMA\s+table_x?info\b/i.test(query)) {
    return rows.map((row) => ({
      ...row,
      dflt_value:
        typeof row.dflt_value === "string" && row.dflt_value !== "NULL"
          ? (Number.isFinite(Number(row.dflt_value)) ? Number(row.dflt_value) : row.dflt_value)
          : row.dflt_value,
    })) as T;
  }
  return rows as T;
}

/**
 * Build a sql.js-backed DbHandle for use in Vitest (Node environment).
 *
 * The WASM binary is loaded once per `makeSqlJsDb()` call. Tests should call
 * `db.close()` in a `finally` block to release the WASM heap.
 */
export async function makeSqlJsDb(): Promise<SqlJsTestDb> {
  const wasmPath = resolveWasmPath();
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const inner = new SQL.Database();
  const executeCalls: string[] = [];

  return {
    executeCalls,

    select<T>(query: string, bindValues?: unknown[]): Promise<T> {
      return Promise.resolve(runSelect<T>(inner, query, bindValues));
    },

    execute(query: string, bindValues?: unknown[]): Promise<unknown> {
      executeCalls.push(query);
      // db.run() throws synchronously on SQL errors (constraint violations,
      // syntax errors). We surface the throw so migration tests see real errors.
      inner.run(query, bindValues as BindParams | undefined);
      return Promise.resolve();
    },

    close(): void {
      inner.close();
    },
  };
}
