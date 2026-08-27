import * as Y from "yjs";

import { getOrCreateDeviceId } from "../../db/deviceId";
import type { LabelColor } from "../../db/labelStore";
import { getDb } from "../../db/schema";
import { SqliteProjectMetaDocStore } from "../../db/sqliteProjectMetaDocStore";
import { normalizeStatus } from "../../lib/status";
import { applyEncoded, encodeDoc } from "../../yjs/serialize";
import { exclusiveMetaDoc } from "../exclusiveLock";
import {
  buildFromSql, bumpEpoch, type EpochStamp, getDocEpochs, type SqlMetaRows,
} from "./metaDoc";

const store = new SqliteProjectMetaDocStore();
const saveListeners = new Set<(projectId: string, epochs: Record<string, EpochStamp>) => void>();

export function subscribeProjectMetaSaves(
  listener: (projectId: string, epochs: Record<string, EpochStamp>) => void
): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

async function persistProjectMeta(
  projectId: string, mutate: (meta: Y.Doc) => void,
): Promise<void> {
  const encoded = await store.load(projectId);
  if (encoded === null) return;
  const doc = new Y.Doc();
  applyEncoded(doc, encoded);
  doc.transact(() => mutate(doc));
  await store.save(projectId, encodeDoc(doc));
  const epochs = getDocEpochs(doc);
  saveListeners.forEach((listener) => listener(projectId, epochs));
}

/** Mutate an existing project meta doc. Projects without a bootstrapped row stay inert. */
export function withProjectMeta(
  projectId: string,
  mutate: (meta: Y.Doc) => void
): Promise<void> {
  return exclusiveMetaDoc(projectId, () => persistProjectMeta(projectId, mutate));
}

/** SQL write + CRDT persist under the same tail inbound merge uses. */
export function runLocalMetaWrite<T>(
  projectId: string,
  sqlWrite: () => Promise<T>,
  mutate: (meta: Y.Doc, result: T) => void,
): Promise<T> {
  return exclusiveMetaDoc(projectId, async () => {
    const result = await sqlWrite();
    await persistProjectMeta(projectId, (doc) => mutate(doc, result));
    return result;
  });
}

export async function bumpProjectSceneEpoch(projectId: string, sceneId: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await withProjectMeta(projectId, (doc) => { bumpEpoch(doc, sceneId, deviceId); });
}

async function loadSqlRows(projectId: string): Promise<SqlMetaRows> {
  const db = await getDb();
  const projects = await db.select<Array<{ id: string; title: string; type: string }>>(
    "SELECT id, title, type FROM projects WHERE id = $1", [projectId]
  );
  const folders = await db.select<SqlMetaRows["folders"]>(
    "SELECT id, project_id, title, sort_order FROM folders WHERE project_id = $1",
    [projectId]
  );
  const rawScenes = await db.select<Array<Omit<SqlMetaRows["scenes"][number], "status"> & {
    status: string;
  }>>(
    `SELECT id, project_id, folder_id, title, synopsis, status, sort_order
     FROM scenes WHERE project_id = $1`,
    [projectId]
  );
  const rawLabels = await db.select<Array<Omit<SqlMetaRows["labels"][number], "color"> & {
    color: string;
  }>>(
    "SELECT id, project_id, name, color, sort FROM labels WHERE project_id = $1",
    [projectId]
  );
  const sceneLabels = await db.select<SqlMetaRows["sceneLabels"]>(
    `SELECT sl.scene_id, sl.label_id FROM scene_labels sl
     INNER JOIN scenes s ON s.id = sl.scene_id WHERE s.project_id = $1`,
    [projectId]
  );
  return {
    project: projects[0],
    folders,
    scenes: rawScenes.map((row) => ({ ...row, status: normalizeStatus(row.status) })),
    labels: rawLabels.map((row) => ({ ...row, color: row.color as LabelColor })),
    sceneLabels,
  };
}

/**
 * Create one project's meta doc from its current SQLite projection.
 *
 * Idempotent: returns early if a doc already exists (mirrors
 * bootstrapProjectBible). Doc existence — not device role — is the
 * discriminator: a doc received via sync already exists (the apply target
 * creates the `projects` row FROM the doc), so "no doc" reliably means "born
 * locally, never bootstrapped." Overwriting an existing doc from SQL would
 * erase its tombstones and reset its epochs/clientIDs, so this must never
 * run against a project that already has one.
 */
export function bootstrapProjectMeta(projectId: string): Promise<void> {
  return exclusiveMetaDoc(projectId, async () => {
    if (await store.load(projectId) !== null) return;
    const doc = buildFromSql(await loadSqlRows(projectId));
    await store.save(projectId, encodeDoc(doc));
    const epochs = getDocEpochs(doc);
    saveListeners.forEach((listener) => listener(projectId, epochs));
  });
}

/**
 * Backfill meta docs for every local project that doesn't have one yet.
 * Safe on any device role — the doc-existence guard in bootstrapProjectMeta
 * means this never touches a project that already has a doc, whether that
 * doc was bootstrapped locally or received via sync. Run at sync-engine
 * startup; this also rescues projects that were created on a joined device
 * before creation-time bootstrapping existed (SqliteBinderStore.createProject).
 */
export async function ensureAllProjectMetas(): Promise<void> {
  const db = await getDb();
  const [projects, existing] = await Promise.all([
    db.select<Array<{ id: string }>>("SELECT id FROM projects"), store.listAll(),
  ]);
  const existingIds = new Set(existing.map(({ id }) => id));
  await Promise.all(projects.filter(({ id }) => !existingIds.has(id))
    .map(({ id }) => bootstrapProjectMeta(id)));
}

/** Cheap existence lookup used by project sync badges. */
export async function hasProjectMeta(projectId: string): Promise<boolean> {
  return (await store.load(projectId)) !== null;
}
