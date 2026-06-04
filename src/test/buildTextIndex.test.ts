/**
 * T1 — char↔ProseMirror position index
 *
 * Verifies that `buildTextIndex` + `charOffsetToPmPos` correctly maps char
 * offsets to absolute ProseMirror positions across ≥2 paragraphs, including
 * text containing multi-byte characters (accented letters).
 *
 * The correctness property: `charOffsetToPmPos` must account for ProseMirror's
 * node-boundary tokens (each paragraph open/close = 1 position). The naïve
 * approach of `editor.getText() + char-arithmetic` ignores those tokens and
 * returns a position that is off by 2 per paragraph boundary — this test will
 * FAIL if the naïve approach were used.
 */
import { Schema } from "prosemirror-model";
import { describe, expect, it } from "vitest";

import {
  buildTextIndex,
  charOffsetToPmPos,
} from "../editor/extensions/buildTextIndex";

// ---------------------------------------------------------------------------
// Minimal ProseMirror schema with doc + paragraph + text.
// ---------------------------------------------------------------------------

const testSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() {
        return ["p", 0];
      },
    },
    text: { group: "inline" },
  },
});

/**
 * Build a ProseMirror doc with one or more paragraphs.
 * Each element in `paragraphTexts` becomes one paragraph node.
 */
function makeDoc(...paragraphTexts: string[]) {
  return testSchema.node(
    "doc",
    null,
    paragraphTexts.map((text) =>
      testSchema.node("paragraph", null, [testSchema.text(text)]),
    ),
  );
}

// ---------------------------------------------------------------------------
// PM position helpers — independently computed for assertions.
// ---------------------------------------------------------------------------

/**
 * Given a two-paragraph doc where para1 has `para1TextLen` characters,
 * returns the absolute PM position of the first character of para2's text.
 *
 * PM layout:
 *   pos 1          : first char of para1
 *   pos 1+n        : (end of para1 text)
 *   pos 1+n+1      : para1 close token
 *   pos 1+n+1+1    : para2 open token  → but descendants gives this as pos 1+n+1
 *   pos 1+n+1+1+1  : first char of para2 = 1+n+2
 *
 * Actually: para2's text node is at pos = 1 (para1 open) + n (para1 text)
 *           + 1 (para1 close) + 1 (para2 open) = n + 3
 */
function para2TextStartPos(para1TextLen: number): number {
  return 1 + para1TextLen + 1 + 1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildTextIndex", () => {
  it("returns plain text concatenated from both paragraphs with a \\n separator", () => {
    const doc = makeDoc("café crême", "teh fox");
    const { plain } = buildTextIndex(doc);

    expect(plain).toBe("café crême\nteh fox");
  });

  it("produces segments with correct pmStart and plainStart for each paragraph", () => {
    const doc = makeDoc("hello", "world");
    const { segments } = buildTextIndex(doc);

    expect(segments).toHaveLength(2);

    // Segment 0: "hello" starts at PM pos 1 (after doc+para1 open = 1), plain offset 0.
    expect(segments[0].pmStart).toBe(1);
    expect(segments[0].plainStart).toBe(0);
    expect(segments[0].text).toBe("hello");

    // Segment 1: "world" starts at PM pos 1+5+2 = 8 (para1 close + para2 open = +2),
    // plain offset = len("hello") + len("\n") = 6.
    expect(segments[1].pmStart).toBe(para2TextStartPos("hello".length));
    expect(segments[1].plainStart).toBe("hello\n".length);
    expect(segments[1].text).toBe("world");
  });

  it("maps char offset of 'teh' in para2 to the correct PM position (multi-byte para1)", () => {
    // "café crême" is 10 JS chars.  "teh fox": 'teh' is at char index 0 within para2.
    const para1 = "café crême"; // 10 chars
    const para2 = "teh fox";
    const doc = makeDoc(para1, para2);
    const { segments, plain } = buildTextIndex(doc);

    // Find "teh" char offset in `plain` — it starts after para1 + "\n" separator.
    const tehPlainOffset = plain.indexOf("teh");
    expect(tehPlainOffset).toBe(para1.length + 1); // 10 + 1 = 11

    const tehPmFrom = charOffsetToPmPos(tehPlainOffset, segments);
    const tehPmTo = charOffsetToPmPos(tehPlainOffset + "teh".length, segments);

    // Independently computed PM position of para2's first char.
    const expectedPmStart = para2TextStartPos(para1.length); // 1+10+2 = 13

    expect(tehPmFrom).toBe(expectedPmStart); // 13
    expect(tehPmTo).toBe(expectedPmStart + "teh".length); // 16
  });

  it("would return WRONG result if naïve getText()-offset were used (documents the gap)", () => {
    // This is the anti-case: shows naive approach gives wrong answer.
    const para1 = "café crême"; // 10 chars
    const para2 = "teh fox";
    const doc = makeDoc(para1, para2);
    const { segments, plain } = buildTextIndex(doc);

    const tehPlainOffset = plain.indexOf("teh");
    const correctPmFrom = charOffsetToPmPos(tehPlainOffset, segments);

    // Naïve: treat plain as if doc had no node boundaries.
    // getText() would return "café crêmeteh fox" (no separator), so "teh" offset = 10.
    const naivePlainWithoutSeparator = para1 + para2; // no "\n"
    const naiveTehOffset = naivePlainWithoutSeparator.indexOf("teh"); // = 10
    // Naïve PM guess: just use char offset directly as PM pos (ignores block tokens).
    // This is wrong — it's 2 less than the correct answer per paragraph boundary.
    const naiveWrongPmFrom = naiveTehOffset + 1; // +1 for doc open only, missing para1-close+para2-open

    // Assert the naive guess differs from the correct answer.
    expect(naiveWrongPmFrom).not.toBe(correctPmFrom);
    // Specifically: correct is 13, naïve gives 11 (off by 2 = para1-close + para2-open).
    expect(correctPmFrom - naiveWrongPmFrom).toBe(2);
  });

  it("maps char offset of a word in para1 with a multi-byte char to the correct PM position", () => {
    // "café crême": 'crême' starts at index 5.
    const doc = makeDoc("café crême", "teh fox");
    const { segments, plain } = buildTextIndex(doc);

    const cremeOffset = plain.indexOf("crême");
    expect(cremeOffset).toBe(5); // "café " = 5 chars

    const from = charOffsetToPmPos(cremeOffset, segments);
    const to = charOffsetToPmPos(cremeOffset + "crême".length, segments);

    // PM pos 1 + 5 = 6 (paragraph open at 0, first char at 1).
    expect(from).toBe(1 + 5);
    expect(to).toBe(1 + 5 + "crême".length);
  });

  it("handles a single paragraph (no block boundary) without inserting a separator", () => {
    const doc = makeDoc("hello world");
    const { plain, segments } = buildTextIndex(doc);

    expect(plain).toBe("hello world");
    expect(segments).toHaveLength(1);
    expect(segments[0].pmStart).toBe(1);
    expect(segments[0].plainStart).toBe(0);

    const worldOffset = plain.indexOf("world");
    const from = charOffsetToPmPos(worldOffset, segments);
    expect(from).toBe(1 + worldOffset);
  });

  it("returns empty plain and no segments for a doc with an empty paragraph", () => {
    // Empty paragraph has no text node — no segments produced.
    const doc = testSchema.node("doc", null, [
      testSchema.node("paragraph", null, []),
    ]);
    const { plain, segments } = buildTextIndex(doc);

    expect(plain).toBe("");
    expect(segments).toHaveLength(0);
  });
});
