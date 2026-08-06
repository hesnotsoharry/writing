import * as Y from "yjs";

import type { LabelColor } from "../../db/labelStore";
import { getDb } from "../../db/schema";
import { SqliteProjectMetaDocStore } from "../../db/sqliteProjectMetaDocStore";
import { normalizeStatus } from "../../lib/status";
import { applyEncoded, encodeDoc } from "../../yjs/serialize";
import { buildFromSql, type SqlMetaRows } from "./metaDoc";

const store = new SqliteProjectMetaDocStore();
const projectTails = new Map<string, Promise<void>>();

function runExclusive(projectId: string, operation: () => Promise<void>): Promise<void> {
  const prior = projectTails.get(projectId) ?? Promise.resolve();
  const current = prior.catch(() => undefined).then(operation);
  projectTails.set(projectId, current);
  const clear = (): void => {
    if (projectTails.get(projectId) === current) projectTails.delete(projectId);
  };
  void current.then(clear, clear);
  return current;
}

/** Mutate an existing project meta doc. Projects without a bootstrapped row stay inert. */
export function withProjectMeta(
  projectId: string,
  mutate: (meta: Y.Doc) => void
): Promise<void> {
  return runExclusive(projectId, async () => {
    const encoded = await store.load(projectId);
    if (encoded === null) return;
    const doc = new Y.Doc();
    applyEncoded(doc, encoded);
    doc.transact(() => mutate(doc));
    await store.save(projectId, encodeDoc(doc));
  });
}

async function loadSqlRows(projectId: string): Promise<SqlMetaRows> {
  const db = await getDb();
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
    folders,
    scenes: rawScenes.map((row) => ({ ...row, status: normalizeStatus(row.status) })),
    labels: rawLabels.map((row) => ({ ...row, color: row.color as LabelColor })),
    sceneLabels,
  };
}

/** Create or replace one project's meta doc from its current SQLite projection. */
export function bootstrapProjectMeta(projectId: string): Promise<void> {
  return runExclusive(projectId, async () => {
    const doc = buildFromSql(await loadSqlRows(projectId));
    await store.save(projectId, encodeDoc(doc));
  });
}

/** Bootstrap meta docs for every local project. Reserved for sync-engine startup. */
export async function ensureAllProjectMetas(): Promise<void> {
  const db = await getDb();
  const projects = await db.select<Array<{ id: string }>>("SELECT id FROM projects");
  await Promise.all(projects.map(({ id }) => bootstrapProjectMeta(id)));
}
