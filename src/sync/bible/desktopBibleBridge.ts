import { fromUint8Array } from "js-base64";
import * as Y from "yjs";

import { getDb } from "../../db/schema";
import { SqliteProjectDomainDocStore } from "../../db/sqliteProjectDomainDocStore";
import { exclusiveDomainDoc } from "../exclusiveLock";
import { buildBibleFromSql } from "./bibleDoc";
import type { BibleContentListener, BibleLocalWriteDependencies } from "./bibleLocalBridge";
import { BibleLocalBridge, bridgeBibleLocalWriteWith } from "./bibleLocalBridge";
import { loadBibleProjection } from "./dbBibleApplyTarget";

/**
 * The desktop half of the Bible local bridge.
 *
 * These wrappers reach the Tauri SQL singleton (`db/schema`), so they live here
 * rather than beside the portable `BibleLocalBridge`. React Native imports that
 * class through the `@writersnook/*` boundary; when these functions shared its
 * module, the single `db/schema` import made the entire mobile bundle
 * unresolvable — and every gate stayed green, because TypeScript, vitest and
 * eslint all resolve the import fine. Only bundling for a device caught it.
 *
 * Keep the split: anything that needs `getDb()` belongs in this file.
 */
const desktopBridge = new BibleLocalBridge(new SqliteProjectDomainDocStore());

export function subscribeBibleSaves(listener: BibleContentListener): () => void {
  return desktopBridge.subscribe(listener);
}

export async function bridgeBibleLocalWrite<T>(
  projectId: string, sqlWrite: () => Promise<T>, dependencies?: BibleLocalWriteDependencies,
): Promise<T> {
  return bridgeBibleLocalWriteWith(projectId, sqlWrite, dependencies ?? {
    bridge: desktopBridge,
    db: await getDb(),
  });
}

/**
 * Create one project's bible doc from its current SQLite projection.
 *
 * Idempotent: returns early if a doc already exists. Doc existence — not
 * device role — is the discriminator: a doc received via sync already
 * exists, so "no doc" reliably means "born locally, never bootstrapped."
 * Notifies the engine's save-listener seam so a freshly bootstrapped doc is
 * advertised immediately, same as a normal local write.
 */
export async function bootstrapProjectBible(projectId: string): Promise<void> {
  const store = new SqliteProjectDomainDocStore();
  let stateBase64: string | null = null;
  await exclusiveDomainDoc("bible", projectId, async () => {
    if (await store.load("bible", projectId)) return;
    const doc = buildBibleFromSql(await loadBibleProjection(await getDb(), projectId));
    stateBase64 = fromUint8Array(Y.encodeStateAsUpdate(doc));
    await store.save("bible", projectId, stateBase64);
  });
  if (stateBase64) desktopBridge.notify(projectId, stateBase64);
}

/**
 * Backfill bible docs for every local project that doesn't have one yet.
 * Safe on any device role — bootstrapProjectBible's doc-existence guard
 * means this never touches a project that already has a doc. Run at
 * sync-engine startup; this also rescues bibles stranded on a joined device
 * before creation-time bootstrapping existed (SqliteBinderStore.createProject).
 */
export async function ensureAllProjectBibles(): Promise<void> {
  const db = await getDb();
  const projects = await db.select<Array<{ id: string }>>("SELECT id FROM projects");
  await Promise.all(projects.map(({ id }) => bootstrapProjectBible(id)));
}
