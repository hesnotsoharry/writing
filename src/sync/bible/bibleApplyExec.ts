import type * as Y from "yjs";

import {
  type BibleApplyPlan, type BibleDeleteOp, type BibleProjectionSnapshot, planBibleDocApplication,
} from "./bibleApplyPlan";
import type {
  BibleEntity, BibleEntityLink, BibleEntityType, BibleField, BibleRelation, BibleSceneLink,
} from "./bibleDoc";

export interface BibleApplyTarget {
  load(projectId: string): Promise<BibleProjectionSnapshot>;
  upsertEntityType(row: BibleEntityType): Promise<void>;
  upsertEntity(row: BibleEntity): Promise<void>;
  upsertField(row: BibleField): Promise<void>;
  upsertSceneLink(row: BibleSceneLink): Promise<void>;
  upsertEntityLink(row: BibleEntityLink): Promise<void>;
  upsertRelations(rows: BibleRelation[]): Promise<void>;
  delete(op: BibleDeleteOp): Promise<void>;
}

async function executeUpserts(plan: BibleApplyPlan, target: BibleApplyTarget): Promise<void> {
  for (const row of plan.entityTypeUpserts) await target.upsertEntityType(row);
  for (const row of plan.entityUpserts) await target.upsertEntity(row);
  for (const row of plan.fieldUpserts) await target.upsertField(row);
  for (const row of plan.sceneLinkUpserts) await target.upsertSceneLink(row);
  for (const row of plan.entityLinkUpserts) await target.upsertEntityLink(row);
  for (const rows of plan.relationUpserts) await target.upsertRelations(rows);
}

/** Custom types -> bases -> dependent rows; repeated application plans no writes. */
export async function applyBibleDoc(
  projectId: string, doc: Y.Doc, target: BibleApplyTarget,
): Promise<void> {
  const plan = planBibleDocApplication(doc, await target.load(projectId));
  await executeUpserts(plan, target);
  for (const operation of plan.deletes) await target.delete(operation);
}
