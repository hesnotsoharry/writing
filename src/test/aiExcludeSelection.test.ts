/**
 * Oracle: extractAiSafeSelection — pure PM helper (W52 Phase 2).
 *
 * Builds a minimal ProseMirror document with an `aiExclude` mark and asserts
 * the helper replaces marked ranges with AI_HIDDEN_PLACEHOLDER while leaving
 * plain text untouched. No editor mount required.
 */
import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { extractAiSafeSelection } from "../editor/aiSafeSelection";
import { AI_HIDDEN_PLACEHOLDER } from "../yjs/serialize";

// ── Minimal schema ────────────────────────────────────────────────────────────
// Mirrors the shape TipTap creates: doc → paragraph → text, with an aiExclude mark.
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
  },
  marks: {
    aiExclude: {},
  },
});

/** Build a paragraph containing a sequence of { text, marked? } runs. */
function buildDoc(...runs: { text: string; marked?: boolean }[]) {
  const nodes = runs.map(({ text, marked }) => {
    const marks = marked ? [schema.mark("aiExclude")] : [];
    return schema.text(text, marks);
  });
  return schema.node("doc", null, [schema.node("paragraph", null, nodes)]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("extractAiSafeSelection", () => {
  it("returns plain text unchanged when no aiExclude marks present", () => {
    const doc = buildDoc({ text: "Plain text here." });
    // select the full paragraph content: pos 1 (start of paragraph content) to end
    const from = 1;
    const to = doc.content.size - 1;
    const result = extractAiSafeSelection(doc, from, to);
    expect(result).toBe("Plain text here.");
    expect(result).not.toContain(AI_HIDDEN_PLACEHOLDER);
  });

  it("replaces a marked run with placeholder, leaving surrounding text intact", () => {
    const doc = buildDoc(
      { text: "Before. " },
      { text: "SECRET", marked: true },
      { text: " After." },
    );
    const from = 1;
    const to = doc.content.size - 1;
    const result = extractAiSafeSelection(doc, from, to);
    expect(result).toContain("Before.");
    expect(result).toContain(AI_HIDDEN_PLACEHOLDER);
    expect(result).toContain("After.");
    expect(result).not.toContain("SECRET");
  });

  it("replaces multiple marked runs, each with a placeholder", () => {
    const doc = buildDoc(
      { text: "A " },
      { text: "REDACT1", marked: true },
      { text: " B " },
      { text: "REDACT2", marked: true },
      { text: " C" },
    );
    const from = 1;
    const to = doc.content.size - 1;
    const result = extractAiSafeSelection(doc, from, to);
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).toContain("C");
    expect(result).not.toContain("REDACT1");
    expect(result).not.toContain("REDACT2");
    // Two separate marked runs → two placeholders
    const placeholderCount = result.split(AI_HIDDEN_PLACEHOLDER).length - 1;
    expect(placeholderCount).toBe(2);
  });

  it("handles a selection that is only the marked range — full replacement", () => {
    const doc = buildDoc(
      { text: "Intro. " },
      { text: "EXPLICIT", marked: true },
      { text: " End." },
    );
    // Select only the marked node: it starts at pos 8 (after "Intro. ") inside para
    const introLen = "Intro. ".length;
    const markedLen = "EXPLICIT".length;
    const from = 1 + introLen;
    const to = 1 + introLen + markedLen;
    const result = extractAiSafeSelection(doc, from, to);
    expect(result).toBe(AI_HIDDEN_PLACEHOLDER);
    expect(result).not.toContain("EXPLICIT");
    expect(result).not.toContain("Intro");
    expect(result).not.toContain("End");
  });

  it("mid-node start: selection starting inside an unmarked node returns only the selected slice", () => {
    // Doc: "ABCDE" (plain) + "SECRET" (marked)
    // Select from pos 3 (char index 2 of "ABCDE", i.e. "C") to end of plain run (pos 6)
    // Expected: "CDE" (slice of "ABCDE"), NOT "ABCDE" (full node text)
    const doc = buildDoc({ text: "ABCDE" }, { text: "SECRET", marked: true });
    // para at pos 0, "ABCDE" text node at pos 1 (chars 1-5), "SECRET" at pos 6 (chars 6-11)
    const from = 3; // into "ABCDE": offset 2 → "CDE" remaining
    const to = 6;   // end of "ABCDE" (exclusive of "SECRET")
    const result = extractAiSafeSelection(doc, from, to);
    expect(result).toBe("CDE");
    expect(result).not.toContain("AB");
    expect(result).not.toContain(AI_HIDDEN_PLACEHOLDER);
  });

  it("mid-node end: selection ending inside a marked node emits exactly one placeholder", () => {
    // Doc: "Before" (plain) + "SECRETSECRET" (marked 12 chars)
    // Select the full plain run + the first 4 chars of the marked run
    // The entire marked node is aiExclude → should emit ONE placeholder (not per-char)
    const doc = buildDoc({ text: "Before" }, { text: "SECRETSECRET", marked: true });
    // "Before" at pos 1 (len 6, ends at pos 7), "SECRETSECRET" at pos 7
    const from = 1;   // start of "Before"
    const to = 11;    // 4 chars into "SECRETSECRET" (pos 7+4=11)
    const result = extractAiSafeSelection(doc, from, to);
    expect(result).toBe("Before" + AI_HIDDEN_PLACEHOLDER);
    expect(result).not.toContain("SECRET");
    // Exactly one placeholder even though we only selected part of the marked node
    expect(result.split(AI_HIDDEN_PLACEHOLDER).length - 1).toBe(1);
  });

  it("placeholder constant is exactly the documented string", () => {
    expect(AI_HIDDEN_PLACEHOLDER).toBe("[passage hidden by author]");
  });
});
