import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence } from "../yjs/bindPersistence";
import { applyEncoded, extractPlainText } from "../yjs/serialize";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("walking-skeleton seam", () => {
  it("text written into one session survives a simulated relaunch", async () => {
    const store = new InMemorySceneDocStore();
    const SCENE = "skeleton-scene";

    // --- Session 1: open, hydrate (empty), bind, write, let it persist ---
    const docA = new Y.Doc();
    applyEncoded(docA, (await store.load(SCENE)) ?? "");
    const unbindA = bindPersistence(docA, SCENE, store, { debounceMs: 500 });
    const frag = docA.getXmlFragment("content");
    const p = new Y.XmlElement("paragraph");
    const t = new Y.XmlText();
    t.insert(0, "The salt road ran north.");
    p.insert(0, [t]);
    frag.insert(0, [p]);
    await vi.advanceTimersByTimeAsync(500);
    unbindA();

    // --- Session 2: fresh doc, hydrate from store (the "relaunch") ---
    const docB = new Y.Doc();
    applyEncoded(docB, (await store.load(SCENE))!);

    expect(extractPlainText(docB)).toBe("The salt road ran north.");
  });
});
