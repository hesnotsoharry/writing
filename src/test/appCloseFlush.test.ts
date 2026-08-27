import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence } from "../yjs/bindPersistence";
import { applyEncoded, extractPlainText } from "../yjs/serialize";

/** Append a paragraph with given text to Y.Doc content fragment. */
function appendParagraph(doc: Y.Doc, text: string): void {
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(frag.length, [p]);
}

describe("App close save pipeline flush seam (P4.1)", () => {
  it("flushes pending keystrokes typed <=500ms before app close into scene_docs", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-1", store, { debounceMs: 500 });

    appendParagraph(doc, "Initial sentence.");
    await unbind.flush();
    expect(store.saveCount).toBe(1);

    // User types additional sentence right before closing window (<500ms)
    appendParagraph(doc, "Last sentence typed right before closing.");
    expect(store.saveCount).toBe(1);

    // Simulated app-close handler: awaits flushPendingSave on the save pipeline
    await unbind.flush();
    expect(store.saveCount).toBe(2);

    // Verify stored state in DB reflects all typed prose
    const restored = new Y.Doc();
    const stored = await store.load("scene-1");
    expect(stored).not.toBeNull();
    applyEncoded(restored, stored!);
    expect(extractPlainText(restored)).toBe("Initial sentence.\nLast sentence typed right before closing.");

    unbind();
  });

  it("persists deleted/empty content on app close so deleted text does not resurrect", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-2", store, { debounceMs: 500 });

    appendParagraph(doc, "Passage to be deleted.");
    await unbind.flush();
    expect(store.saveCount).toBe(1);

    // User selects all and deletes everything in the scene right before closing
    const frag = doc.getXmlFragment("content");
    frag.delete(0, frag.length);

    // App-close triggers flushPendingSave
    await unbind.flush();
    expect(store.saveCount).toBe(2);

    // On relaunch, loadScene gets the empty document
    const restored = new Y.Doc();
    const stored = await store.load("scene-2");
    expect(stored).not.toBeNull();
    applyEncoded(restored, stored!);
    expect(extractPlainText(restored)).toBe("");

    unbind();
  });

  it("handles close flush error gracefully without throwing unhandled rejection", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-err", store, { debounceMs: 500 });

    vi.spyOn(store, "save").mockRejectedValueOnce(new Error("disk write error"));
    appendParagraph(doc, "Some text.");

    let caught: unknown = null;
    try {
      await unbind.flush();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);

    unbind();
  });
});
