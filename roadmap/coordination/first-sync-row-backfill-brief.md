# First-sync row backfill — implementation brief

**Date:** 2026-08-21
**Scope:** device-sync LWW row path (`src/sync/lww/`, `src/sync/lwwDomains/`, shared by desktop and mobile)
**Status:** investigation complete, no code changed. Fix to be implemented by the lead.

---

## Verdict

**Hypothesis CONFIRMED, and it is worse than stated.** First sync does not backfill pre-existing
row-domain data, and there are *two independent* mechanisms that each break it. Fixing only one
leaves the bug alive.

1. **Ledger gap (the operative cause tonight).** The row path advertises from a *shadow ledger*
   (`sync_lww_rows`), not from the feature tables. That ledger is written by exactly two callers —
   a local mutation through `LwwPublisher.publish` and an inbound `row` through
   `LwwReconciler.receiveRow`. It is created empty by migration 022 and has **no seeding pass**.
   Every row that existed before sync went live is therefore invisible to reconciliation. Verified
   against the live desktop DB: the `boards` table holds `brainstorm-default`, and
   `sync_lww_rows` holds **zero** `boards` entries.

2. **Pull gap (structural; would still break device #3 even with a seeded ledger).**
   `LwwReconciler` has no "the peer advertised a row I don't have → get it" branch. Reconciliation
   is *push-only*: each side pushes rows the **other** side's summary omitted. Scope discovery is
   also local-ledger-driven, so a device with an empty ledger announces **no scopes at all** and
   never triggers the peer's push. A summary announcing a row we lack is silently discarded
   (`reconciler.ts:59`).

The Yjs doc path has neither problem because it enumerates the **database itself** on every hello
and treats an unmentioned channel as "send the whole document".

That asymmetry is the entire bug: **docs are reconciled against the source of truth; rows are
reconciled against a change log that was never initialised.**

---

## Evidence

### A. The two paths, side by side

| | Doc path (worked) | Row path (failed) |
|---|---|---|
| Trigger on connect | `engine.ts:240` → `syncNow` → `sendHello` (`engine.ts:146`) | `engine.ts:240` → `syncNow` → `sendAllSummaries` (`engine.ts:147`) |
| What it enumerates | `EngineDocRepository.listAll()` — `engineDocRepository.ts:12-25`, reading `board_docs` / `scene_docs` / `project_meta_docs` / `project_domain_docs` directly (`src/db/sqliteBoardDocStore.ts:10`) | `SyncLwwStore.listScopes()` — `reconciler.ts:20` → `sqliteSyncLwwStore.ts:51-55`, `SELECT DISTINCT domain, project_id FROM sync_lww_rows` |
| Source of truth | the real tables | a change log |
| Answer to a peer that never mentions the item | full state: `epochFrames.ts:52` — `const sendFull = !peerVector || epoch > 0;` (`answerHello` at `engine.ts:315-322`) | nothing: `reconciler.ts:58-59` — `const local = await this.store.get(...); if (!local) return;` |

**Trace of the observed failure (fresh phone, real desktop):**

1. Phone connects, sends `hello` listing its docs. It has no `board:brainstorm-default`.
2. Desktop `answerHello` (`engine.ts:317`) iterates `docs.listAll()`, which includes every
   `board_docs` row. `peerVectors.get("board:brainstorm-default")` is `undefined`, so
   `answerFrame` (`epochFrames.ts:46-58`) sets `sendFull = true` and ships the whole Yjs state.
   **→ the phone gets the board CONTENT.**
3. Desktop `sendAllSummaries` (`reconciler.ts:19-23`) iterates `listScopes()`. The `boards` scope
   is **absent from the ledger**, so no `row-hello` for `boards` is ever sent.
   **→ the phone never hears the board RECORD exists.**
4. Phone's own `sendAllSummaries` returns nothing (empty ledger), so the desktop's
   `receiveSummary` end-of-scope push (`reconciler.ts:49-51`) is never triggered for `boards`
   either.
5. Result: `board_docs` populated, `boards` empty — an orphan document with no listable record.

Even if step 3 had fired (ledger seeded), step 4's counterpart would still fail: the phone's
`reconcileSummary` finds `local === null` and returns without asking for the row
(`reconciler.ts:55-64`). That is the pull gap.

### B. The ledger is created empty and never seeded

- `src/db/migrations3.ts:16-20` — `CREATE TABLE IF NOT EXISTS sync_lww_rows (...)`. No
  `INSERT ... SELECT` seeding pass anywhere in the migration history.
- Only two writers exist:
  - `src/sync/lww/publisher.ts:23-24` — `store.putIfNewer(...)` inside `publish()`, reached only
    from a local write bridge (`lwwDomains/localBridges.ts:5-12`, wired at
    `sqliteBoardsStore.ts:27`, `desktopLwwBridges.ts:50-72`, `mobileEngine.ts:115-120`).
  - `src/sync/lww/reconciler.ts:70-74` — `store.putIfNewer(...)` inside `receiveRow()`.
- `LwwDomainAdapter` (`src/sync/lww/registry.ts:1-6`) exposes `readPayload` / `projectReceived` /
  `applyTombstone` and **no enumeration method** — the engine literally cannot list a domain's
  existing rows today.

### C. Live-DB confirmation (read-only copy of `%APPDATA%\com.coles.writing\writing.db`)

```
sync_lww_rows, grouped:      scene_snapshots | dde12891-…  | 1     <- one row, total
boards table:                brainstorm-default | dde12891-… | Default Board | 0
board_docs:                  brainstorm-default | 552 bytes | 2026-08-21T01:43:14Z
sync_lww_rows WHERE domain='boards':   (no rows)

feature-table counts:        goals 0 | quick_notes 0 | archive 0 | scene_snapshots 10
                             boards 1 | manuscript_about 0 | ai_conversations 4 | ai_messages 16
```

Ten local snapshots; **one** in the ledger — the single snapshot taken *after* sync went live
(`hlc 001787271408883-000000`, i.e. 2026-08-21T00:16:48Z). Nine pre-existing snapshots and the one
board are unrepresented. This is the hypothesis, measured.

### D. Registration is not the problem

`boards` is registered on both sides: `src/sync/lwwDomains/index.ts:26-28` (the shared
`DEFINITIONS` list), installed on desktop at `src/sync/desktopEngine.ts:9-11` and on mobile at
`mobile/src/sync/mobileEngine.ts:47-50` via the same `registerLwwDomains`. Confirmed — the
diagnosis note in the task was right to rule this out.

### E. Why the existing tests missed it

`src/test/sync/liveRelay.integration.test.ts:325-368` ("pushes every LWW domain into the peer SQL
projection without a sweep") calls `registryA.get(domain).projectReceived(...)` **and then fires
the write bridge** (`fireLiveLwwBridge`, line ~249) for each fixture *after* both engines are
connected. Every row it tests is therefore a *published* row with a ledger entry. No test anywhere
starts an engine against a table that already has rows the ledger has never seen.

---

## Affected domains

All seven registered LWW domains are affected identically — a freshly paired device receives
**only** rows mutated after it paired. Everything older is silently missing.

| Domain | `DEFINITIONS` line | What a fresh device is missing | Severity |
|---|---|---|---|
| `boards` | `lwwDomains/index.ts:26` | Every board record. Board *content* still arrives on the `board:*` Yjs channel, so the device holds orphan `board_docs` rows — invisible and unopenable. **This is the observed bug.** | High — orphaned data, user-visible |
| `scene_snapshots` | `:23` | Version history for every scene. Locally: 10 exist, 1 replicable. Snapshots are the app's undo-of-last-resort. | High |
| `archive` | `:18` | The whole archive (deleted scenes/folders with their `state_base64`). A device that only ever sees the archive on one machine will "restore" from an empty list. | High |
| `goals` | `:10` | All writing goals/targets. Progress state is deliberately device-local (`lwwDomains.test.ts:165-181`), but the goal definitions should replicate and don't. | Medium |
| `quick_notes` | `:13` | The entire quick-notes inbox. | Medium |
| `manuscript_about` | `:29` | Synopsis / genre / tone / POV / notes — one row keyed by `project_id`. Also the highest conflict risk (see Risks). | Medium |
| `ai_conversations` | registered conditionally, `index.ts:49` | All prior conversations + messages (locally 4 / 16), when the user has opted in. Gated by the privacy toggle, so it must stay gated in the fix. | Medium |

Not affected: scenes, boards' Yjs content, project meta/structure, and the Bible — all four ride
the doc path, which reconciles against the DB and backfills correctly.

---

## Recommended fix

**Two changes, shipped together. No new message types, no protocol version bump.**

### Change 1 — Seed the ledger from the feature tables (closes the ledger gap)

Before the first connect of every session, compute the set difference between "row ids that exist
in the domain's table" and "row ids the ledger already knows (including tombstones)", and insert a
**seed entry** for each missing one.

- Seed entries carry `deleted = 0`, `payload_json = NULL`, `device_id = <this device>`, and an HLC
  derived from the row's own timestamp column, clamped to `<= now`, counter `0`
  (`hlc.ts:8-14`); domains with no timestamp column (`boards`, `manuscript_about`) seed at
  `physical = 0`.
- **Deriving the stamp from the row's own timestamp is load-bearing.** A seed stamped `Date.now()`
  would outrank a genuine remote tombstone and resurrect deleted rows. A low, real-timestamp seed
  loses to every later edit and to every real deletion, and between two pre-existing devices the
  more-recently-edited row wins — the least surprising rule available.
- **Including tombstones in the "already known" set is equally load-bearing** — otherwise a
  deleted-then-re-seeded row resurrects locally on the next start.
- Set-difference means no completion marker is needed: after the first pass, every id is present
  and the pass is two SELECTs per domain. It also self-heals when `ai_conversations` is toggled on
  later (`index.ts:48-51`).

### Change 2 — Give the reconciler a pull direction (closes the pull gap)

When a peer's `row-hello` advertises a row id we have **no** ledger entry for, answer with our own
`row-hello` for that same scope. The peer's existing end-of-scope push (`reconciler.ts:49-51`)
then sends us every row our summary omitted — which, for a fresh device, is all of them.

- **Reuses an existing v1.3 message.** An older peer receiving an extra `row-hello` handles it as
  it already handles a reconnect summary (`engine.ts:269`), so the wire stays compatible.
- **Terminates in at most two rounds**, and the guard makes it provable: we answer only when we
  saw at least one *unknown* row id, and only once per scope per connection. After the peer's push
  our ledger holds those rows, so the next summary produces no unknowns.
- Because the seed carries `payload_json = NULL`, the push path must **materialise the payload
  lazily** via `adapter.readPayload(rowId)` before sending. This is mandatory, not an
  optimisation: `toRow` (`reconciler.ts:91-96`) would otherwise emit `{deleted:false,
  payload:null}`, which fails `validRowPayload` (`messages.ts:108-112`) and is dropped by the
  receiver as an unrecognised inner message. Materialising through the adapter also guarantees the
  payload's column shape matches what `projectReceived` expects (`sqlDomain.ts:20-28`).

### Protocol version

**Stays at v1.3.** Both changes are behavioural; no new inner-message type, no new field, no new
channel. Per the spec's own compatibility rule
(`docs/superpowers/specs/2026-08-06-sync-protocol-v1.md:129-136`), capabilities are advisory only
and never gate handling of known frames, so no capability string is needed either. Update the
spec's v1.3 "Row LWW messages" paragraph — currently *"On reconnect, each side sends rows absent
from the peer summary or newer than its advertised version"* — to state the missing half: *a
summary advertising rows the receiver does not know is answered with the receiver's own summary
for that scope*, and that the durable version summary is seeded from the feature tables rather
than accumulated only from mutations.

**Compatibility caveat to plan around:** a new phone paired to an **old** desktop still misses
pre-existing rows, because the old desktop never seeds its ledger and so never announces the
scope. The reconciler fix alone buys nothing there. Both halves must ship in the same release, and
the desktop is the side that must be upgraded first for an existing user to be repaired.

### Rejected alternatives

**Full row-domain snapshot exchange on first hello.** Rejected. Unbounded message size — `archive`
and `scene_snapshots` rows each carry a base64 Yjs state, so a real library is megabytes in one
frame. It also duplicates what `row-hello`'s 512-row paging (`messages.ts:1`,
`reconciler.ts:25-37`) already does correctly, needs a new message type (v1.4), and has to be
repeated in full on every pairing because it carries no version information.

**Per-domain version/vector comparison analogous to the Yjs state vector.** Rejected. A Yjs state
vector works because a Yjs doc is one causally-ordered structure; LWW rows are *independent*
per-row versions with no shared causal frame. A per-domain vector could tell you *that* two
devices diverge but never *which rows*, forcing a full re-send on any difference — strictly worse
than the per-row summary that already exists. It also needs new wire schema (v1.4) for less
precision.

**One-shot backfill enqueued into the outbox on first successful pairing.** Rejected as the sole
fix, though it is the closest runner-up. Three problems: (a) it is one-shot, so device #3 is
broken again; (b) outbox entries clear on `row-ack` (`engine.ts:275`, `outbox.ts:29-33`), so once
the first peer acknowledges, the data is gone from the queue and unavailable to the next peer;
(c) it leaves the structural pull gap in place, so any future divergence where one side lacks a
row the other has stays unrepairable. Seeding the durable ledger instead makes the data
*permanently* announceable to any peer, which is what the design already intends.

**Enumerating `registered domains x known project ids` in `sendAllSummaries` instead of adding a
pull.** Tempting and nearly free, but broken in exactly the case that matters: a freshly paired
phone knows no project ids yet (its meta doc has not arrived), so it can build no scope list on
the first connect and would self-heal only on a later reconnect. The answer-summary approach needs
no project ids at all — the peer's summary names the scope. Worth keeping as belt-and-braces
later; not the fix.

---

## Change seams

### New behaviour

| File | Change |
|---|---|
| `src/sync/lww/registry.ts` (interface at `:1-6`) | Add `listSeedRows(): Promise<Array<{ rowId: string; projectId: string \| null; stampMs: number }>>` to `LwwDomainAdapter`. This is the missing enumeration capability. |
| `src/sync/lwwDomains/sqlDomain.ts` (`SqlDomainDefinition` at `:4-9`, `createSqlDomainAdapter` at `:30-56`) | Add optional `projectColumn?: string`, `stampColumn?: string`, and `seedSql?: string` to the definition; implement `listSeedRows` as a `SELECT <key>, <projectColumn>, <stampColumn> FROM <table>`. Keep the existing `?` placeholder style — it is what both `tauri-plugin-sql` and expo-sqlite accept on this path. |
| `src/sync/lwwDomains/index.ts` (`DEFINITIONS` at `:9-32`) | Annotate each definition. `goals`→`project_id`/`updated_at`; `quick_notes`→`project_id`/`updated_at`; `archive`→`project_id`/`archived_at`; `boards`→`project_id`/none; `manuscript_about`→`project_id` (= key)/none; `scene_snapshots`→ needs `seedSql` (`SELECT s.id, sc.project_id, s.created_at FROM scene_snapshots s LEFT JOIN scenes sc ON sc.id = s.scene_id`) because the table has no `project_id` column — this must reproduce exactly the join `desktopLwwBridges.ts:74-79` uses, or seeded and published rows land in different scopes. |
| `src/sync/lwwDomains/aiConversations.ts` (adapter at `:43-60`) | Implement `listSeedRows` as the union of `ai_conversations` (prefix `conversation:`, `updated_at`) and `ai_messages` (prefix `message:`, `created_at`, project via join to the parent conversation), matching `splitRowId` at `:10-16`. |
| **NEW** `src/sync/lww/backfill.ts` | `seedLwwLedger({ store, registry, deviceId })`: for each registered domain, `listSeedRows()` minus `store.listRowIds(domain)`, then `store.putIfNewer({ ..., hlc: encodeHlc({ physical: min(stampMs, Date.now()), counter: 0 }), deviceId, deleted: false, payloadJson: null, updatedAt: null })`. Skip a `manuscript_about` row whose non-key columns are all null/empty (see Risks). |
| `src/db/syncLwwStore.ts` (`SyncLwwStore` at `:6-11`) | Add `listRowIds(domain: string): Promise<Set<string>>` — **must include tombstones**: `SELECT row_id FROM sync_lww_rows WHERE domain = ?`, no `deleted` filter. |
| `src/db/sqliteSyncLwwStore.ts` | Implement `listRowIds`. |
| `mobile/src/db/syncStores/mobileSyncLwwStore.ts` | Implement `listRowIds` (same SQL). |
| `src/sync/engineSession.ts` (`prepareSession` at `:12-33`) | Call `seedLwwLedger` after `deviceId` resolves (`:22-24`) and before returning. This is the natural seam — it sits beside the existing `ensureProjectMetas` / `ensureProjectBibles` "make local state sync-ready before connecting" hooks (`:16-19`), and because both platforms compose the same engine, mobile gets it for free. |
| `src/sync/lww/reconciler.ts` — `reconcileSummary` (`:55-64`) | Replace the bare `if (!local) return;` at `:59` with: record the scope in a per-connection `needsAnswer` set, then return. |
| `src/sync/lww/reconciler.ts` — `receiveSummary` (`:39-53`) | After the final page of a scope (`!hasContinuation`), if the scope is in `needsAnswer` and not in `answeredScopes`, add it to `answeredScopes` and `await this.sendSummary(domain, project)`. Order matters: do this **after** the existing end-of-scope push so a partially-populated peer still gets our extra rows in the same round. |
| `src/sync/lww/reconciler.ts` — `toRow` (`:91-96`) and its two call sites (`:50`, `:61`) | When `payloadJson === null && !deleted`, materialise via `this.registry.get(domain).readPayload(rowId)`. If it is still null (the row vanished from the table), skip the send and drop the stale seed entry rather than emitting an invalid frame. |
| `src/sync/lww/reconciler.ts` — `peerRows` (`:11`) | Add `reset()` clearing `peerRows` and `answeredScopes`. |
| `src/sync/engine.ts` — `onConnection` (`:236-245`) and `stop()` (`:124-137`) | Call `this.lww?.reset()` when the state leaves `connected`. **This also fixes a pre-existing latent bug:** a disconnect part-way through a paged summary leaves a stale `seen` set in `peerRows` (cleared only on the happy path at `:52`), which on the next scope would suppress legitimate pushes. |

### Deliberately untouched

- No new migration. The seed is a runtime set-difference, which sidesteps the documented trap that
  appending a migration breaks the prior migration tests (hardcoded LATEST + partial seed
  fixtures) — `src/test/migration022.syncProtocolV13.test.ts` stays green as-is.
- No change to `src/sync/messages.ts` — no new message type or field.
- No change under `mobile/src/sync/` — `mobileEngine.ts:47-50, 69-71` already composes the shared
  engine, registry and store. Verify only.
- Nothing in `src/editor/` (additive-only ruling, `decisions/0008-…`).

---

## Test plan

### Existing tests covering these seams

| Test | Covers | Expected impact |
|---|---|---|
| `src/test/sync/lwwStore.test.ts:14-40` | `putIfNewer` tombstone + concurrent-write convergence | Must stay green; the seed relies on this comparator |
| `src/test/sync/lwwDomains.test.ts:85-200` | round-trip, convergence, no-resurrect, domain payload boundaries, large archive manifest | Must stay green |
| `src/test/sync/lwwReplication.test.ts:14` | test-registered domain, shadow ownership before projection | Extend, see below |
| `src/test/sync/outbox.test.ts:8-45` | coalescing, semantic ack, flush order | Must stay green |
| `src/test/sync/liveRelay.integration.test.ts:325-368` | all seven domains over a live relay — **but only for published rows** | Keep, and add the counterpart below |
| `src/test/migration022.syncProtocolV13.test.ts` | `sync_lww_rows` schema | Untouched |
| `src/test/sync/engine.test.ts`, `desktopPeer.gate.test.ts` | engine wiring, peer gating | Regression only |

### New tests required

1. **`src/test/sync/lwwBackfill.test.ts` (new).** Against a sql.js DB (`src/test/support/sqljsDb`)
   with migrations run and feature tables populated directly:
   - seeds a ledger entry for every pre-existing row across all seven domains, with the right
     `project_id` (including `scene_snapshots` via the `scenes` join);
   - **does not** re-seed a row id that already has a tombstone (`deleted = 1`) — the
     resurrection guard;
   - is idempotent: a second run performs no writes and produces an identical ledger;
   - seeds a stamp that **loses** to a subsequent `LwwPublisher.publish` of the same row and to an
     inbound `row` with a real HLC;
   - skips an all-empty `manuscript_about` row.
2. **`src/test/sync/lwwPullReconcile.test.ts` (new).** Two `LwwReconciler`s over an in-memory
   message pipe, A's ledger seeded and B's empty:
   - B answers A's `row-hello` with its own summary for that scope;
   - A then pushes the full `row`, B projects it into the feature table;
   - B answers **exactly once** per scope — assert the total frame count, so a regression into
     ping-pong fails loudly;
   - a seed entry with `payload_json = NULL` is materialised through the adapter and the emitted
     frame passes `isRowMessage` (`messages.ts:87-93`);
   - `reset()` clears `peerRows`, and a scope truncated mid-page is re-pushed after a reconnect.
3. **`src/test/sync/liveRelay.integration.test.ts` — new case: "backfills pre-existing row-domain
   data to a freshly paired peer".** This is the missing oracle and the one that would have caught
   tonight's bug. Shape it as the mirror of the existing LWW case at `:325`:
   - build `dbA`/`dbB` via `makeSqlJsDb()` + `runMigrations`, `seedLwwParents(dbA)`;
   - **INSERT directly into `dbA`'s `boards`, `scene_snapshots` and `goals`** — no bridge, no
     `publishRow`, mirroring a user whose data predates sync;
   - `registerLwwDomains` on both, `makeEngine` both with `sweepMs: 60_000` so the assertion
     cannot be satisfied by a sweep;
   - start both, wait for `connected`, then assert `dbB` gains the `boards` row
     `brainstorm-default` (and the snapshots/goals) **without any `publishRow` call**, within the
     existing 10s no-sweep budget;
   - assert `board_docs` and `boards` both land, i.e. the exact orphan condition is gone.
4. **Regression sweep.** Full `src/test/sync/` plus the migration suite (per CLAUDE.md, the
   migration tests are order-sensitive), `npm run lint` and `npx tsc --noEmit` on touched files.
5. **Runtime oracle.** Green tests are not a working app here. Re-pair a wiped Android build
   against the real desktop and confirm the Default Board appears in the binder and opens. The
   nine pre-existing snapshots and the archive should arrive in the same pass.

---

## Risks

1. **Resurrecting remotely-deleted rows — the highest risk in this change.** Two ways to cause it:
   stamping seeds at `Date.now()` (which outranks a genuine tombstone's HLC), or building the
   "already known" set with a `deleted = 0` filter (which re-seeds a tombstoned id as live). Both
   would silently un-delete a user's deleted boards, notes and archive entries across every paired
   device, and LWW would then propagate the resurrection as the winning version. The mitigations —
   timestamp-derived low seed stamps, and tombstone-inclusive set difference — must both be
   present, and test 1 must assert both.
2. **Whole-row overwrite when both devices have pre-existing rows with the same id.** LWW here is
   row-granular, not field-granular: `sqlDomain.ts:46-51` does
   `ON CONFLICT(<key>) DO UPDATE SET <every column>`, and `putIfNewer`
   (`sqliteSyncLwwStore.ts:32-34`) picks the winner by `(hlc, device_id)` — `compareVersion`,
   `hlc.ts:27-31`. The comparator handles the tie deterministically, but the *losing row's content
   is discarded wholesale*. `manuscript_about` is the acute case: one row per project keyed on
   `project_id`, no timestamp column, so its seed falls back to `physical = 0` and the winner is
   decided by lexicographic device id — effectively a coin flip that can silently erase one
   device's entire About page (synopsis, genre, tone, POV, notes). Mitigate by skipping all-empty
   rows in the seed; the durable fix is to add an `updated_at` column to `manuscript_about` so the
   seed can be timestamp-ordered like the others. Flag this as a follow-up rather than smuggling a
   migration into this change.
3. **Push volume at pairing.** `receiveSummary`'s end-of-scope push (`reconciler.ts:49-51`) lists
   with `Number.MAX_SAFE_INTEGER` — no limit — and `archive` and `scene_snapshots` rows each carry
   a base64 Yjs state. A user with a large history could emit thousands of frames and many
   megabytes in one burst the moment a phone pairs. Per-frame size stays bounded (one row per
   message), so this is a throughput and battery concern rather than a correctness one, but the
   push should be paced or capped per connection, and the queue-depth UI (`outbox.ts:51-55` →
   `statusEmitter`) should reflect it so pairing does not look frozen.
4. **Frame amplification if the answer guard is wrong.** Answering a summary with a summary is safe
   only while the answer is conditional on "I saw an unknown row" **and** deduplicated per scope
   per connection. Drop either condition and two devices trade `row-hello` frames indefinitely.
   Test 2's frame-count assertion is the guard against a future refactor losing this.
5. **Lazy payload materialisation sends current content under an old stamp.** A seed row's payload
   is read at send time, so the frame advertises the seed HLC while carrying the row's *present*
   contents. If the peer holds an edit whose HLC falls between the seed stamp and now, the peer
   wins and our content is discarded — correct by LWW, but it means the seed is a version *floor*,
   not an accurate history. Acceptable, and strictly better than the status quo of sending
   nothing; worth a comment at the call site so it is not "fixed" into always-materialise later.
6. **Mixed-version device pairs.** No wire change, so an already-paired v0.12.6 desktop keeps
   working — but it will not seed its ledger, so a phone on the new build paired to it still misses
   pre-existing rows. This is a "no worse than today" outcome, not a regression, but it means the
   fix is only real once the desktop side ships. Do not ship the mobile half alone.
7. **Pre-existing `peerRows` leak (fixed in passing).** `peerRows` (`reconciler.ts:11`) is deleted
   only on the happy path (`:52`); a disconnect during a paged summary leaves a stale `seen` set
   that suppresses legitimate pushes on the next attempt. `reset()` on disconnect closes it. Worth
   naming in the commit message, since it is a real bug being fixed alongside the main one rather
   than incidental refactoring.
8. **Mid-backfill disconnect.** Structurally safe: the seed is a local durable write independent of
   the connection, and the push rides the existing `row` / `row-ack` / outbox machinery that
   already replays on every reconnect (`engine.ts:145-147`). The only thing that must be reset on
   disconnect is the reconciler's per-connection state (risk 7), or a resumed scope will be
   skipped.
