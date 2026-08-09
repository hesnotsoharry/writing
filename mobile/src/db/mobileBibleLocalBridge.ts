import { applyBibleSqlDelta, type SqlBibleRows } from "../../../src/sync/bible/bibleDoc";
import { BibleLocalBridge } from "../../../src/sync/bible/bibleLocalBridge";
import { loadBibleProjection } from "../../../src/sync/bible/dbBibleApplyTarget";
import type { DbClient } from "../shared/dbClient";
import { getMobileDb } from "./database";
import { MobileProjectDomainDocStore } from "./syncStores/mobileProjectDomainDocStore";

type Listener = (projectId: string, stateBase64: string) => void;
const deferredDb: DbClient = {
  async select<T>(sql: string, params?: unknown[]): Promise<T> {
    return (await getMobileDb()).select<T>(sql, params);
  },
  async execute(sql: string, params?: unknown[]) {
    return (await getMobileDb()).execute(sql, params);
  },
};
const store = new MobileProjectDomainDocStore(deferredDb);
const mobileBridge = new BibleLocalBridge(store);

/** Explicit local boundary: remote mobile projection never calls this, preventing ping-pong. */
export function bridgeMobileBibleLocalWrite<T>(
  projectId: string, db: DbClient, sqlWrite: () => Promise<T>,
  bridge: BibleLocalBridge = mobileBridge,
): Promise<T> {
  let before: SqlBibleRows;
  return bridge.mutate(projectId, async () => {
    before = await loadBibleProjection(db, projectId); return sqlWrite();
  }, async (doc) => {
    applyBibleSqlDelta(doc, before, await loadBibleProjection(db, projectId));
  });
}

/** Supplies full encoded content for immediate engine delivery, never merely a state vector. */
export function subscribeMobileBibleSaves(listener: Listener): () => void {
  return mobileBridge.subscribe(listener);
}
