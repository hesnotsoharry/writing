/**
 * DropCapGate predicate — unit tests
 *
 * Contract: `firstParaHasMultipleChars(doc)` returns true only when the
 * first top-level paragraph's text content exceeds one character. The PM
 * plugin's `props.attributes` uses this predicate to toggle `dropcap-ready`
 * on the editable element, which gates the CSS `initial-letter` drop-cap.
 *
 * Rendering the drop-cap itself is CDP-smoke territory — jsdom cannot evaluate
 * `initial-letter`, and ProseMirror owns the content DOM.
 */
import { Schema } from "prosemirror-model";
import { describe, expect, it } from "vitest";

import { firstParaHasMultipleChars } from "../editor/extensions/DropCapGate";

// ---------------------------------------------------------------------------
// Minimal ProseMirror schema — doc + paragraph + text (mirrors buildTextIndex.test.ts)
// ---------------------------------------------------------------------------

const testSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() { return ["p", 0]; },
    },
    text: { group: "inline" },
  },
});

function makeDoc(text: string) {
  const content = text.length > 0 ? [testSchema.text(text)] : [];
  return testSchema.node("doc", null, [
    testSchema.node("paragraph", null, content),
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("firstParaHasMultipleChars", () => {
  it("returns false when first paragraph is empty — no drop-cap on blank scene", () => {
    expect(firstParaHasMultipleChars(makeDoc(""))).toBe(false);
  });

  it("returns false when first paragraph has exactly one character — drop-cap inactive on first keystroke", () => {
    expect(firstParaHasMultipleChars(makeDoc("A"))).toBe(false);
  });

  it("returns true when first paragraph has two characters — drop-cap activates on second keystroke", () => {
    expect(firstParaHasMultipleChars(makeDoc("He"))).toBe(true);
  });

  it("returns true for a full paragraph — existing scenes retain the drop-cap", () => {
    expect(firstParaHasMultipleChars(makeDoc("It was a dark and stormy night."))).toBe(true);
  });
});
