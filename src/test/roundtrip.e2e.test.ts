import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence } from "../yjs/bindPersistence";
import { applyEncoded } from "../yjs/serialize";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("walking-skeleton seam", () => {
  it("text written into one session survives a simulated relaunch", async () => {
    const store = new InMemorySceneDocStore();
    const SCENE = "skeleton-scene";

    // --- Session 1: open, hydrate (empty), bind, write, let it persist ---
    const docA = new Y.Doc();
    applyEncoded(docA, (await store.load(SCENE)) ?? "");
    const unbindA = bindPersistence(docA, SCENE, store, 500);
    docA.getText("content").insert(0, "The salt road ran north.");
    await vi.advanceTimersByTimeAsync(500);
    unbindA();

    // --- Session 2: fresh doc, hydrate from store (the "relaunch") ---
    const docB = new Y.Doc();
    applyEncoded(docB, (await store.load(SCENE))!);

    expect(docB.getText("content").toString()).toBe("The salt road ran north.");
  });
});
