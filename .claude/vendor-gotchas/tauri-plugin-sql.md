---
vendor: tauri-plugin-sql
sdkVersion: "2"
lastVerified: 2026-06-05
related:
  - src/db/schema.ts
  - src/db/migrations.ts
  - roadmap/decisions/0006-sqlite-migration-framework.md
---

# tauri-plugin-sql (SQLite) — gotchas

Pre-flight reference before touching SQL in this project. The plugin is a thin
async wrapper over SQLite; several conveniences you'd expect from a server SQL
driver are absent. (The Yjs base64-TEXT storage gotcha lives in the project
`CLAUDE.md`, not here — don't duplicate it.)

## One statement per `execute()` — batched SQL is silently dropped
`db.execute("CREATE TABLE a (...); CREATE TABLE b (...)")` runs only the FIRST
statement; the rest are dropped with NO error. Split every multi-statement block
into separate `execute()` calls (see the per-statement runner in
`src/db/migrations.ts`). This is the easiest way to ship a "migration ran clean"
that silently did half the work — verify statement-by-statement.

## No transaction API
The JS `Database` surface exposes no `BEGIN`/`COMMIT`/`ROLLBACK`. You cannot wrap
a multi-step migration in a transaction, so a crash mid-migration leaves the DB
half-updated. The project's safety strategy (locked in ADR 0006): make every
migration step **idempotent** (guard with `IF [NOT] EXISTS` / `INSERT OR IGNORE`
/ `sqlite_master` checks) and bump `PRAGMA user_version` **only after** the
migration's steps succeed — so a re-run after a crash re-applies safely and the
version never advances past a partial migration.

## `PRAGMA user_version` is the migration cursor
Read it via `db.select("PRAGMA user_version")` (returns a row, not a scalar —
unwrap `[0].user_version`); write it by interpolating an integer literal into
`PRAGMA user_version = N` (bound params don't work on PRAGMA). Validate N is a
non-negative 32-bit integer before writing (`assertSafeVersion` in migrations.ts)
— a bad value silently corrupts the cursor.

## Testing migrations: sql.js is a faithful in-memory substrate
`sql.js` (WASM SQLite) enforces real PRAGMA / constraints / UNIQUE behaviour with
no native build, so migration logic can be tested without a live Tauri runtime
(`src/test/support/sqljsDb.ts`). It is NOT identical to the plugin's on-disk
SQLite, so it does NOT replace a live-launch smoke on the real `writing.db` — it
proves the SQL logic, not the plugin's disk round-trip.

## Atomic multi-row updates: use COALESCE to fold conditional logic into the WHERE clause
When updating multiple rows based on conditions (e.g., "update label count only
if it exists, else set it to 1"), an UPDATE with a subquery + WHERE may fail to
fire on rows that don't yet exist. Instead, use COALESCE to synthesize an initial
value if NULL, then increment:
```sql
UPDATE scene_labels SET sort_order = COALESCE((SELECT MAX(sort_order) FROM scene_labels WHERE scene_id=?), 0) + 1
WHERE scene_id=? AND label_id=?;
```
This is atomic in SQLite (runs in a single statement), avoiding a separate
INSERT-or-skip. Especially useful in label assignment workflows where the row may
not exist yet but should default to a sensible initial value (e.g., position 0)
before incrementing.
