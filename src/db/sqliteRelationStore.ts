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
): Promise<Relation> {
  return addRelation(await getDb(), projectId, args);
}

export async function sqliteListRelations(
  projectId: string,
  entityId?: string,
): Promise<Relation[]> {
  return listRelations(await getDb(), projectId, entityId);
}

export async function sqliteDeleteRelation(id: string): Promise<void> {
  await deleteRelation(await getDb(), id);
}

export async function sqliteUpdateRelationLabel(
  id: string,
  label: string,
): Promise<void> {
  await updateRelationLabel(await getDb(), id, label);
}
