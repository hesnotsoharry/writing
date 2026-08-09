import type { DbClient } from "./dbClient";
import { getDb } from "./schema";
import {
  sqliteAddRelation as addRelation,
  sqliteDeleteRelation as deleteRelation,
  sqliteListRelations as listRelations,
  sqliteUpdateRelationLabel as updateRelationLabel,
} from "./sqliteRelationQueries";
import type { AddRelationArgs, Relation } from "./storyBibleStore";

export async function sqliteAddRelation(
  projectId: string,
  args: AddRelationArgs,
  db?: DbClient,
): Promise<Relation> {
  return addRelation(db ?? await getDb(), projectId, args);
}

export async function sqliteListRelations(
  projectId: string,
  entityId?: string,
): Promise<Relation[]> {
  return listRelations(await getDb(), projectId, entityId);
}

export async function sqliteDeleteRelation(id: string, db?: DbClient): Promise<void> {
  await deleteRelation(db ?? await getDb(), id);
}

export async function sqliteUpdateRelationLabel(
  id: string,
  label: string,
  db?: DbClient,
): Promise<void> {
  await updateRelationLabel(db ?? await getDb(), id, label);
}
