import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DbClient } from "../../db/dbClient";
import { runMigrations } from "../../db/migrations";
import { applyBibleDoc } from "../../sync/bible/bibleApplyExec";
import { planBibleDocApplication } from "../../sync/bible/bibleApplyPlan";
import {
  buildBibleFromSql, removeRelationPair, removeWithTombstone, type SqlBibleRows,
} from "../../sync/bible/bibleDoc";
import { DbBibleApplyTarget, loadBibleProjection } from "../../sync/bible/dbBibleApplyTarget";
import { makeSqlJsDb, type SqlJsTestDb } from "../support/sqljsDb";

let db: SqlJsTestDb;

function observingRelations(counts: number[]): DbClient {
  return {
    select: <T>(sql: string, params?: unknown[]) => db.select<T>(sql, params),
    async execute(sql: string, params?: unknown[]) {
      const result = await db.execute(sql, params);
      if (sql.includes("entity_relations")) {
        const rows = await db.select<Array<{ count: number }>>(
          "SELECT COUNT(*) AS count FROM entity_relations",
        );
        counts.push(rows[0]?.count ?? -1);
      }
      return result;
    },
  };
}

function rows(): SqlBibleRows {
  const generic = (id: string, type = id) => ({
    id, projectId: "p1", storage: "entity" as const, entityType: type,
    name: id, notes: `${id} notes`, aliases: null, excludeFromAi: id === "lore",
  });
  return {
    entityTypes: [{ id: "type-1", projectId: "p1", name: "Creature", icon: "paw",
      color: "clay", fieldsJson: "[]", sectionsJson: "[]" }],
    entities: [
      { id: "c1", projectId: "p1", storage: "character", entityType: "character",
        name: "Character", notes: "Long notes", aliases: null, excludeFromAi: false },
      { id: "loc", projectId: "p1", storage: "location", entityType: "location",
        name: "Location", notes: null, aliases: "Place", excludeFromAi: false },
      generic("item"), generic("faction"), generic("lore"), generic("theme"), generic("g1", "type-1"),
    ],
    fields: [{ id: "f1", entityId: "g1", kind: "section", fieldKey: "history",
      fieldValue: "Long history", sort: 2 }],
    sceneLinks: [{ id: "s1:g1", sceneId: "s1", entityType: "type-1", entityId: "g1" }],
    entityLinks: [{ id: "l1", fromId: "c1", toId: "g1", relation: "hunts" }],
    relations: [
      { id: "r1", projectId: "p1", fromEntity: "c1", toEntity: "g1",
        relationLabel: "Hunts", reciprocalId: "r2", createdAt: 1 },
      { id: "r2", projectId: "p1", fromEntity: "g1", toEntity: "c1",
        relationLabel: "Hunted by", reciprocalId: "r1", createdAt: 1 },
    ],
  };
}

async function seedParents(): Promise<void> {
  await db.execute(
    `INSERT INTO projects (id, title, type, sort_order, created_at, updated_at)
     VALUES ('p1','Project','novel',1000,'now','now')`,
  );
  await db.execute(
    `INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status)
     VALUES ('s1','p1',NULL,'Scene',NULL,1000,0,'draft')`,
  );
}

beforeEach(async () => {
  db = await makeSqlJsDb(); await runMigrations(db); await seedParents();
});
afterEach(() => db.close());

describe("Bible SQL projection", () => {
  it("round-trips SQL -> doc -> SQL losslessly and routes legacy/generic entities", async () => {
    const target = new DbBibleApplyTarget(db); const doc = buildBibleFromSql(rows());
    await applyBibleDoc("p1", doc, target);
    const projected = await loadBibleProjection(db, "p1"); const expected = rows();
    projected.entities.sort((left, right) => left.id.localeCompare(right.id));
    expected.entities.sort((left, right) => left.id.localeCompare(right.id));
    expect(projected).toEqual(expected);
    expect(await db.select<Array<{ id: string }>>("SELECT id FROM characters")).toEqual([{ id: "c1" }]);
    expect(await db.select<Array<{ id: string }>>("SELECT id FROM locations")).toEqual([{ id: "loc" }]);
    expect(await db.select<Array<{ id: string }>>("SELECT id FROM entities ORDER BY id")).toEqual([
      { id: "faction" }, { id: "g1" }, { id: "item" }, { id: "lore" }, { id: "theme" },
    ]);
  });

  it("is idempotent and applies a custom type before its instance", async () => {
    const target = new DbBibleApplyTarget(db); const doc = buildBibleFromSql(rows());
    db.executeCalls.length = 0;
    await applyBibleDoc("p1", doc, target);
    const firstCalls = [...db.executeCalls];
    expect(firstCalls.findIndex((sql) => sql.includes("entity_types_custom")))
      .toBeLessThan(firstCalls.findIndex((sql) => sql.includes("INSERT INTO entities")));
    db.executeCalls.length = 0;
    await applyBibleDoc("p1", doc, target);
    expect(db.executeCalls).toEqual([]);
  });

  it("does not infer deletion from absence and deletes only after a tombstone", async () => {
    const target = new DbBibleApplyTarget(db); const full = buildBibleFromSql(rows());
    await applyBibleDoc("p1", full, target);
    const absent = buildBibleFromSql({ ...rows(), fields: [] });
    expect(planBibleDocApplication(absent, await target.load("p1")).deletes).toEqual([]);
    await applyBibleDoc("p1", absent, target);
    expect((await target.load("p1")).fields).toHaveLength(1);
    removeWithTombstone(absent, "field", "f1", 1);
    await applyBibleDoc("p1", absent, target);
    expect((await target.load("p1")).fields).toEqual([]);
  });

  it("projects reciprocal create/delete with one atomic SQL statement per pair", async () => {
    const observedCounts: number[] = [];
    const target = new DbBibleApplyTarget(observingRelations(observedCounts));
    const doc = buildBibleFromSql(rows());
    db.executeCalls.length = 0; await applyBibleDoc("p1", doc, target);
    const relationWrites = db.executeCalls.filter((sql) => sql.includes("INSERT INTO entity_relations"));
    expect(relationWrites).toHaveLength(1);
    expect(observedCounts).toEqual([2]);
    expect((await target.load("p1")).relations).toHaveLength(2);
    removeRelationPair(doc, "r1", "r2", 1);
    db.executeCalls.length = 0; await applyBibleDoc("p1", doc, target);
    const relationDeletes = db.executeCalls.filter((sql) => sql.includes("DELETE FROM entity_relations"));
    expect(relationDeletes).toHaveLength(1);
    expect(observedCounts).toEqual([2, 0]);
    expect((await target.load("p1")).relations).toEqual([]);
  });
});
