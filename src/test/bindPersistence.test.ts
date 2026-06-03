import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence } from "../yjs/bindPersistence";
import { applyEncoded, extractPlainText } from "../yjs/serialize";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Append a paragraph with the given text to the doc's XmlFragment. */
function appendParagraph(doc: Y.Doc, text: string): void {
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(frag.length, [p]);
}

describe("bindPersistence", () => {
  it("debounces saves and persists the latest state", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-1", store, 500);

    appendParagraph(doc, "Hello");
    appendParagraph(doc, " world");
    expect(store.saveCount).toBe(0); // nothing saved before debounce elapses

    await vi.advanceTimersByTimeAsync(500);
    expect(store.saveCount).toBe(1); // collapsed into a single save

    const restored = new Y.Doc();
    applyEncoded(restored, (await store.load("scene-1"))!);
    expect(extractPlainText(restored)).toBe("Hello\n world");

    unbind();
  });

  it("stops saving after unbind", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-1", store, 500);
    unbind();
    appendParagraph(doc, "ignored");
    await vi.advanceTimersByTimeAsync(500);
    expect(store.saveCount).toBe(0);
  });
});
