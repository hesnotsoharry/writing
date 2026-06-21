---
id: 0006
title: SQLite migration framework — versioned, idempotent, forward-only
status: accepted
decided-in: wave-6
date: 2026-06-03
durable: true
---

# Decision 0006: SQLite migration framework

**Context:** tauri-plugin-sql v2 exposes only `db.execute()`/`db.select()` with no transaction API
(one statement per call). The app needs a versioned migration system to land the latent `scene_links`
UNIQUE constraint and to manage all future schema change through one path.

**Pick:** An ordered `MIGRATIONS` array of `{ version, name, up(db) }`; `runMigrations(db)` reads
`PRAGMA user_version`, runs each pending `up()` in order, and bumps `user_version` **after** each
`up()` returns without throwing. Every step is individually idempotent (`IF NOT EXISTS` / `IF EXISTS`
/ `INSERT OR IGNORE` / `sqlite_master` existence guards) so any migration is safe to re-run after a
crash. No backup-before-migrate, no resumable engine.

**Rationale:** Idempotent-steps + version-bump-last is the correct strategy under a no-transaction
plugin with no production data — a crash leaves `user_version` un-bumped, so the whole migration
re-runs cleanly. The cheaper "one-off rebuild without a version counter" alternative was considered
and rejected: the silent-no-op bug recurs on *every* future schema change, so the framework is needed
imminently regardless, and the cost delta at 25% build is small. Heavier backup machinery is
unwarranted with one throwaway dev DB; recovery is `rm writing.db` + relaunch.

**Consequences:** Every future migration's `up()` must be written as individually idempotent steps —
a standing contract on migration authors. Migration 1's DDL is a frozen baseline (never edited).
`assertSafeVersion` must guard every PRAGMA interpolation. Forward-only (no down-migrations).
Threshold to revisit: when real user data first exists (~Phase 2), add a pre-migration
`writing.db` → `.bak` copy at the top of `runMigrations`, gated on `user_version < target`.

**Enforcement:** `runMigrations` is the sole schema-change entry point; `getDb()` calls it
unconditionally and the `SCHEMA_DDL` parallel path is deleted (no unversioned schema route remains) —
structural enforcement, no hook. `assertSafeVersion` throws synchronously before interpolation
(convention, enforced by code structure). Backup-threshold note is advisory-only until Phase 2.
