import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  planMetaDocApplication, type SqlProjectionSnapshot,
} from "../../../sync/meta/applyPlan";
import {
  buildFromSql, getScenes, removeWithTombstone, setScene,
} from "../../../sync/meta/metaDoc";
import { keyBetween } from "../../../sync/meta/sortKey";

function snapshot(): SqlProjectionSnapshot {
  return {
    folders: [{ id: "f1", project_id: "p1", title: "Chapter", sort_order: 1000 }],
    scenes: [
      { id: "a", project_id: "p1", folder_id: "f1", title: "A", synopsis: null,
        status: "draft", sort_order: 1000 },
      { id: "b", project_id: "p1", folder_id: "f1", title: "B", synopsis: null,
        status: "draft", sort_order: 2000 },
      { id: "c", project_id: "p1", folder_id: "f1", title: "C", synopsis: null,
        status: "draft", sort_order: 3000 },
    ],
    labels: [], sceneLabels: [],
  };
}

function docFrom(sql = snapshot()): Y.Doc {
  return buildFromSql({ ...sql, sceneLabels: sql.sceneLabels });
}

function applyPlan(sql: SqlProjectionSnapshot, doc: Y.Doc): SqlProjectionSnapshot {
  const plan = planMetaDocApplication(doc, sql);
  const deleted = new Set(plan.deletes.filter((op) => op.kind === "scene").map((op) => op.id));
  const scenes = sql.scenes.filter((row) => !deleted.has(row.id));
  for (const row of plan.sceneUpserts) {
    const index = scenes.findIndex((item) => item.id === row.id);
    if (index < 0) scenes.push(row); else scenes[index] = { ...scenes[index], ...row };
  }
  for (const rewrite of plan.sortOrderRewrites) {
    if (rewrite.kind === "scene") {
      const row = scenes.find((item) => item.id === rewrite.id);
      if (row) row.sort_order = rewrite.sortOrder;
    }
  }
  return { ...sql, scenes };
}

describe("meta-doc SQL application plan", () => {
  it("plans remote scene adds and renames", () => {
    const doc = docFrom();
    const [a, b, c] = getScenes(doc).sort((x, y) => x.sortKey < y.sortKey ? -1 : 1);
    setScene(doc, { ...c, id: "d", title: "D", sortKey: keyBetween(c.sortKey, null) });
    setScene(doc, { ...a, title: "Renamed A" });
    const plan = planMetaDocApplication(doc, snapshot());
    expect(plan.sceneUpserts.map((row) => row.id).sort()).toEqual(["a", "d"]);
    expect(plan.deletes).toEqual([]);
    expect(b.id).toBe("b");
  });

  it("uses the converged sort-key order after concurrent reorder", () => {
    const base = docFrom();
    const left = new Y.Doc(); const right = new Y.Doc();
    Y.applyUpdate(left, Y.encodeStateAsUpdate(base));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(base));
    const [a, , c] = getScenes(base).sort((x, y) => x.sortKey < y.sortKey ? -1 : 1);
    setScene(left, { ...c, sortKey: keyBetween(null, a.sortKey) });
    const rightRows = getScenes(right).sort((x, y) => x.sortKey < y.sortKey ? -1 : 1);
    setScene(right, { ...rightRows[1], sortKey: keyBetween(rightRows[2].sortKey, null) });
    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
    const plan = planMetaDocApplication(left, snapshot());
    expect(plan.sortOrderRewrites.map(({ id }) => id).sort()).toEqual(["a", "b", "c"]);
  });

  it("plans deletes only from tombstones", () => {
    const doc = docFrom();
    removeWithTombstone(doc, "scene", "b", 1);
    expect(planMetaDocApplication(doc, snapshot()).deletes).toEqual([
      { kind: "scene", id: "b" },
    ]);
  });

  it("is empty after its plan is reflected in SQL", () => {
    const doc = docFrom();
    const [a, b] = getScenes(doc).sort((x, y) => x.sortKey < y.sortKey ? -1 : 1);
    setScene(doc, { ...b, sortKey: keyBetween(null, a.sortKey) });
    const applied = applyPlan(snapshot(), doc);
    expect(planMetaDocApplication(doc, applied)).toEqual({
      folderUpserts: [], sceneUpserts: [], labelOps: [], deletes: [], sortOrderRewrites: [],
    });
  });
});
