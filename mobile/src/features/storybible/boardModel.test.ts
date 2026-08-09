import { fromUint8Array } from "js-base64";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { decodeBoard } from "./boardModel";

describe("decodeBoard", () => {
  it("reads card text, positions, graduation, and connections from the Yjs board", () => {
    const doc = new Y.Doc();
    doc.getMap("cards").set("q", { x: 20, y: 44, graduated: true, destinationId: "scene-1" });
    const paragraph = new Y.XmlElement("paragraph"); const text = new Y.XmlText();
    text.insert(0, "Question: Why does Aldis stay?"); paragraph.insert(0, [text]); doc.getXmlFragment("card-q").push([paragraph]);
    doc.getMap("connections").set("edge", { from: "q", to: "answer" });
    const model = decodeBoard(fromUint8Array(Y.encodeStateAsUpdate(doc)));
    expect(model.cards[0]).toMatchObject({ id: "q", x: 20, y: 44, kind: "Question", graduated: true });
    expect(model.cards[0].text).toBe("Question: Why does Aldis stay?");
    expect(model.connections).toEqual([{ id: "edge", from: "q", to: "answer" }]);
  });
});
