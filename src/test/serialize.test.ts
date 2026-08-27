import { describe, expect,it } from "vitest";
import * as Y from "yjs";

import { applyEncoded,encodeDoc, extractPlainText } from "../yjs/serialize";

/** Build a doc with the given text in a single XmlFragment paragraph. */
function docWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return doc;
}

describe("yjs serialize", () => {
  it("round-trips a document's text through base64", () => {
    const source = docWithText("Mara stood at the river.");

    const base64 = encodeDoc(source);
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(0);

    const restored = new Y.Doc();
    applyEncoded(restored, base64);

    const restoredText = (
      restored.getXmlFragment("content").firstChild as Y.XmlElement
    ).firstChild as Y.XmlText;
    expect(restoredText.toString()).toBe("Mara stood at the river.");
  });

  it("produces a string safe for large documents (no stack overflow)", () => {
    const source = docWithText("x".repeat(200_000));
    const base64 = encodeDoc(source);
    const restored = new Y.Doc();
    applyEncoded(restored, base64);
    expect(extractPlainText(restored).length).toBe(200_000);
  });

  it("extracts nested list items with newline separators (no glued words)", () => {
    const doc = new Y.Doc();
    const frag = doc.getXmlFragment("content");
    const list = new Y.XmlElement("bulletList");

    const item1 = new Y.XmlElement("listItem");
    const p1 = new Y.XmlElement("paragraph");
    const t1 = new Y.XmlText();
    t1.insert(0, "apple");
    p1.insert(0, [t1]);
    item1.insert(0, [p1]);

    const item2 = new Y.XmlElement("listItem");
    const p2 = new Y.XmlElement("paragraph");
    const t2 = new Y.XmlText();
    t2.insert(0, "banana");
    p2.insert(0, [t2]);
    item2.insert(0, [p2]);

    list.insert(0, [item1, item2]);
    frag.insert(0, [list]);

    expect(extractPlainText(doc)).toBe("apple\nbanana");
  });

  it("extracts nested blockquote paragraphs with newline separators", () => {
    const doc = new Y.Doc();
    const frag = doc.getXmlFragment("content");
    const bq = new Y.XmlElement("blockquote");

    const p1 = new Y.XmlElement("paragraph");
    const t1 = new Y.XmlText();
    t1.insert(0, "Line 1");
    p1.insert(0, [t1]);

    const p2 = new Y.XmlElement("paragraph");
    const t2 = new Y.XmlText();
    t2.insert(0, "Line 2");
    p2.insert(0, [t2]);

    bq.insert(0, [p1, p2]);
    frag.insert(0, [bq]);

    expect(extractPlainText(doc)).toBe("Line 1\nLine 2");
  });
});
