import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { addBoardCard, decodeBoardDoc, deleteBoardCard, encodeBoardDoc, setBoardCardText } from "./boardEdits";
import { decodeBoard } from "./boardModel";
import { BOARD_GRID_ORIGIN } from "./boardPlacement";

/** Round-trip through base64 exactly as `board_docs.state_base64` does. */
function reopen(doc: Y.Doc): Y.Doc {
  return decodeBoardDoc(encodeBoardDoc(doc));
}

/** The shape desktop's TipTap binds to: <paragraph><text>…</text></paragraph>. */
function paragraphs(doc: Y.Doc, cardId: string): string[] {
  const fragment = doc.getXmlFragment(`card-${cardId}`);
  const lines: string[] = [];
  for (let index = 0; index < fragment.length; index += 1) {
    const node = fragment.get(index);
    expect(node).toBeInstanceOf(Y.XmlElement);
    const element = node as Y.XmlElement;
    expect(element.nodeName).toBe("paragraph");
    expect(element.length).toBe(1);
    expect(element.get(0)).toBeInstanceOf(Y.XmlText);
    lines.push((element.get(0) as Y.XmlText).toString());
  }
  return lines;
}

describe("addBoardCard", () => {
  it("writes plain-JSON metadata and a top-level paragraph fragment that survive a re-decode", () => {
    const doc = new Y.Doc();
    addBoardCard(doc, "What if the lighthouse is lying?", "card-1");

    const stored = reopen(doc);
    const meta = stored.getMap("cards").get("card-1");
    // Load-bearing: a nested Y.Map here is unreachable from desktop's TipTap.
    expect(meta).not.toBeInstanceOf(Y.Map);
    expect(meta).toEqual({ x: BOARD_GRID_ORIGIN.x, y: BOARD_GRID_ORIGIN.y });
    expect(paragraphs(stored, "card-1")).toEqual(["What if the lighthouse is lying?"]);
    expect(decodeBoard(encodeBoardDoc(doc)).cards).toEqual([{
      id: "card-1", x: BOARD_GRID_ORIGIN.x, y: BOARD_GRID_ORIGIN.y,
      text: "What if the lighthouse is lying?", entityRef: undefined, graduated: false, destinationId: undefined,
    }]);
  });

  it("splits multi-line text into one paragraph per non-blank line", () => {
    const doc = new Y.Doc();
    addBoardCard(doc, "first\n\n  \nsecond", "card-1");
    expect(paragraphs(reopen(doc), "card-1")).toEqual(["first", "second"]);
  });

  it("registers the fragment even for an empty card", () => {
    const doc = new Y.Doc();
    addBoardCard(doc, "", "card-1");
    const stored = reopen(doc);
    expect(stored.getMap("cards").has("card-1")).toBe(true);
    expect(stored.getXmlFragment("card-card-1").length).toBe(0);
  });

  it("places each new card clear of the cards already on the board", () => {
    const doc = new Y.Doc();
    doc.getMap("cards").set("existing", { x: 640, y: 480 });
    addBoardCard(doc, "one", "card-1");
    addBoardCard(doc, "two", "card-2");
    const positions = [...reopen(doc).getMap<{ x: number; y: number }>("cards").values()];
    expect(positions).toHaveLength(3);
    for (const [index, a] of positions.entries()) {
      for (const b of positions.slice(index + 1)) {
        expect(Math.abs(a.x - b.x) >= 264 || Math.abs(a.y - b.y) >= 140).toBe(true);
      }
    }
  });
});

describe("round-tripping a desktop-written board", () => {
  it("carries fields mobile does not model through an unrelated edit", () => {
    const desktop = new Y.Doc();
    desktop.getMap("cards").set("card-1", {
      x: 40, y: 60, graduated: true, destinationKind: "scene", destinationId: "scene-7",
    });
    desktop.getMap("connections").set("edge", { from: "card-1", to: "card-1" });

    // Mobile loads the blob, adds a card, writes it back.
    const mobile = decodeBoardDoc(encodeBoardDoc(desktop));
    addBoardCard(mobile, "mobile card", "card-2");
    const stored = reopen(mobile);

    expect(stored.getMap("cards").get("card-1")).toEqual({
      x: 40, y: 60, graduated: true, destinationKind: "scene", destinationId: "scene-7",
    });
    expect(stored.getMap("connections").get("edge")).toEqual({ from: "card-1", to: "card-1" });
  });
});

describe("setBoardCardText", () => {
  it("replaces the text without moving the card or dropping its other metadata", () => {
    const doc = new Y.Doc();
    doc.getMap("cards").set("card-1", { x: 300, y: 220, entityRef: "entity-9" });
    setBoardCardText(doc, "card-1", "rewritten");
    setBoardCardText(doc, "card-1", "rewritten twice");

    const stored = reopen(doc);
    expect(stored.getMap("cards").get("card-1")).toEqual({ x: 300, y: 220, entityRef: "entity-9" });
    expect(paragraphs(stored, "card-1")).toEqual(["rewritten twice"]);
  });

  it("ignores a card that is not on the board", () => {
    const doc = new Y.Doc();
    setBoardCardText(doc, "ghost", "nope");
    expect(reopen(doc).getXmlFragment("card-ghost").length).toBe(0);
  });
});

describe("deleteBoardCard", () => {
  it("cascades to every connection touching the card and leaves the rest intact", () => {
    const doc = new Y.Doc();
    addBoardCard(doc, "doomed", "card-1");
    addBoardCard(doc, "kept", "card-2");
    addBoardCard(doc, "also kept", "card-3");
    doc.getMap("connections").set("edge-in", { from: "card-2", to: "card-1" });
    doc.getMap("connections").set("edge-out", { from: "card-1", to: "card-3" });
    doc.getMap("connections").set("edge-other", { from: "card-2", to: "card-3" });

    deleteBoardCard(doc, "card-1");

    const model = decodeBoard(encodeBoardDoc(doc));
    expect(model.cards.map((card) => card.id).sort()).toEqual(["card-2", "card-3"]);
    expect(model.connections).toEqual([{ id: "edge-other", from: "card-2", to: "card-3" }]);
    expect(reopen(doc).getXmlFragment("card-card-1").length).toBe(0);
  });
});
