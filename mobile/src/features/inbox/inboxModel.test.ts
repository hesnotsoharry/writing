import { describe, expect, it, vi } from "vitest";

import { promoteNote, promotionKey, reduceSwipe } from "./inboxModel";

describe("note promotion", () => {
  it("uses a stable note idempotency key and does not create a duplicate on replay", async () => {
    let existing: string | null = null;
    const createScene = vi.fn(async () => { existing = "scene-1"; return "scene-1"; });
    const deps = { findSceneByKey: vi.fn(async () => existing), createScene, sceneDocExists: vi.fn(async () => existing !== null), saveSceneDoc: vi.fn(async () => undefined), publishScene: vi.fn(async () => undefined), markFiled: vi.fn(async () => undefined), syncAfterSave: vi.fn(async () => undefined) };
    const note = { id: "note-7", body: "A thought", project_id: "project-1" };
    expect(promotionKey(note.id)).toBe("quick-note:note-7");
    await promoteNote(deps, note, "doc"); await promoteNote(deps, note, "doc");
    expect(createScene).toHaveBeenCalledTimes(1); expect(deps.markFiled).toHaveBeenCalledTimes(2);
  });

  it("marks the note filed only after the scene doc exists and is published", async () => {
    const order: string[] = [];
    const deps = { findSceneByKey: async () => null, createScene: async () => { order.push("meta"); return "scene"; }, sceneDocExists: async () => false, saveSceneDoc: async () => { order.push("doc"); }, publishScene: async () => { order.push("publish"); }, markFiled: async () => { order.push("filed"); }, syncAfterSave: async () => { order.push("sync"); } };
    await promoteNote(deps, { id: "n", body: "body", project_id: "p" }, "doc");
    expect(order).toEqual(["meta", "doc", "publish", "filed", "sync"]);
  });
});

describe("swipe archive state", () => {
  it("commits an opened swipe", () => {
    expect(reduceSwipe(reduceSwipe(reduceSwipe("idle", "start"), "open"), "success")).toBe("archived");
  });
  it("returns an interrupted swipe to idle", () => {
    expect(reduceSwipe(reduceSwipe("idle", "start"), "cancel")).toBe("idle");
    expect(reduceSwipe(reduceSwipe(reduceSwipe("idle", "start"), "open"), "failure")).toBe("idle");
  });
});
