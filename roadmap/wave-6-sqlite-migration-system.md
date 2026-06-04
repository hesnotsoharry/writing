---
status: PLANNED
created: 2026-06-03
---

# Wave 6 — DRAFT TITLE

## Plan

### Status

DRAFT · target v0.2.0 · drafted 2026-06-03.

### Goal

After this wave the app has a versioned SQLite migration system rooted in `PRAGMA user_version`,
living in `src/db/migrations.ts`. `getDb()` no longer runs an ad-hoc `CREATE TABLE IF NOT EXISTS`
block plus a one-off `ensureColumn` call — it calls a single `runMigrations(db)` that reads the DB's
`user_version`, applies every pending migration in order, and stamps the version after each succeeds.
A fresh database and an existing dev database both converge to the identical final schema and the same
`user_version`, the latent `scene_links` `UNIQUE(scene_id, entity_id)` constraint now lands on
already-created databases via a table rebuild, and there is exactly one path through which any future
schema change can reach a user's database.

### Scope

**In scope:**

- New `src/db/migrations.ts`: `runMigrations(db)`, the ordered `MIGRATIONS` registry
  (`{ version, name, up }`), and the `assertSafeVersion(n)` integer guard for PRAGMA interpolation.
- Refactor `src/db/schema.ts` `getDb()` to call `runMigrations(db)`; **delete** the `SCHEMA_DDL`
  const and the inline `ensureColumn('plaintext_projection')` call. Keep `ensureColumn` (now used
  *inside* a migration), `DbHandle`, and the idempotent orphan-scenes `UPDATE` (stays outside
  migrations — it is a data repair, not a schema change).
- Migration 1 (`baseline-schema`): full `CREATE TABLE IF NOT EXISTS` for every table — deliberately
  creating `scene_links` **without** the UNIQUE constraint (the constraint arrives in migration 3).
- Migration 2 (`plaintext-projection-formal`): delegates to `ensureColumn(db,'scene_docs',
  'plaintext_projection','TEXT')`; no-op on all current DBs, formalizes provenance.
- Migration 3 (`scene-links-unique`): table rebuild adding `UNIQUE(scene_id, entity_id)` — dedupe by
  `MIN(rowid)` grouped on `(scene_id, entity_id)`, plus a **cross-type-collision diagnostic** that
  logs (does not silently drop) any row discarded where `entity_type` differs.
- Test substrate: add `sql.js` (WASM, in-process SQLite) as a devDependency and a thin
  `DbHandle`-over-sql.js adapter, so migration SQL is verified against a real engine — not just
  string-captured by a `vi.fn()` double.
- Tests: `src/test/runMigrations.test.ts` (version-gating, ordering, idempotency, `assertSafeVersion`)
  and `src/test/migration003.test.ts` (dedupe correctness, UNIQUE enforcement, crash-recovery
  interleaves, fresh-DB empty path).

**Out of scope:**

- **Backup-before-migrate / resumable migration engine** — unwarranted with no production data
  (single dev DB, throwaway seed). Deferral path: the ADR names the threshold (first real user data,
  ~Phase 2) at which a pre-migration `writing.db` → `.bak` copy is added.
- **Down-migrations / rollback** — forward-only is the local-first-single-user standard at this
  stage. Deferral path: revisit at Phase 2 if reversibility is ever needed.
- **Redesigning the `scene_links` schema** (e.g. promoting `entity_type` into the uniqueness key) —
  the wave preserves the existing `(scene_id, entity_id)` constraint semantics, only makes them land.
  Deferral path: separate ticket if the entity model changes.
- **Any change to the wave-5 app shell or screen components** — disjoint worktree; this wave touches
  `src/db/` and `src/test/` only.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Migration framework + sql.js test harness | sonnet-implementer | honeycomb · cross-boundary (persistent storage). **End-to-end walking-skeleton slice**: create `src/db/migrations.ts` (`runMigrations`, `MIGRATIONS=[M1 baseline]`, `assertSafeVersion`); refactor `getDb()` to call `runMigrations` and delete `SCHEMA_DDL`; add `sql.js` devDep + a `DbHandle`-over-sql.js test adapter; `runMigrations.test.ts` is the **smoke run** — it executes the framework against a real in-memory engine proving a fresh DB and a pre-seeded "old-schema" DB both converge and a second run is a no-op. M1 DDL carries a "frozen baseline — never edit" comment + the scene_links-without-UNIQUE rationale. Orchestrator authors the convergence acceptance test before dispatch. reviewTier: **single**. | Internal — no observation point (framework + tests only; no UI surface). |
| 2 | Fold plaintext_projection into the framework (migration 2) | haiku-implementer | pyramid · internal-only. Tight spec: add `migration_002_plaintext_projection` (delegates to existing `ensureColumn`) to the `MIGRATIONS` array; update `runMigrations.test.ts` so `user_version=2` is the new already-migrated floor. No judgment — mechanical registry addition. reviewTier: **single** (migration code touching persistent storage is not `skip`-eligible). | Internal — no observation point (no-op on all current DBs; records column provenance in version history). |
| 3 | scene_links UNIQUE rebuild (migration 3) + real-SQLite tests | sonnet-implementer | honeycomb · cross-boundary (persistent storage — highest-stakes phase). Add `migration_003_scene_links_unique`: create `scene_links_new` WITH `UNIQUE(scene_id,entity_id)` → dedupe `DELETE … WHERE rowid NOT IN (SELECT MIN(rowid) … GROUP BY scene_id,entity_id)` → `INSERT OR IGNORE` copy → `DROP TABLE IF EXISTS scene_links` → `ALTER … RENAME` (guarded by `sqlite_master` existence checks) → recreate index. Add the cross-type-collision diagnostic (log rows dropped where `entity_type` differs). `migration003.test.ts` via the sql.js adapter: dedupe correctness, UNIQUE enforced (duplicate INSERT raises), crash-recovery interleaves, fresh-DB empty path. Orchestrator authors the dedupe+UNIQUE acceptance test before dispatch. reviewTier: **panel**. | App launches via `npm run tauri dev` against the existing dev DB and the Tauri devtools console shows NO `UNIQUE constraint failed` / `no such column` errors; adding then deleting a scene link in the Story Bible panel persists across an app reload. |

### Acceptance criteria

- [ ] `src/db/migrations.ts` exists and exports `runMigrations`, `MIGRATIONS`, and `assertSafeVersion`.
- [ ] `getDb()` in `src/db/schema.ts` calls `runMigrations(db)`; the `SCHEMA_DDL` const is deleted
      (`grep -r "SCHEMA_DDL" src/` returns 0 matches).
- [ ] Fresh DB (`user_version` 0) → after `runMigrations`, `PRAGMA user_version` returns 3, every
      table exists, and `scene_links` has the `UNIQUE(scene_id, entity_id)` constraint (a duplicate
      INSERT raises a constraint error in the sql.js test).
- [ ] Pre-seeded "old-schema" DB (tables exist, `scene_links` lacks UNIQUE, `user_version` 0) → after
      `runMigrations`, `user_version` returns 3, `scene_links` has the UNIQUE constraint, and no error
      is thrown.
- [ ] Running `runMigrations` twice is a no-op: on the second run no migration `up()` SQL fires and
      `user_version` stays 3.
- [ ] `assertSafeVersion` throws for non-integers, negatives, and values > 2,147,483,647; passes
      valid version ints.
- [ ] Migration 3 dedupe: a DB seeded with two rows sharing `(scene_id, entity_id)` ends with exactly
      one surviving row (the `MIN(rowid)`); the cross-type-collision diagnostic logs a warning when a
      dropped row's `entity_type` differs from the survivor's.
- [ ] `sql.js` is present in `package.json` devDependencies and the `DbHandle`-over-sql.js test
      adapter implements the `DbHandle` interface used by `runMigrations`/`ensureColumn`.
- [ ] `npm run test` (touched files), `tsc --noEmit`, and `npm run lint` all exit 0.

### Files the next agent should read first

1. `roadmap/wave-6-sqlite-migration-system-research.md` — current tauri-plugin-sql v2 API surface,
   `PRAGMA user_version` read/set shape, the transaction-less table-rebuild safety pattern, dedupe
   SQL. **The phase briefs are grounded in this — read it before coding.**
2. The `## Locked decisions` section of this wave file — the framework shape and the safety strategy
   are locked there; do not re-litigate them.
3. `src/db/schema.ts` — current `getDb()`, the `SCHEMA_DDL` const being deleted, `ensureColumn`
   (kept), the orphan-scenes `UPDATE` (kept, stays outside migrations), and the `scene_links` DDL.
4. `src/db/sqliteStoryBibleStore.ts` — the only `scene_links` consumer; note `replaceSceneLinks`
   (DELETE-then-INSERT, no `ON CONFLICT`) and `deleteEntity` (deletes by `entity_id AND entity_type`).
5. `src/test/ensureColumn.test.ts` — the established `DbHandle` test-double pattern the new tests and
   the sql.js adapter extend.

### Note to the implementer

This wave builds infrastructure that is *invisible by design* — a correct migration produces no
user-facing change, only the absence of an error. The spirit is "one path for all schema change, safe
to re-run." Resist three temptations: (1) do not edit migration 1's DDL after it ships — it is a
frozen baseline; new schema goes in a NEW migration, or you corrupt existing DBs; (2) do not batch
multiple SQL statements into one `db.execute()` call — tauri-plugin-sql runs one statement per call
and silently drops the rest; (3) do not reach for `better-sqlite3` — the test substrate is `sql.js`
(WASM, no native build). First step: verify the `## Locked decisions` section below is filled in and
read the research sidecar.

Before declaring a phase complete, restate the observation point from the Phases table Observation
column in your own words and describe what you actually observed there. If you could not observe it
directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not
substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but
not sufficient.

## Locked decisions

## Decision 1: Migration framework + transaction-less safety strategy

durable: candidate

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
**Threshold to revisit:** when real user data first exists (~Phase 2), add a pre-migration
`writing.db` → `.bak` copy at the top of `runMigrations`, gated on `user_version < target`.
**Enforcement:** `runMigrations` is the sole schema-change entry point; `getDb()` calls it
unconditionally and the `SCHEMA_DDL` parallel path is deleted (no unversioned schema route remains) —
structural enforcement, no hook. `assertSafeVersion` throws synchronously before interpolation
(convention, enforced by code structure). Backup-threshold note is advisory-only until Phase 2.

> Decision-review cell fired (M-42 P2): produced by `sonnet-architect`, attacked by
> `sonnet-adversarial-reviewer` (`Posture: attack-decision`, BLOCK verdict), adjudicated by the
> orchestrator. The two BLOCKs (test substrate absent; `entity_type` silent-drop) and two FLAGs
> (M1 second-source-of-truth; cheaper-alternative-not-documented) are all addressed in this plan —
> see Decision 2 (sql.js substrate), the migration-3 diagnostic (Phase 3 Notes), the frozen-baseline
> comment (Phase 1 Notes), and the rejected-alternative line above.

## Decision 2: Test substrate = `sql.js` in-memory adapter

**Context:** Migration 3's dedupe/UNIQUE/crash-recovery logic is semantically load-bearing and cannot
be verified by a `vi.fn()` `DbHandle` double (which only captures SQL strings); the project has no
in-process SQLite engine.  **Pick:** Add `sql.js` (SQLite compiled to WASM) as a devDependency plus a
thin `DbHandle`-over-sql.js adapter; framework + migration-3 tests run against it.  **Rationale:**
`sql.js` runs in Vitest's Node env with no native compilation (avoids `better-sqlite3`'s node-gyp/MSVC
build on Windows) and is full SQLite, so PRAGMA `user_version`, `ALTER TABLE RENAME`, and constraint
enforcement all behave like production.  **Enforcement:** advisory-only (test-tooling convention; the
acceptance criteria require the adapter + real-engine tests to exist).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 — framework + sql.js harness | ✓ | ✓ | 6e009c6 | Internal — gates green (vitest 122/122, tsc, eslint); adversarial review FLAG→addressed |
| 2 — fold plaintext_projection (migration 2) | ✓ | ✓ | cb685ad | Internal — gates green (vitest 13/13, tsc, eslint); adversarial review FLAG→addressed |
| 3 — scene_links UNIQUE rebuild (migration 3) | ✓ | ✓ | b4247d0 | Code-verified (vitest 130/130 incl. real-engine dedupe/UNIQUE/crash-recovery, tsc, eslint); panel review 2 FLAG/1 PASS/0 BLOCK → flags addressed. ⚠ LIVE-LAUNCH observation (app vs existing dev DB; Story Bible links persist) NOT yet run — pending Cole |

## Follow-up candidates

<!-- DEFAULT: empty. -->

## Result

<!-- Filled at ship by wrap team. -->

### Mechanical review (joint wrap, run from the wave-5 session)

**Inputs:** Plan `roadmap/wave-6-sqlite-migration-system.md` · Diff `37a9d6b..dac71ed` · Graph healthy · merged to master at `2569146`.

## Mechanical review: FLAG — Check 5: acceptance test not in a pre-impl commit (non-fatal, mitigated)

- Check 1+3 (forward-trace / dead exports): PASS — `runMigrations` called by `getDb()` (schema.ts:54, the real-DB entry point); `MIGRATIONS`/`assertSafeVersion` production-consumed inside `runMigrations` (migrations.ts:239/242); schema.ts refactor removed NO exports (`getDb`/`ensureColumn`/`DbHandle` all intact, no dangling importers).
- Check 2 (plan universals): PASS — idempotent steps (IF [NOT] EXISTS / INSERT OR IGNORE guards), ordered `MIGRATIONS` array, version-bump-after-success, convergence + idempotency both covered by the acceptance test.
- **Check 5 (boundary acceptance test): FLAG (non-fatal).** `src/test/runMigrations.acceptance.test.ts` exists and asserts the right consumer-perspective contract (fresh + pre-seeded-old DB both converge to LATEST; idempotent re-run = 0 execute calls; `assertSafeVersion` guards). BUT its first commit `6e009c6` is the SAME commit as the Phase-1 implementation — the orchestrator-owned-before-dispatch ordering cannot be proven from git. **Adjudication:** non-blocking — the contract assertions are consumer-perspective (not impl mirror) and Phase 3 had an independent 3-seat panel, so the mental-model-divergence risk is mitigated. Resolution: DB session confirms the test was authored before dispatch, OR accept as a commit-hygiene note (future migration waves: land the acceptance test in its own pre-impl commit). Run evidence: combined suite 144/144 (incl. this test), run from the wave-5 session 2026-06-03.
- **Checks N/A: 4 + 6** — no electron-store config schema removal (SQLite app); no `stryker.config`.

**⚠ Still ungated at runtime (the real ship gate):** live-launch migration smoke on Cole's actual on-disk `writing.db` (proven only against in-memory sql.js so far). Back up the DB first.
