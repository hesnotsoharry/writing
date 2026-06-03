import { describe, expect,it } from "vitest";
import * as Y from "yjs";

import { applyEncoded,encodeDoc } from "../yjs/serialize";

describe("yjs serialize", () => {
  it("round-trips a document's text through base64", () => {
    const source = new Y.Doc();
    source.getText("content").insert(0, "Mara stood at the river.");

    const base64 = encodeDoc(source);
    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(0);

    const restored = new Y.Doc();
    applyEncoded(restored, base64);

    expect(restored.getText("content").toString()).toBe(
      "Mara stood at the river."
    );
  });

  it("produces a string safe for large documents (no stack overflow)", () => {
    const source = new Y.Doc();
    source.getText("content").insert(0, "x".repeat(200_000));
    const base64 = encodeDoc(source);
    const restored = new Y.Doc();
    applyEncoded(restored, base64);
    expect(restored.getText("content").toString().length).toBe(200_000);
  });
});
