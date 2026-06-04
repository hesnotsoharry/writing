# Wave 6 Research: Versioned SQLite Migration System

## Question 1: @tauri-apps/plugin-sql API Surface (v2)

**Source:** `/tauri-apps/tauri-plugin-sql` — High reputation, official Tauri plugin.

### Methods Exposed

The `Database` class exposes only two core query methods:

```typescript
db.execute(sql: string, params?: any[]): Promise<QueryResult>
db.select<T>(sql: string, params?: any[]): Promise<T>
```

**No transaction support.** The plugin does NOT expose `begin()`, `commit()`, `rollback()`, or a `transaction()` wrapper. Each `execute()` call is auto-wrapped in its own transaction and auto-commits (since `journal_mode=DELETE` is default). This is a hard limitation.

### QueryResult Shape

`execute()` returns:
```typescript
{
  rowsAffected: number;  // rows modified by INSERT/UPDATE/DELETE
  lastInsertId: number;  // last auto-increment ID (SQLite only; Postgres returns 0)
}
```

### Statement Batching

A single `execute()` call runs **one statement only** (the SQL parser stops at the first semicolon). Multiple semicolon-separated statements are NOT supported in a single call. To run multiple statements, make multiple `execute()` calls — each auto-commits independently.

---

## Question 2: PRAGMA user_version for Migration Versioning

**Source:** [SQLite DB Migrations with PRAGMA user_version](https://levlaz.org/sqlite-db-migrations-with-pragma-user_version/) — community best practice.

### Reading and Setting

```typescript
// Read current version
const result = await db.select<{ user_version: number }[]>(
  "PRAGMA user_version;"
);
const currentVersion = result[0].user_version;

// Set version (increment after migration succeeds)
await db.execute("PRAGMA user_version = 2;");
// Note: version int MUST be validated before interpolation — PRAGMAs don't accept parameters
```

**Critical:** PRAGMA values cannot use parameterized placeholders (`$1`, `?`). The version integer must be validated as a safe number, then string-interpolated into the SQL: `"PRAGMA user_version = " + safeVersionInt + ";"`. Treat user input as untrusted; validate with `Number.isInteger(v) && v >= 0 && v <= 2147483647`.

### Read Result Shape

`PRAGMA user_version;` returns a single row: `{ user_version: number }`.

---

## Question 3: Table-Rebuild Migration Pattern (No Transactions)

**Source:** [SQLite ALTER TABLE documentation](https://www.sqlite.org/lang_altertable.html) — official SQLite.

### The 12-Step Procedure (Simplified)

To add a UNIQUE constraint to an existing table without transaction support:

```sql
-- Step 1: Disable foreign keys (if enabled)
PRAGMA foreign_keys=OFF;

-- Step 2: Save the old schema (via SELECT ... FROM sqlite_schema)

-- Step 3: Create new table with the constraint
CREATE TABLE entities_new (
  scene_id INTEGER NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  UNIQUE(scene_id, entity_id)
);

-- Step 4: Copy data (dedup if needed — see Question 4)
INSERT INTO entities_new (scene_id, entity_id, data)
  SELECT scene_id, entity_id, data FROM entities;

-- Step 5: Drop old table
DROP TABLE entities;

-- Step 6: Rename new table to original name
ALTER TABLE entities_new RENAME TO entities;

-- Step 7: Recreate indexes, triggers, views (if any)
-- (query sqlite_schema to get the original CREATE statements)

-- Step 8: Verify foreign keys
PRAGMA foreign_key_check;

-- Step 9: Re-enable foreign keys (if originally enabled)
PRAGMA foreign_keys=ON;
```

### Failure Modes & Safety Strategy

**Without explicit transactions, each `execute()` auto-commits.** If a crash occurs mid-migration:
- Steps 1–3 succeed, step 4 fails (duplicate key violation) → table is left in inconsistent state (old table gone, new table incomplete).
- Mitigation: **Guard the version bump to AFTER all steps succeed.** Design the migration as:
  1. Create new table (idempotent: `CREATE TABLE IF NOT EXISTS`)
  2. INSERT ... SELECT (idempotent: verify no duplicates first, or use upsert logic)
  3. DROP old table (idempotent: `DROP TABLE IF EXISTS`)
  4. RENAME (idempotent: happens only once)
  5. **Only then:** `PRAGMA user_version = N;`

If the app crashes before step 5, on next startup:
- The user_version check sees the old version is still set.
- The migration re-runs.
- Steps 1–4 are idempotent (IF EXISTS, IF NOT EXISTS guards).
- Step 5 finally bumps the version.
- Migration is considered complete.

**Additional safeguard:** Copy the database file before starting migrations (backup-before-migrate). If the migration fails catastrophically, restore from the backup.

---

## Question 4: Deduplicate Before UNIQUE Constraint

**Source:** [SQLite Duplicate Deletion Guide](https://www.geeksforgeeks.org/sqlite/how-to-delete-duplicate-rows-in-sqlite/) — community consensus.

### The SQL Idiom

```sql
DELETE FROM entities 
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM entities 
  GROUP BY scene_id, entity_id
);
```

This deletes all but the row with the lowest `rowid` for each unique (scene_id, entity_id) pair. SQLite's `rowid` is a special pseudocolumn guaranteed to be unique per table.

**Correctness:** This is the standard SQLite pattern. It groups by the key columns, selects the minimum rowid in each group (the "keeper"), and deletes everything else. No ambiguity.

---

## Question 5: journal_mode=DELETE Durability for Multi-Step Migrations

**Source:** [SQLite PRAGMA documentation](https://www.sqlite.org/pragma.html) — official SQLite.

### The Risk

SQLite's default `journal_mode=DELETE` deletes the rollback journal file **immediately after each auto-commit.** With no explicit transaction wrapping your migration steps:

- Each `execute()` call auto-commits → journal deleted.
- A crash between steps leaves the database partially modified.
- **No rollback journal exists to recover from the crash.**

### Mitigation

Since `@tauri-apps/plugin-sql` has no transaction API, idempotency is the only defense:
- Use `CREATE TABLE IF NOT EXISTS` for table creation.
- Use `DROP TABLE IF EXISTS` for table deletion.
- Use upsert logic or check-before-insert for data copies.
- **Bump PRAGMA user_version LAST,** after all other steps complete. On restart, the version check re-runs the entire migration. Failed steps re-run safely due to idempotency.

The journal_mode itself is not the issue; the lack of transaction wrapping is. The workaround is application-level idempotency.

---

## Summary for Implementation

| Aspect | Finding |
|---|---|
| **DB.execute() / select()** | Only two methods, no transactions. Each execute auto-commits. |
| **Return shape** | `{ rowsAffected, lastInsertId }` |
| **Statement batching** | One statement per execute() call. |
| **user_version** | Read: `PRAGMA user_version;` → `{ user_version: number }`. Set: `PRAGMA user_version = N;` (validate N before interpolation). |
| **Table rebuild** | Create-new → copy-data (dedupe) → drop-old → rename-new. Idempotent, version-bump-last. |
| **Dedupe SQL** | `DELETE ... WHERE rowid NOT IN (SELECT MIN(rowid) FROM ... GROUP BY key_cols);` |
| **Durability** | journal_mode=DELETE auto-commits each step. Mitigation: idempotent steps + version-last. |
