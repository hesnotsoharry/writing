import type { SQLiteDatabase } from "expo-sqlite";

import type { DbClient } from "../shared/dbClient";

type Bindable = string | number | null;

/** Thrown when a caller passes a value SQLite bindings cannot represent.
 *  Loud rejection beats silent coercion: doc state crosses this boundary as
 *  base64 TEXT only (CLAUDE.md rule), so a Uint8Array here is always a bug. */
export class UnsupportedBindingError extends Error {
  constructor(kind: string, index: number) {
    super(`ExpoDbClient: unsupported parameter type "${kind}" at index ${index}`);
    this.name = "UnsupportedBindingError";
  }
}

function narrowParams(params: unknown[] | undefined): Bindable[] {
  if (!params) return [];
  return params.map((value, index) => {
    if (value === null || typeof value === "string") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new UnsupportedBindingError("non-finite number", index);
      return value;
    }
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value === undefined) throw new UnsupportedBindingError("undefined", index);
    if (value instanceof Uint8Array) throw new UnsupportedBindingError("Uint8Array", index);
    return raiseUnsupported(value, index);
  });
}

function raiseUnsupported(value: unknown, index: number): never {
  throw new UnsupportedBindingError(typeof value, index);
}

/** DbClient over expo-sqlite. Works against either the database handle or the
 *  transaction handle passed by withExclusiveTransactionAsync — both expose
 *  the same async query surface. */
export class ExpoDbClient implements DbClient {
  constructor(private readonly db: SQLiteDatabase) {}

  async select<T>(sql: string, params?: unknown[]): Promise<T> {
    return (await this.db.getAllAsync(sql, narrowParams(params))) as T;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }> {
    const result = await this.db.runAsync(sql, narrowParams(params));
    return { rowsAffected: result.changes };
  }
}
