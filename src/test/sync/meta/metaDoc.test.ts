import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  buildFromSql, bumpEpoch, getEpoch, readMetaDoc, type SqlMetaRows,
} from "../../../sync/meta/metaDoc";

const rows: SqlMetaRows = {
  folders: [
    { id: "f2", project_id: "p1", title: "Two", sort_order: 2000 },
    { id: "f1", project_id: "p1", title: "One", sort_order: 1000 },
  ],
  scenes: [
    { id: "s2", project_id: "p1", folder_id: "f1", title: "Second",
      synopsis: null, status: "draft", sort_order: 2000 },
    { id: "s1", project_id: "p1", folder_id: "f1", title: "First",
      synopsis: "Opening", status: "outline", sort_order: 1000 },
  ],
  labels: [
    { id: "l1", project_id: "p1", name: "Tension", color: "clay", sort: 0 },
  ],
  sceneLabels: [{ scene_id: "s1", label_id: "l1" }],
};

describe("project meta doc", () => {
  it("round-trips all SQL structure rows with derived ordering", () => {
    const state = readMetaDoc(buildFromSql(rows));
    expect(state.folders.map((row) => row.id).sort()).toEqual(["f1", "f2"]);
    expect(state.scenes.find((row) => row.id === "s1")).toMatchObject({
      projectId: "p1", folderId: "f1", title: "First", synopsis: "Opening",
    });
    expect(state.labels[0]).toMatchObject({ id: "l1", name: "Tension", color: "clay" });
    expect(state.sceneLabels[0]).toEqual({ id: "s1:l1", sceneId: "s1", labelId: "l1" });
    expect(state.folders.find((row) => row.id === "f1")!.sortKey
      < state.folders.find((row) => row.id === "f2")!.sortKey).toBe(true);
  });

  it("independently bootstrapped docs merge to identical state", () => {
    const left = buildFromSql(rows);
    const right = buildFromSql(rows);
    const leftUpdate = Y.encodeStateAsUpdate(left);
    const rightUpdate = Y.encodeStateAsUpdate(right);
    Y.applyUpdate(left, rightUpdate);
    Y.applyUpdate(right, leftUpdate);
    expect(readMetaDoc(left)).toEqual(readMetaDoc(right));
  });

  it("exposes epoch bumps", () => {
    const doc = buildFromSql(rows);
    expect(getEpoch(doc, "s1")).toBe(0);
    expect(bumpEpoch(doc, "s1")).toBe(1);
    expect(getEpoch(doc, "s1")).toBe(1);
  });
});
