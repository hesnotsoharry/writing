import type { BibleApplyTarget } from "@writersnook/sync/bible/bibleApplyExec";
import type { BibleDeleteOp, BibleProjectionSnapshot } from "@writersnook/sync/bible/bibleApplyPlan";
import type {
  BibleEntity, BibleEntityLink, BibleEntityType, BibleField, BibleRelation, BibleSceneLink,
} from "@writersnook/sync/bible/bibleDoc";
import { DbBibleApplyTarget } from "@writersnook/sync/bible/dbBibleApplyTarget";

import { getMobileDb } from "./database";

async function target(): Promise<DbBibleApplyTarget> {
  return new DbBibleApplyTarget(await getMobileDb());
}

export class MobileBibleApplyTarget implements BibleApplyTarget {
  async load(projectId: string): Promise<BibleProjectionSnapshot> {
    return (await target()).load(projectId);
  }
  async upsertEntityType(row: BibleEntityType): Promise<void> { await (await target()).upsertEntityType(row); }
  async upsertEntity(row: BibleEntity): Promise<void> { await (await target()).upsertEntity(row); }
  async upsertField(row: BibleField): Promise<void> { await (await target()).upsertField(row); }
  async upsertSceneLink(row: BibleSceneLink): Promise<void> { await (await target()).upsertSceneLink(row); }
  async upsertEntityLink(row: BibleEntityLink): Promise<void> { await (await target()).upsertEntityLink(row); }
  async upsertRelations(rows: BibleRelation[]): Promise<void> { await (await target()).upsertRelations(rows); }
  async delete(op: BibleDeleteOp): Promise<void> { await (await target()).delete(op); }
}
