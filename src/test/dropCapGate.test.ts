/**
 * DropCapGate predicate — unit tests
 *
 * Contract: `firstParaHasContent(doc)` returns true when the first top-level
 * node is a paragraph with at least one character. The PM plugin's
 * `props.decorations` uses this predicate to wrap the first character in a
 * `<span class="drop-cap-letter">` decoration — activating on the FIRST
 * keystroke, not the second.
 *
 * Rendering the drop-cap itself is CDP-smoke territory — jsdom cannot evaluate
 * `initial-letter`, and ProseMirror owns the content DOM.
 */
import { Schema } from "prosemirror-model";
import { describe, expect, it } from "vitest";

import { firstParaHasContent } from "../editor/extensions/DropCapGate";

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

describe("firstParaHasContent", () => {
  it("returns false when first paragraph is empty — no drop-cap on blank scene", () => {
    expect(firstParaHasContent(makeDoc(""))).toBe(false);
  });

  it("returns true when first paragraph has exactly one character — drop-cap activates on first keystroke", () => {
    expect(firstParaHasContent(makeDoc("A"))).toBe(true);
  });

  it("returns true when first paragraph has two characters — drop-cap stays active after second keystroke", () => {
    expect(firstParaHasContent(makeDoc("He"))).toBe(true);
  });

  it("returns true for a full paragraph — existing scenes retain the drop-cap", () => {
    expect(firstParaHasContent(makeDoc("It was a dark and stormy night."))).toBe(true);
  });
});
