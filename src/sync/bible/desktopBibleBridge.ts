import { fromUint8Array } from "js-base64";
import * as Y from "yjs";

import { getDb } from "../../db/schema";
import { SqliteProjectDomainDocStore } from "../../db/sqliteProjectDomainDocStore";
import { getSyncRole } from "../syncRole";
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

export async function bootstrapProjectBible(projectId: string): Promise<void> {
  const store = new SqliteProjectDomainDocStore();
  if (await store.load("bible", projectId)) return;
  const doc = buildBibleFromSql(await loadBibleProjection(await getDb(), projectId));
  await store.save("bible", projectId, fromUint8Array(Y.encodeStateAsUpdate(doc)));
}

/** Bootstrap only the origin's local projects; joined devices learn docs from their peer. */
export async function ensureAllProjectBibles(): Promise<void> {
  if (await getSyncRole() === "joined") return;
  const db = await getDb();
  const projects = await db.select<Array<{ id: string }>>("SELECT id FROM projects");
  await Promise.all(projects.map(({ id }) => bootstrapProjectBible(id)));
}
