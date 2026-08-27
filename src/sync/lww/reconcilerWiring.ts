import type { SyncLwwStore } from "../../db/syncLwwStore";
import type { InnerMessage } from "../messages";
import type { DurableOutbox } from "../outbox";
import { DisplacedRowKeeper } from "./displacedRows";
import type { LocalRowMutation } from "./publisher";
import { LwwReconciler } from "./reconciler";
import type { LwwDomainRegistry } from "./registry";

export interface RowReconcilerDeps {
  store?: SyncLwwStore;
  registry: LwwDomainRegistry;
  send: (message: InnerMessage) => Promise<void>;
  /** Read late — the outbox is built alongside the reconciler, and a stopped
   *  engine has none. */
  outbox: () => DurableOutbox | null;
  observe: (hlc: string) => void | Promise<void>;
  publish: (mutation: LocalRowMutation) => Promise<boolean>;
  thisDevice?: () => string;
}

/**
 * Assembles the row reconciler and its callbacks. Lives here rather than in
 * SyncEngine's constructor, which is at the 40-line ceiling; the wiring is also
 * the only place the displaced-row policy is applied, so it reads better next
 * to it than buried among the engine's other collaborators.
 */
export function buildRowReconciler(deps: RowReconcilerDeps): LwwReconciler | null {
  if (!deps.store) return null;
  const keeper = new DisplacedRowKeeper({
    registry: deps.registry, publish: deps.publish,
    newId: () => crypto.randomUUID(), now: () => Date.now(),
  });
  return new LwwReconciler(deps.store, deps.registry, deps.send, {
    onConverged: (domain, rowId) =>
      deps.outbox()?.acknowledgeItem(domain, rowId) ?? Promise.resolve(),
    onObserved: deps.observe,
    onDisplaced: (row) => keeper.keep(row).then(() => undefined),
    hasPending: (domain, rowId) =>
      deps.outbox()?.hasPending(domain, rowId) ?? Promise.resolve(false),
    thisDevice: deps.thisDevice,
  });
}
