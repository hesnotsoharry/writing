/// <reference types="node" />
import { makeSqlJsDb, type SqlJsTestDb } from "@writersnook/test/support/sqljsDb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileBinderStore } from "../../db/mobileBinderStore";
import { MobileLabelStore } from "../../db/mobileLabelStore";
import { subscribeMobileMetaSaves } from "../../db/mobileMetaBridge";
import { runMigrations } from "../../shared/migrations";

let db: SqlJsTestDb;
vi.mock("../../db/database", () => ({ getMobileDb: () => Promise.resolve(db) }));

beforeEach(async () => { db = await makeSqlJsDb(); await runMigrations(db); });

describe("binder mutations push the meta document", () => {
  it("notifies immediately for reorder, create, rename, status, and label assignment changes", async () => {
    const binder = new MobileBinderStore(db);
    const labels = new MobileLabelStore(db);
    const projectId = await binder.createProject({ title: "Novel", type: "novel" });
    const folderId = await binder.createFolder({ projectId, title: "Chapter" });
    const sceneId = await binder.createScene({ projectId, folderId, title: "One" });
    const secondId = await binder.createScene({ projectId, folderId, title: "Two" });
    const label = await labels.createLabel(projectId, "POV", "clay");
    const pushed = vi.fn();
    const unsubscribe = subscribeMobileMetaSaves(pushed);

    await binder.moveScene(secondId, folderId, 0);
    await binder.createScene({ projectId, folderId, title: "Three" });
    await binder.renameScene(sceneId, "Opening");
    await binder.setSceneStatus(sceneId, "draft");
    await labels.assignLabel(sceneId, label.id);
    await labels.unassignLabel(sceneId, label.id);

    expect(pushed).toHaveBeenCalledTimes(6);
    expect(pushed.mock.calls.every(([id]) => id === projectId)).toBe(true);
    unsubscribe();
  });
});
