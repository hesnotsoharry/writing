// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { useLiveWordCount } from "../editor/useLiveWordCount";

// ---------------------------------------------------------------------------
// Helpers — same Y.Doc construction pattern as bindPersistence.test.ts
// ---------------------------------------------------------------------------

function makeDoc(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return doc;
}

function appendText(doc: Y.Doc, text: string): void {
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const xt = new Y.XmlText();
  xt.insert(0, text);
  p.insert(0, [xt]);
  frag.insert(frag.length, [p]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLiveWordCount", () => {
  it("returns 0 when doc is null", () => {
    const { result } = renderHook(() => useLiveWordCount(null));
    expect(result.current).toBe(0);
  });

  it("returns the correct word count for the initial doc contents", () => {
    // "The quick brown fox" = 4 words
    const doc = makeDoc("The quick brown fox");
    const { result } = renderHook(() => useLiveWordCount(doc));
    expect(result.current).toBe(4);
  });

  it("updates the count after a Yjs document mutation (simulated typing)", () => {
    const doc = makeDoc("Hello world");
    const { result } = renderHook(() => useLiveWordCount(doc));
    expect(result.current).toBe(2);

    // Simulate the user typing a new sentence — fires a Yjs "update" event,
    // which the hook observer catches to call setState.
    act(() => {
      appendText(doc, "A third word added");
    });

    // 2 initial + 4 new = 6 words total
    expect(result.current).toBe(6);
  });

  it("resets to 0 and re-subscribes when doc changes to null", () => {
    const doc = makeDoc("Some words here");
    const { result, rerender } = renderHook(
      ({ d }: { d: Y.Doc | null }) => useLiveWordCount(d),
      { initialProps: { d: doc as Y.Doc | null } },
    );
    expect(result.current).toBe(3);

    act(() => {
      rerender({ d: null });
    });

    expect(result.current).toBe(0);
  });

  it("re-subscribes to a new doc identity when the scene changes", () => {
    const docA = makeDoc("One word");
    const docB = makeDoc("One two three four five");

    const { result, rerender } = renderHook(
      ({ d }: { d: Y.Doc | null }) => useLiveWordCount(d),
      { initialProps: { d: docA } },
    );
    expect(result.current).toBe(2);

    act(() => {
      rerender({ d: docB });
    });

    expect(result.current).toBe(5);

    // Mutations to docA after switch must NOT affect the count (old observer cleaned up).
    act(() => {
      appendText(docA, "should be ignored extra words");
    });
    expect(result.current).toBe(5);
  });

  it("ignores leading/trailing whitespace and multiple spaces between words", () => {
    const doc = makeDoc("  spaced   out  ");
    const { result } = renderHook(() => useLiveWordCount(doc));
    expect(result.current).toBe(2);
  });
});
