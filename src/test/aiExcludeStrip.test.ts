import { describe, expect,it } from "vitest";
import * as Y from "yjs";

import {
  AI_HIDDEN_PLACEHOLDER,
  extractAiSafeText,
  extractPlainText,
} from "../yjs/serialize";

describe("aiExcludeStrip", () => {
  it("redacts marked runs and replaces with placeholder", () => {
    // Arrange: build a Y.Doc with three runs — plain, marked, plain
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("content");

    doc.transact(() => {
      const para = new Y.XmlElement("p");
      const text = new Y.XmlText();
      para.push([text]);
      fragment.push([para]);

      // Build the text first, then apply the mark via format() — mirrors how
      // TipTap's Collaboration extension stores marks (format() produces separate
      // delta ops for the marked vs unmarked ranges, unlike insert-with-attrs
      // which merges adjacent runs into one marked op).
      text.insert(0, "Start of story. ", undefined);
      text.insert(16, "Secret passage.", undefined);
      text.insert(31, " Continue reading.", undefined);
      text.format(16, 15, { aiExclude: true });
    });

    // Act
    const result = extractAiSafeText(doc);

    // Assert: placeholder present, marked text absent, plain text present
    expect(result).toContain(AI_HIDDEN_PLACEHOLDER);
    expect(result).toContain("Start of story.");
    expect(result).toContain("Continue reading.");
    expect(result).not.toContain("Secret passage.");
  });

  it("plaintext extractor ignores aiExclude marks and returns full text", () => {
    // Arrange: same structure as above — insert then format to mirror TipTap behavior
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("content");

    doc.transact(() => {
      const para = new Y.XmlElement("p");
      const text = new Y.XmlText();
      para.push([text]);
      fragment.push([para]);

      text.insert(0, "Start of story. ", undefined);
      text.insert(16, "Secret passage.", undefined);
      text.insert(31, " Continue reading.", undefined);
      text.format(16, 15, { aiExclude: true });
    });

    // Act
    const result = extractPlainText(doc);

    // Assert: all text present, including marked text
    expect(result).toContain("Start of story.");
    expect(result).toContain("Secret passage.");
    expect(result).toContain("Continue reading.");
    expect(result).not.toContain(AI_HIDDEN_PLACEHOLDER);
  });

  it("no marks → extractAiSafeText equals extractPlainText", () => {
    // Arrange: doc with no aiExclude marks
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("content");

    doc.transact(() => {
      const para = new Y.XmlElement("p");
      const text = new Y.XmlText();
      para.push([text]);
      fragment.push([para]);

      text.insert(0, "Plain text only.", undefined);
    });

    // Act
    const aiSafe = extractAiSafeText(doc);
    const plain = extractPlainText(doc);

    // Assert
    expect(aiSafe).toBe(plain);
  });

  it("multiple marked runs → multiple placeholders, all marked text hidden", () => {
    // Arrange: doc with two separate aiExclude runs
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("content");

    doc.transact(() => {
      const para = new Y.XmlElement("p");
      const text = new Y.XmlText();
      para.push([text]);
      fragment.push([para]);

      // Insert all text first, then apply marks via format() — mirrors TipTap behavior.
      text.insert(0, "Normal REDACT1 mid REDACT2 end.", undefined);
      text.format(7, 7, { aiExclude: true });   // "REDACT1" (7 chars starting at pos 7)
      text.format(19, 7, { aiExclude: true });  // "REDACT2" (7 chars starting at pos 19)
    });

    // Act
    const result = extractAiSafeText(doc);

    // Assert: both marked texts absent; exactly two placeholders (one per marked run)
    expect(result).toContain("Normal");
    expect(result).toContain("mid");
    expect(result).toContain("end.");
    expect(result).not.toContain("REDACT1");
    expect(result).not.toContain("REDACT2");
    // format() produces separate delta ops → exactly two replacements, not one merged.
    expect(result.split(AI_HIDDEN_PLACEHOLDER).length - 1).toBe(2);
  });

  it("placeholder string is exactly as documented", () => {
    // Assert the constant is the exact expected string
    expect(AI_HIDDEN_PLACEHOLDER).toBe("[passage hidden by author]");
  });
});
