import { fromUint8Array } from "js-base64";
import * as Y from "yjs";

import { applyBibleSqlDelta, buildBibleFromSql, type SqlBibleRows } from "../../../src/sync/bible/bibleDoc";
import { BibleLocalBridge } from "../../../src/sync/bible/bibleLocalBridge";
import { loadBibleProjection } from "../../../src/sync/bible/dbBibleApplyTarget";
import { exclusiveDomainDoc } from "../../../src/sync/exclusiveLock";
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

/**
 * Create an empty bible doc for a newly created project, mirroring
 * bootstrapMobileProjectMeta. Idempotent: returns early if a doc already
 * exists — same doc-existence discriminator as desktop's
 * bootstrapProjectBible (a doc received via sync always exists already).
 * Notifies subscribers so the engine advertises the doc immediately.
 */
export async function bootstrapMobileProjectBible(projectId: string): Promise<void> {
  let stateBase64: string | null = null;
  await exclusiveDomainDoc("bible", projectId, async () => {
    if (await store.load("bible", projectId) !== null) return;
    const doc = buildBibleFromSql({
      entities: [], entityTypes: [], fields: [], sceneLinks: [], entityLinks: [], relations: [],
    });
    stateBase64 = fromUint8Array(Y.encodeStateAsUpdate(doc));
    await store.save("bible", projectId, stateBase64);
  });
  if (stateBase64) mobileBridge.notify(projectId, stateBase64);
}

/**
 * Backfill bible docs for every local project that doesn't have one yet.
 * Safe on any device role — bootstrapMobileProjectBible's doc-existence
 * guard means this never touches a project that already has a doc. Rescues
 * bibles stranded on mobile before bootstrap-at-creation existed.
 */
export async function ensureAllMobileProjectBibles(): Promise<void> {
  const db = await getMobileDb();
  const projects = await db.select<Array<{ id: string }>>("SELECT id FROM projects");
  await Promise.all(projects.map(({ id }) => bootstrapMobileProjectBible(id)));
}
