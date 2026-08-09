/// <reference types="node" />
import { makeSqlJsDb, type SqlJsTestDb } from "@writersnook/test/support/sqljsDb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileBinderStore } from "../../db/mobileBinderStore";
import { subscribeMobileMetaSaves } from "../../db/mobileMetaBridge";
import { runMigrations } from "../../shared/migrations";
import { dragTargetIndex, reorderPreview } from "./corkboardModel";

let db: SqlJsTestDb;
vi.mock("../../db/database", () => ({ getMobileDb: () => Promise.resolve(db) }));

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
});

describe("corkboard reorder write path", () => {
  it("persists the shared reorder and immediately emits the meta save consumed by sync", async () => {
    const store = new MobileBinderStore(db);
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Chapter" });
    for (const title of ["A", "B", "C"]) await store.createScene({ projectId, folderId, title });
    const initial = (await store.loadProject(projectId)).scenes;
    const target = dragTargetIndex({ fromIndex: 2, translationX: 0, translationY: -300, count: 3, columns: 1, cardWidth: 354, rowHeight: 150, gutter: 16 });
    const expected = reorderPreview(initial, initial[2].id, target).map(({ id }) => id);
    const notified = vi.fn();
    const unsubscribe = subscribeMobileMetaSaves(notified);
    await store.moveScene(initial[2].id, folderId, target);
    unsubscribe();
    expect((await store.loadProject(projectId)).scenes.map(({ id }) => id)).toEqual(expected);
    expect(notified).toHaveBeenCalledTimes(1);
    expect(notified.mock.calls[0][0]).toBe(projectId);
  });
});
