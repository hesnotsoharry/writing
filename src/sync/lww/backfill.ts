import type { SyncLwwStore } from "../../db/syncLwwStore";
import { encodeHlc } from "./hlc";
import type { LwwDomainAdapter, LwwSeedRow } from "./registry";
import type { LwwDomainRegistry } from "./registry";

export interface SeedLwwLedgerOptions {
  store: SyncLwwStore;
  registry: LwwDomainRegistry;
  deviceId: string;
  now?: () => number;
}

/**
 * The stamp a seeded row is announced under.
 *
 * Derived from the row's own timestamp and clamped to `now`, never taken from
 * the clock. This is the single most important line in the file: a seed
 * stamped "now" would outrank a genuine remote tombstone, and LWW would then
 * propagate the resurrection of every board, note and archive entry the user
 * has ever deleted as the winning version. A low, real stamp loses to every
 * later edit and to every real deletion, and between two devices that both
 * predate sync the more-recently-touched row wins — the least surprising rule
 * available without inventing history.
 *
 * Counter 0 for the same reason: it is the lowest value at that instant.
 */
function seedHlc(stampMs: number, nowMs: number): string {
  const physical = Math.min(Math.max(0, Math.floor(stampMs)), nowMs);
  return encodeHlc({ physical, counter: 0 });
}

async function seedDomain(
  adapter: LwwDomainAdapter, options: SeedLwwLedgerOptions, nowMs: number,
): Promise<number> {
  const { store, deviceId } = options;
  const [seeds, known] = await Promise.all([
    adapter.listSeedRows?.() ?? Promise.resolve<LwwSeedRow[]>([]),
    store.listRowIds(adapter.domain),
  ]);
  let seeded = 0;
  for (const seed of seeds) {
    // `known` carries tombstones, so a deleted row is never re-seeded as live.
    if (known.has(seed.rowId)) continue;
    const accepted = await store.putIfNewer({
      domain: adapter.domain, projectId: seed.projectId, rowId: seed.rowId,
      hlc: seedHlc(seed.stampMs, nowMs), deviceId, deleted: false,
      // Left null on purpose — the reconciler materialises the payload through
      // the adapter at send time, so the ledger never holds a stale copy of a
      // row the user is still editing.
      payloadJson: null, updatedAt: null,
    });
    if (accepted) seeded += 1;
  }
  return seeded;
}

/**
 * Makes rows that predate sync announceable.
 *
 * The row path advertises from `sync_lww_rows`, which migration 022 creates
 * empty and only local mutations and inbound rows ever write. Anything written
 * before sync was switched on therefore has no ledger entry, is named in no
 * summary, and reaches no newly paired device — while the same device's Yjs
 * documents arrive fine, because the doc path enumerates the database itself.
 * That asymmetry is what left a phone holding board *content* with no board
 * *record* to list or open.
 *
 * This closes it by enumerating each domain's own table and inserting the
 * difference. It is a set difference rather than a one-shot migration, so it
 * is idempotent, needs no completion marker, costs two queries per domain once
 * warm, and self-heals when a domain is registered later (`ai_conversations`
 * is registered only once the privacy toggle is on).
 */
export async function seedLwwLedger(options: SeedLwwLedgerOptions): Promise<number> {
  const nowMs = (options.now ?? Date.now)();
  let seeded = 0;
  for (const name of options.registry.names()) {
    const adapter = options.registry.get(name);
    if (!adapter?.listSeedRows) continue;
    seeded += await seedDomain(adapter, options, nowMs);
  }
  return seeded;
}

/**
 * The engine's seam: seed before the first connect, and never let it stop sync.
 *
 * It must run before the provider connects, because the very first summary is
 * built from the ledger. A failure is logged rather than thrown — an unseeded
 * ledger is exactly the status quo, and refusing to sync at all over it would
 * be strictly worse than syncing without the backfill.
 *
 * No registry means no adapters, which means no row can be summarised, sent or
 * projected anyway; there is nothing to seed for.
 */
export async function seedLwwLedgerForSession(
  store: SyncLwwStore | undefined,
  registry: LwwDomainRegistry | undefined,
  deviceId: string,
): Promise<void> {
  if (!store || !registry) return;
  try {
    await seedLwwLedger({ store, registry, deviceId });
  } catch (error) {
    console.error("[sync-lww] seeding the row ledger failed", error);
  }
}
