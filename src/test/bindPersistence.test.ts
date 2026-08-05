import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence, SYNC_ORIGIN } from "../yjs/bindPersistence";
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

function paragraphUpdate(text: string): Uint8Array {
  const doc = new Y.Doc();
  appendParagraph(doc, text);
  return Y.encodeStateAsUpdate(doc);
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

  it("marks the initial eager save as having local edits", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const onSaved = vi.fn();
    const unbind = bindPersistence(doc, "initial", store, { debounceMs: 500, onSaved });

    await vi.advanceTimersByTimeAsync(500);

    expect(onSaved).toHaveBeenCalledWith("initial", 0, { hadLocalEdits: true });
    unbind();
  });

  it("saves remote-only updates without marking them as local edits", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const onSaved = vi.fn();
    const unbind = bindPersistence(doc, "remote", store, { debounceMs: 500, onSaved });
    await vi.advanceTimersByTimeAsync(500);
    onSaved.mockClear();

    Y.applyUpdate(doc, paragraphUpdate("from remote"), SYNC_ORIGIN);
    await vi.advanceTimersByTimeAsync(500);

    expect(store.saveCount).toBe(2);
    expect(onSaved).toHaveBeenCalledWith("remote", 2, { hadLocalEdits: false });
    unbind();
  });

  it("marks mixed local and remote updates in one debounce window as local", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const onSaved = vi.fn();
    const unbind = bindPersistence(doc, "mixed", store, { debounceMs: 500, onSaved });
    await vi.advanceTimersByTimeAsync(500);
    onSaved.mockClear();

    Y.applyUpdate(doc, paragraphUpdate("remote words"), SYNC_ORIGIN);
    appendParagraph(doc, "local words");
    await vi.advanceTimersByTimeAsync(500);

    expect(onSaved).toHaveBeenCalledWith("mixed", 4, { hadLocalEdits: true });
    unbind();
  });

  it("treats UndoManager-origin updates as local edits", async () => {
    const store = new InMemorySceneDocStore();
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("content");
    const undoManager = new Y.UndoManager(fragment);
    const onSaved = vi.fn();
    const unbind = bindPersistence(doc, "undo", store, { debounceMs: 500, onSaved });
    await vi.advanceTimersByTimeAsync(500);

    appendParagraph(doc, "undo me");
    await vi.advanceTimersByTimeAsync(500);
    onSaved.mockClear();
    undoManager.undo();
    await vi.advanceTimersByTimeAsync(500);

    expect(onSaved).toHaveBeenCalledWith("undo", 0, { hadLocalEdits: true });
    unbind();
    undoManager.destroy();
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
