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
});
