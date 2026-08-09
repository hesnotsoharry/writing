import type { BibleApplyTarget } from "../sync/bible/bibleApplyExec";
import type { BibleDeleteOp, BibleProjectionSnapshot } from "../sync/bible/bibleApplyPlan";
import type {
  BibleEntity, BibleEntityLink, BibleEntityType, BibleField, BibleRelation, BibleSceneLink,
} from "../sync/bible/bibleDoc";
import { DbBibleApplyTarget } from "../sync/bible/dbBibleApplyTarget";
import { getDb } from "./schema";

async function target(): Promise<DbBibleApplyTarget> {
  return new DbBibleApplyTarget(await getDb());
}

export class SqliteBibleApplyTarget implements BibleApplyTarget {
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
