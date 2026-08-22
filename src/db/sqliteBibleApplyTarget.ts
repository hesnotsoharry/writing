import type { BibleApplyTarget } from "../sync/bible/bibleApplyExec";
import type { BibleDeleteOp, BibleProjectionSnapshot } from "../sync/bible/bibleApplyPlan";
import type {
  BibleEntity, BibleEntityLink, BibleEntityType, BibleField, BibleRelation, BibleSceneLink,
} from "../sync/bible/bibleDoc";
import { DbBibleApplyTarget } from "../sync/bible/dbBibleApplyTarget";
import { dispatchBibleChanged } from "../sync/syncEvents";
import { getDb } from "./schema";

async function target(): Promise<DbBibleApplyTarget> {
  return new DbBibleApplyTarget(await getDb());
}

export class SqliteBibleApplyTarget implements BibleApplyTarget {
  async load(projectId: string): Promise<BibleProjectionSnapshot> {
    return (await target()).load(projectId);
  }
  async upsertEntityType(row: BibleEntityType): Promise<void> {
    await (await target()).upsertEntityType(row); dispatchBibleChanged();
  }
  async upsertEntity(row: BibleEntity): Promise<void> {
    await (await target()).upsertEntity(row); dispatchBibleChanged();
  }
  async upsertField(row: BibleField): Promise<void> {
    await (await target()).upsertField(row); dispatchBibleChanged();
  }
  async upsertSceneLink(row: BibleSceneLink): Promise<void> {
    await (await target()).upsertSceneLink(row); dispatchBibleChanged();
  }
  async upsertEntityLink(row: BibleEntityLink): Promise<void> {
    await (await target()).upsertEntityLink(row); dispatchBibleChanged();
  }
  async upsertRelations(rows: BibleRelation[]): Promise<void> {
    await (await target()).upsertRelations(rows); dispatchBibleChanged();
  }
  async delete(op: BibleDeleteOp): Promise<void> {
    await (await target()).delete(op); dispatchBibleChanged();
  }
}
