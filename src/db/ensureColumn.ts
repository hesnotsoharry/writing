import type { DbClient } from "./dbClient";

/** Add a column only when SQLite reports that it is absent. */
export async function ensureColumn(
  db: DbClient,
  table: string,
  column: string,
  ddlType: string
): Promise<void> {
  const rows = await db.select<{ name: string }[]>(
    `PRAGMA table_info(${table})`
  );
  if (rows.some((row) => row.name === column)) return;
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
}
