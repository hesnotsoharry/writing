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
    const unbind = bindPersistence(doc, "scene-1", store, { debounceMs: 500 });

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

  it("calls onSaved with the correct word count after a debounced save", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    let capturedId: string | null = null;
    let capturedCount: number | null = null;
    const unbind = bindPersistence(doc, "scene-wc", store, {
      debounceMs: 500,
      onSaved: (id, wordCount) => { capturedId = id; capturedCount = wordCount; },
    });

    appendParagraph(doc, "five words in this paragraph");
    await vi.advanceTimersByTimeAsync(500);

    expect(capturedId).toBe("scene-wc");
    // "five words in this paragraph" = 5 words
    expect(capturedCount).toBe(5);
    unbind();
  });

  it("calls onSaved with wordCount=0 for an empty doc", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    let capturedCount: number | null = null;
    const unbind = bindPersistence(doc, "empty", store, {
      debounceMs: 500,
      onSaved: (_id, wordCount) => { capturedCount = wordCount; },
    });
    // No content appended — empty doc
    await vi.advanceTimersByTimeAsync(500);
    expect(capturedCount).toBe(0);
    unbind();
  });

  it("flushes a pending save on unbind, then stops saving", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const unbind = bindPersistence(doc, "scene-1", store, { debounceMs: 500 });
    // Write within the debounce window, then unbind before it elapses. The
    // pending save must FLUSH (not drop) — writes made within debounceMs of
    // unbind were silently lost before (wave-32 Phase 6: graduating a board
    // card right before navigating away).
    appendParagraph(doc, "written just before unbind");
    unbind();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.saveCount).toBe(1);
    const restored = new Y.Doc();
    applyEncoded(restored, (await store.load("scene-1"))!);
    expect(extractPlainText(restored)).toBe("written just before unbind");
    // After the flush, further updates must NOT trigger saves.
    appendParagraph(doc, "ignored");
    await vi.advanceTimersByTimeAsync(500);
    expect(store.saveCount).toBe(1);
  });
});
