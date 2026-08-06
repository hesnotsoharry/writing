import type * as Y from "yjs";

import {
type DeleteOp, type LabelOp,   planMetaDocApplication, type SortOrderRewrite,
  type SqlFolderRow, type SqlProjectionSnapshot, type SqlSceneRow,
} from "./applyPlan";
import { getProject, type MetaProject } from "./metaDoc";

export interface MetaApplyTarget {
  ensureProject?(project: MetaProject): Promise<void>;
  load(projectId: string): Promise<SqlProjectionSnapshot>;
  upsertFolder(row: SqlFolderRow): Promise<void>;
  upsertScene(row: SqlSceneRow): Promise<void>;
  applyLabel(op: LabelOp): Promise<void>;
  delete(op: DeleteOp): Promise<void>;
  rewriteSort(op: SortOrderRewrite): Promise<void>;
}

/** Execute the planner's integrity-preserving order without relying on transactions. */
export async function applyMetaDoc(
  projectId: string, doc: Y.Doc, target: MetaApplyTarget
): Promise<void> {
  const project = getProject(doc);
  if (project) await target.ensureProject?.(project);
  const plan = planMetaDocApplication(doc, await target.load(projectId));
  for (const row of plan.folderUpserts) await target.upsertFolder(row);
  for (const row of plan.sceneUpserts) await target.upsertScene(row);
  for (const op of plan.labelOps) await target.applyLabel(op);
  for (const op of plan.deletes) await target.delete(op);
  for (const op of plan.sortOrderRewrites) await target.rewriteSort(op);
}
