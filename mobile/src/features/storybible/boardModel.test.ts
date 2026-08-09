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
    expect(model.cards[0]).toMatchObject({ id: "q", x: 20, y: 44, graduated: true });
    expect(model.cards[0].text).toBe("Question: Why does Aldis stay?");
    expect(model.connections).toEqual([{ id: "edge", from: "q", to: "answer" }]);
  });

  // The board doc records no card kind — see the note on BoardCard. A card
  // whose text happens to begin "Question:" must not acquire a type from it,
  // and neither must its position in the map.
  it("does not invent a card kind from text or ordering", () => {
    const doc = new Y.Doc();
    for (const id of ["a", "b", "c"]) {
      doc.getMap("cards").set(id, { x: 0, y: 0 });
      const paragraph = new Y.XmlElement("paragraph"); const text = new Y.XmlText();
      text.insert(0, id === "a" ? "Question: does this get typed?" : "plain card");
      paragraph.insert(0, [text]); doc.getXmlFragment(`card-${id}`).push([paragraph]);
    }
    const model = decodeBoard(fromUint8Array(Y.encodeStateAsUpdate(doc)));
    expect(model.cards).toHaveLength(3);
    for (const card of model.cards) expect(card).not.toHaveProperty("kind");
  });
});
