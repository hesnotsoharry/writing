/**
 * SQLite helpers for entity_relations (Wave 27 Phase 4).
 * Extracted from sqliteStoryBibleStore.ts to keep that file within 300 lines.
 */
import { getDb } from "./schema";
import type { AddRelationArgs, Relation } from "./storyBibleStore";

// ── Types ─────────────────────────────────────────────────────────────────────

type RelRow = {
  id: string; project_id: string; from_entity: string; to_entity: string;
  relation_label: string; reciprocal_id: string | null; created_at: number;
};

function rowToRelation(r: RelRow): Relation {
  return { id: r.id, projectId: r.project_id, fromEntity: r.from_entity, toEntity: r.to_entity, label: r.relation_label, reciprocalId: r.reciprocal_id, createdAt: r.created_at };
}

// ── sqliteWriteReciprocal ─────────────────────────────────────────────────────

async function sqliteWriteReciprocal(projectId: string, args: AddRelationArgs, fwdId: string, now: number): Promise<string | null> {
  const { fromEntity, toEntity, reciprocalLabel } = args;
  if (reciprocalLabel === undefined) return null;
  const db = await getDb();
  const invExisting = await db.select<{ id: string }[]>(
    `SELECT id FROM entity_relations WHERE project_id = $1 AND from_entity = $2 AND to_entity = $3`,
    [projectId, toEntity, fromEntity]
  );
  if (invExisting.length === 0) {
    const invId = crypto.randomUUID();
    await db.execute(
      `INSERT OR IGNORE INTO entity_relations (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [invId, projectId, toEntity, fromEntity, reciprocalLabel, fwdId, now]
    );
    await db.execute(`UPDATE entity_relations SET reciprocal_id = $1 WHERE id = $2`, [invId, fwdId]);
    return invId;
  }
  const reciprocalId = invExisting[0].id;
  await db.execute(`UPDATE entity_relations SET reciprocal_id = $1 WHERE id = $2`, [reciprocalId, fwdId]);
  return reciprocalId;
}

// ── sqliteAddRelation ─────────────────────────────────────────────────────────

export async function sqliteAddRelation(projectId: string, args: AddRelationArgs): Promise<Relation> {
  const { fromEntity, toEntity, label } = args;
  const db = await getDb();
  const existing = await db.select<RelRow[]>(
    `SELECT id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at FROM entity_relations WHERE project_id = $1 AND from_entity = $2 AND to_entity = $3`,
    [projectId, fromEntity, toEntity]
  );
  if (existing.length > 0) return rowToRelation(existing[0]);
  const now = Date.now();
  const fwdId = crypto.randomUUID();
  await db.execute(
    `INSERT OR IGNORE INTO entity_relations (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at) VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
    [fwdId, projectId, fromEntity, toEntity, label, now]
  );
  const reciprocalId = await sqliteWriteReciprocal(projectId, args, fwdId, now);
  return { id: fwdId, projectId, fromEntity, toEntity, label, reciprocalId, createdAt: now };
}

// ── sqliteListRelations ───────────────────────────────────────────────────────

export async function sqliteListRelations(projectId: string, entityId?: string): Promise<Relation[]> {
  const db = await getDb();
  let rows: RelRow[];
  if (entityId !== undefined) {
    rows = await db.select(
      `SELECT id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at FROM entity_relations WHERE project_id = $1 AND (from_entity = $2 OR to_entity = $2) ORDER BY created_at`,
      [projectId, entityId]
    );
  } else {
    rows = await db.select(
      `SELECT id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at FROM entity_relations WHERE project_id = $1 ORDER BY created_at`,
      [projectId]
    );
  }
  return rows.map(rowToRelation);
}

// ── sqliteDeleteRelation ──────────────────────────────────────────────────────

export async function sqliteDeleteRelation(id: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ reciprocal_id: string | null }[]>(
    `SELECT reciprocal_id FROM entity_relations WHERE id = $1`, [id]
  );
  await db.execute(`DELETE FROM entity_relations WHERE id = $1`, [id]);
  if (rows.length > 0 && rows[0].reciprocal_id) {
    await db.execute(`DELETE FROM entity_relations WHERE id = $1`, [rows[0].reciprocal_id]);
  }
}

// ── sqliteUpdateRelationLabel ─────────────────────────────────────────────────

export async function sqliteUpdateRelationLabel(id: string, label: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE entity_relations SET relation_label = $1 WHERE id = $2`, [label, id]);
}
