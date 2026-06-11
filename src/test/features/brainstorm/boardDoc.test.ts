import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  addConnection,
  createBoardCard,
  createEntityCard,
  getCardFragment,
  getCardText,
  markCardGraduated,
  removeCard,
  removeConnection,
  removeConnectionsForCard,
  updateCardPosition,
} from "../../../features/brainstorm/boardDoc";
import { applyEncoded, encodeDoc } from "../../../yjs/serialize";

describe("boardDoc", () => {
  describe("createBoardCard", () => {
    it("creates a card with plain JSON metadata in doc.getMap('cards')", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-1";
      const pos = { x: 150, y: 200 };

      // Act
      createBoardCard(doc, cardId, pos);

      // Assert: Metadata is stored in doc.getMap('cards')[cardId] as plain JSON.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({ x: 150, y: 200 });
    });

    it("stores metadata as plain JSON, not a Y.Map or Y.XmlFragment", () => {
      // This asserts Decision 2's schema requirement: card metadata must be plain JSON
      // so that it is safe to merge in a CRDT environment without nested Y types.
      const doc = new Y.Doc();
      const cardId = "card-2";
      const pos = { x: 50, y: 100 };

      createBoardCard(doc, cardId, pos);

      const metadata = doc.getMap("cards").get(cardId);

      // Assert the metadata is NOT a Y type.
      expect(metadata).not.toBeInstanceOf(Y.Map);
      expect(metadata).not.toBeInstanceOf(Y.XmlFragment);
      expect(metadata).not.toBeInstanceOf(Y.XmlElement);
      expect(metadata).not.toBeInstanceOf(Y.XmlText);

      // Assert it is plain JSON (a plain object with x and y).
      expect(typeof metadata).toBe("object");
      expect(metadata.x).toBe(50);
      expect(metadata.y).toBe(100);
    });

    it("creates a top-level XmlFragment at doc.getXmlFragment('card-<id>')", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-text-1";

      // Act
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Assert: The fragment exists and is reachable at the top level.
      const fragment = doc.getXmlFragment(`card-${cardId}`);
      expect(fragment).toBeInstanceOf(Y.XmlFragment);
      expect(fragment.length).toBe(0); // Empty initially.
    });
  });

  describe("getCardFragment", () => {
    it("returns the card's top-level XmlFragment by cardId", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-fetch";
      createBoardCard(doc, cardId, { x: 10, y: 20 });

      // Act
      const fragment = getCardFragment(doc, cardId);

      // Assert: Fragment is the top-level one.
      expect(fragment).toBeInstanceOf(Y.XmlFragment);
      expect(fragment).toBe(doc.getXmlFragment(`card-${cardId}`));
    });

    it("returns the same fragment object across multiple calls", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-same";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Act
      const fragment1 = getCardFragment(doc, cardId);
      const fragment2 = getCardFragment(doc, cardId);

      // Assert: They are the same object (reference equality).
      expect(fragment1).toBe(fragment2);
    });
  });

  describe("Schema round-trip (encodeDoc → applyUpdate → read back)", () => {
    it("preserves card metadata and fragments through a full encode-decode cycle", () => {
      // Arrange: Create a board with a card, encode it.
      const doc1 = new Y.Doc();
      const cardId = "card-persist";
      const pos = { x: 250, y: 350 };

      createBoardCard(doc1, cardId, pos);

      // Add some text to the card's fragment (simulating user typing).
      const frag1 = getCardFragment(doc1, cardId);
      const para = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "Test card content");
      para.insert(0, [text]);
      frag1.push([para]);

      // Encode the doc.
      const base64 = encodeDoc(doc1);

      // Act: Decode into a new doc and read the schema back.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Metadata is preserved.
      const metadata = doc2.getMap("cards").get(cardId);
      expect(metadata).toEqual({ x: 250, y: 350 });

      // Assert: Fragment is preserved and contains the text.
      const frag2 = getCardFragment(doc2, cardId);
      expect(frag2).toBeInstanceOf(Y.XmlFragment);
      expect(frag2.length).toBe(1);

      const para2 = frag2.get(0) as Y.XmlElement;
      expect(para2).toBeInstanceOf(Y.XmlElement);
      const text2 = para2.get(0) as Y.XmlText;
      expect(text2.toString()).toContain("Test card content");
    });

    it("top-level fragment name is exactly 'card-<cardId>'", () => {
      // Verifies the schema decision: TipTap Collaboration `field:` must match
      // a top-level fragment name, so nested fragments don't work.
      const doc = new Y.Doc();
      const cardId = "card-schema-test";

      createBoardCard(doc, cardId, { x: 0, y: 0 });

      const base64 = encodeDoc(doc);

      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: The fragment is at the top level under the exact name.
      const frag = doc2.getXmlFragment(`card-${cardId}`);
      expect(frag).toBeInstanceOf(Y.XmlFragment);

      // Assert: No nested structure — it's a direct child of the doc.
      // (Verify by checking that getMap('cards')[cardId] doesn't contain a fragment.)
      const metadata = doc2.getMap("cards").get(cardId);
      expect(metadata).not.toBeInstanceOf(Y.XmlFragment);
    });

    it("multiple cards can coexist without interference", () => {
      // Arrange
      const doc = new Y.Doc();
      const card1 = "card-a";
      const card2 = "card-b";

      createBoardCard(doc, card1, { x: 0, y: 0 });
      createBoardCard(doc, card2, { x: 100, y: 100 });

      // Act: Add text to each card.
      const frag1 = getCardFragment(doc, card1);
      const text1 = new Y.XmlText();
      text1.insert(0, "Card A text");
      frag1.push([text1]);

      const frag2 = getCardFragment(doc, card2);
      const text2 = new Y.XmlText();
      text2.insert(0, "Card B text");
      frag2.push([text2]);

      // Encode and decode.
      const base64 = encodeDoc(doc);
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Both cards exist and their content is separate.
      const meta1 = doc2.getMap("cards").get(card1);
      const meta2 = doc2.getMap("cards").get(card2);

      expect(meta1).toEqual({ x: 0, y: 0 });
      expect(meta2).toEqual({ x: 100, y: 100 });

      const frag1Loaded = doc2.getXmlFragment(`card-${card1}`);
      const frag2Loaded = doc2.getXmlFragment(`card-${card2}`);

      expect(frag1Loaded.length).toBe(1);
      expect(frag2Loaded.length).toBe(1);

      const t1 = (frag1Loaded.get(0) as Y.XmlText)?.toString() || "";
      const t2 = (frag2Loaded.get(0) as Y.XmlText)?.toString() || "";

      expect(t1).toContain("Card A text");
      expect(t2).toContain("Card B text");
    });
  });

  describe("updateCardPosition (Phase 2)", () => {
    it("overwrites card metadata with new x, y position", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-drag-1";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Act
      updateCardPosition(doc, cardId, { x: 150, y: 250 });

      // Assert: Metadata is updated.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({ x: 150, y: 250 });
    });

    it("updates only the target card, leaving other cards untouched", () => {
      // Arrange
      const doc = new Y.Doc();
      createBoardCard(doc, "card-a", { x: 0, y: 0 });
      createBoardCard(doc, "card-b", { x: 100, y: 100 });

      // Act
      updateCardPosition(doc, "card-a", { x: 50, y: 75 });

      // Assert: Only card-a is updated; card-b is unchanged.
      expect(doc.getMap("cards").get("card-a")).toEqual({ x: 50, y: 75 });
      expect(doc.getMap("cards").get("card-b")).toEqual({ x: 100, y: 100 });
    });

    it("performs exactly one Y.Map set per call (no per-move writes)", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-single-set";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Observe changes to the cards map.
      let changeCount = 0;
      doc.getMap("cards").observe(() => {
        changeCount += 1;
      });

      // Act: Update position once.
      updateCardPosition(doc, cardId, { x: 200, y: 300 });

      // Assert: Exactly one change event fired (one set call).
      expect(changeCount).toBe(1);
    });

    it("preserves position as plain JSON, not a Y type", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-plain-json";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Act
      updateCardPosition(doc, cardId, { x: 75, y: 125 });

      // Assert: Metadata is still plain JSON.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).not.toBeInstanceOf(Y.Map);
      expect(metadata).not.toBeInstanceOf(Y.XmlFragment);
      expect(typeof metadata).toBe("object");
      expect(metadata.x).toBe(75);
      expect(metadata.y).toBe(125);
    });

    it("preserves graduation fields when updating position", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-grad-update";
      createBoardCard(doc, cardId, { x: 100, y: 200 });

      // Mark card as graduated with destination
      markCardGraduated(doc, cardId, { kind: "scene" as const, id: "scene-9" });

      // Act: Update position after graduation
      updateCardPosition(doc, cardId, { x: 555, y: 666 });

      // Assert: Graduation fields are preserved along with new position
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({
        x: 555,
        y: 666,
        graduated: true,
        destinationKind: "scene",
        destinationId: "scene-9",
      });
    });
  });

  describe("removeCard (Phase 2)", () => {
    it("removes card metadata from cards map", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-remove-1";
      createBoardCard(doc, cardId, { x: 100, y: 200 });

      // Act
      removeCard(doc, cardId);

      // Assert: Card metadata is gone.
      expect(doc.getMap("cards").get(cardId)).toBeUndefined();
    });

    it("clears the card's top-level XmlFragment content", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-clear-frag";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Add some text to the fragment.
      const frag = getCardFragment(doc, cardId);
      const text = new Y.XmlText();
      text.insert(0, "Temporary content");
      frag.push([text]);

      expect(frag.length).toBe(1);

      // Act
      removeCard(doc, cardId);

      // Assert: Fragment is cleared.
      const fragAfter = doc.getXmlFragment(`card-${cardId}`);
      expect(fragAfter.length).toBe(0);
    });

    it("does not affect other cards' metadata or fragments", () => {
      // Arrange
      const doc = new Y.Doc();
      createBoardCard(doc, "card-1", { x: 0, y: 0 });
      createBoardCard(doc, "card-2", { x: 100, y: 100 });

      // Add content to both.
      const frag1 = getCardFragment(doc, "card-1");
      const text1 = new Y.XmlText();
      text1.insert(0, "Card 1 content");
      frag1.push([text1]);

      const frag2 = getCardFragment(doc, "card-2");
      const text2 = new Y.XmlText();
      text2.insert(0, "Card 2 content");
      frag2.push([text2]);

      // Act: Remove card-1.
      removeCard(doc, "card-1");

      // Assert: Card-2 is unaffected.
      expect(doc.getMap("cards").get("card-2")).toEqual({ x: 100, y: 100 });
      const frag2After = doc.getXmlFragment("card-card-2");
      expect(frag2After.length).toBe(1);
      expect((frag2After.get(0) as Y.XmlText)?.toString()).toContain("Card 2 content");
    });

    it("survives encode-decode round-trip (removes card and preserves other cards)", () => {
      // Arrange
      const doc1 = new Y.Doc();
      createBoardCard(doc1, "card-x", { x: 10, y: 20 });
      createBoardCard(doc1, "card-y", { x: 30, y: 40 });

      getCardFragment(doc1, "card-x").push([new Y.XmlText("X text")]);
      getCardFragment(doc1, "card-y").push([new Y.XmlText("Y text")]);

      removeCard(doc1, "card-x");

      const base64 = encodeDoc(doc1);

      // Act: Decode.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: card-x is gone; card-y persists.
      expect(doc2.getMap("cards").get("card-x")).toBeUndefined();
      expect(doc2.getMap("cards").get("card-y")).toEqual({ x: 30, y: 40 });

      const frag2 = doc2.getXmlFragment("card-card-y");
      expect(frag2.length).toBe(1);
      expect((frag2.get(0) as Y.XmlText)?.toString()).toContain("Y text");
    });
  });

  describe("addConnection (Phase 3)", () => {
    it("stores connection as plain JSON { from, to } in doc.getMap('connections')", () => {
      // Arrange
      const doc = new Y.Doc();
      const connectionId = "conn-1";
      const from = "card-a";
      const to = "card-b";

      // Act
      addConnection(doc, connectionId, from, to);

      // Assert: Connection is stored in doc.getMap('connections')[connectionId].
      const connection = doc.getMap("connections").get(connectionId);
      expect(connection).toEqual({ from, to });
    });

    it("stores connection metadata as plain JSON, not a Y.Map or Y.XmlFragment", () => {
      // This asserts Decision 2's schema requirement: connection metadata must be plain JSON
      // so that it is safe to merge in a CRDT environment without nested Y types.
      const doc = new Y.Doc();
      const connectionId = "conn-plain";
      const from = "card-x";
      const to = "card-y";

      addConnection(doc, connectionId, from, to);

      const connection = doc.getMap("connections").get(connectionId);

      // Assert the connection is NOT a Y type.
      expect(connection).not.toBeInstanceOf(Y.Map);
      expect(connection).not.toBeInstanceOf(Y.XmlFragment);
      expect(connection).not.toBeInstanceOf(Y.XmlElement);
      expect(connection).not.toBeInstanceOf(Y.XmlText);

      // Assert it is plain JSON with from and to fields.
      expect(typeof connection).toBe("object");
      expect(connection.from).toBe("card-x");
      expect(connection.to).toBe("card-y");
    });

    it("does not affect other connections in the map", () => {
      // Arrange
      const doc = new Y.Doc();
      addConnection(doc, "conn-1", "card-a", "card-b");
      addConnection(doc, "conn-2", "card-c", "card-d");

      // Act: Add a third connection.
      addConnection(doc, "conn-3", "card-e", "card-f");

      // Assert: All three exist and are unchanged.
      expect(doc.getMap("connections").get("conn-1")).toEqual({
        from: "card-a",
        to: "card-b",
      });
      expect(doc.getMap("connections").get("conn-2")).toEqual({
        from: "card-c",
        to: "card-d",
      });
      expect(doc.getMap("connections").get("conn-3")).toEqual({
        from: "card-e",
        to: "card-f",
      });
    });
  });

  describe("removeConnection (Phase 3)", () => {
    it("removes connection from doc.getMap('connections')", () => {
      // Arrange
      const doc = new Y.Doc();
      const connectionId = "conn-remove-1";
      addConnection(doc, connectionId, "card-a", "card-b");

      // Act
      removeConnection(doc, connectionId);

      // Assert: Connection is gone.
      expect(doc.getMap("connections").get(connectionId)).toBeUndefined();
    });

    it("does not affect other connections in the map", () => {
      // Arrange
      const doc = new Y.Doc();
      addConnection(doc, "conn-1", "card-a", "card-b");
      addConnection(doc, "conn-2", "card-c", "card-d");
      addConnection(doc, "conn-3", "card-e", "card-f");

      // Act: Remove conn-2.
      removeConnection(doc, "conn-2");

      // Assert: conn-1 and conn-3 are intact; conn-2 is gone.
      expect(doc.getMap("connections").get("conn-1")).toEqual({
        from: "card-a",
        to: "card-b",
      });
      expect(doc.getMap("connections").get("conn-2")).toBeUndefined();
      expect(doc.getMap("connections").get("conn-3")).toEqual({
        from: "card-e",
        to: "card-f",
      });
    });
  });

  describe("removeConnectionsForCard (Phase 3 cascade)", () => {
    it("removes only the card's outgoing and incoming connections", () => {
      // Arrange
      const doc = new Y.Doc();
      createBoardCard(doc, "A", { x: 0, y: 0 });
      createBoardCard(doc, "B", { x: 100, y: 100 });
      createBoardCard(doc, "C", { x: 200, y: 200 });

      addConnection(doc, "c1", "A", "B");
      addConnection(doc, "c2", "B", "C");
      addConnection(doc, "c3", "A", "C");

      // Verify setup
      expect(doc.getMap("connections").get("c1")).toBeDefined();
      expect(doc.getMap("connections").get("c2")).toBeDefined();
      expect(doc.getMap("connections").get("c3")).toBeDefined();

      // Act: Remove connections for card A
      removeConnectionsForCard(doc, "A");

      // Assert: c1 and c3 (involving A) are gone; c2 (B→C) remains
      expect(doc.getMap("connections").get("c1")).toBeUndefined();
      expect(doc.getMap("connections").get("c3")).toBeUndefined();
      expect(doc.getMap("connections").get("c2")).toEqual({
        from: "B",
        to: "C",
      });

      // Assert: Cards map is untouched
      expect(doc.getMap("cards").get("A")).toEqual({ x: 0, y: 0 });
      expect(doc.getMap("cards").get("B")).toEqual({ x: 100, y: 100 });
      expect(doc.getMap("cards").get("C")).toEqual({ x: 200, y: 200 });
    });
  });

  describe("Schema round-trip: connections (Phase 3)", () => {
    it("preserves connections through a full encode-decode cycle", () => {
      // Arrange: Create a board with cards and connections, encode it.
      const doc1 = new Y.Doc();
      createBoardCard(doc1, "card-a", { x: 0, y: 0 });
      createBoardCard(doc1, "card-b", { x: 100, y: 100 });

      addConnection(doc1, "conn-1", "card-a", "card-b");

      const base64 = encodeDoc(doc1);

      // Act: Decode into a new doc.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Connection is preserved.
      const connection = doc2.getMap("connections").get("conn-1");
      expect(connection).toEqual({ from: "card-a", to: "card-b" });
    });

    it("preserves multiple connections and cards through encode-decode", () => {
      // Arrange
      const doc1 = new Y.Doc();
      createBoardCard(doc1, "card-1", { x: 0, y: 0 });
      createBoardCard(doc1, "card-2", { x: 100, y: 100 });
      createBoardCard(doc1, "card-3", { x: 200, y: 200 });

      addConnection(doc1, "conn-a", "card-1", "card-2");
      addConnection(doc1, "conn-b", "card-2", "card-3");
      addConnection(doc1, "conn-c", "card-1", "card-3");

      const base64 = encodeDoc(doc1);

      // Act: Decode.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: All cards and connections are preserved.
      expect(doc2.getMap("cards").get("card-1")).toEqual({ x: 0, y: 0 });
      expect(doc2.getMap("cards").get("card-2")).toEqual({ x: 100, y: 100 });
      expect(doc2.getMap("cards").get("card-3")).toEqual({ x: 200, y: 200 });

      expect(doc2.getMap("connections").get("conn-a")).toEqual({
        from: "card-1",
        to: "card-2",
      });
      expect(doc2.getMap("connections").get("conn-b")).toEqual({
        from: "card-2",
        to: "card-3",
      });
      expect(doc2.getMap("connections").get("conn-c")).toEqual({
        from: "card-1",
        to: "card-3",
      });
    });

    it("preserves connection deletions through encode-decode", () => {
      // Arrange
      const doc1 = new Y.Doc();
      createBoardCard(doc1, "card-x", { x: 0, y: 0 });
      createBoardCard(doc1, "card-y", { x: 100, y: 100 });

      addConnection(doc1, "conn-1", "card-x", "card-y");
      addConnection(doc1, "conn-2", "card-y", "card-x");

      removeConnection(doc1, "conn-1");

      const base64 = encodeDoc(doc1);

      // Act: Decode.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: conn-1 is gone; conn-2 persists.
      expect(doc2.getMap("connections").get("conn-1")).toBeUndefined();
      expect(doc2.getMap("connections").get("conn-2")).toEqual({
        from: "card-y",
        to: "card-x",
      });
    });
  });

  describe("createEntityCard (Phase 4)", () => {
    it("creates an entity card with plain JSON metadata including entityRef", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "entity-card-1";
      const entityId = "entity-123";
      const pos = { x: 150, y: 200 };

      // Act
      createEntityCard(doc, cardId, entityId, pos);

      // Assert: Metadata is stored in doc.getMap('cards')[cardId] with entityRef.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({ x: 150, y: 200, entityRef: entityId });
    });

    it("stores entity card metadata as plain JSON, not a Y.Map or Y.XmlFragment", () => {
      // This asserts Decision 2/4: entity card metadata must be plain JSON
      // with entityRef field only — no name/type/title copied in.
      const doc = new Y.Doc();
      const cardId = "entity-card-plain";
      const entityId = "entity-456";
      const pos = { x: 50, y: 100 };

      createEntityCard(doc, cardId, entityId, pos);

      const metadata = doc.getMap("cards").get(cardId);

      // Assert the metadata is NOT a Y type.
      expect(metadata).not.toBeInstanceOf(Y.Map);
      expect(metadata).not.toBeInstanceOf(Y.XmlFragment);
      expect(metadata).not.toBeInstanceOf(Y.XmlElement);
      expect(metadata).not.toBeInstanceOf(Y.XmlText);

      // Assert it is plain JSON with only x, y, entityRef — no name/type/title.
      expect(typeof metadata).toBe("object");
      expect(metadata.x).toBe(50);
      expect(metadata.y).toBe(100);
      expect(metadata.entityRef).toBe("entity-456");
      expect(metadata.name).toBeUndefined();
      expect(metadata.type).toBeUndefined();
      expect(metadata.title).toBeUndefined();
    });

    it("does not create content in the card's text fragment (or creates empty fragment)", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "entity-card-no-text";
      const entityId = "entity-789";

      // Act
      createEntityCard(doc, cardId, entityId, { x: 0, y: 0 });

      // Assert: The fragment exists but has no content (length 0).
      // Entity cards in v1 have no free text.
      const fragment = doc.getXmlFragment(`card-${cardId}`);
      expect(fragment).toBeInstanceOf(Y.XmlFragment);
      expect(fragment.length).toBe(0);
    });

    it("regular cards (via createBoardCard) do NOT have entityRef", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "regular-card-1";
      const pos = { x: 100, y: 200 };

      // Act: Create a regular card.
      createBoardCard(doc, cardId, pos);

      // Assert: Metadata has no entityRef key.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({ x: 100, y: 200 });
      expect(metadata.entityRef).toBeUndefined();
    });

    it("removeCard works on entity cards (removes metadata entry)", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "entity-card-remove";
      const entityId = "entity-remove-test";
      createEntityCard(doc, cardId, entityId, { x: 50, y: 75 });

      // Verify it was created.
      expect(doc.getMap("cards").get(cardId)).toEqual({
        x: 50,
        y: 75,
        entityRef: entityId,
      });

      // Act
      removeCard(doc, cardId);

      // Assert: Entity card metadata is gone.
      expect(doc.getMap("cards").get(cardId)).toBeUndefined();
    });

    it("preserves entityRef through a full encode-decode round-trip", () => {
      // Arrange: Create an entity card, encode it.
      const doc1 = new Y.Doc();
      const cardId = "entity-persist";
      const entityId = "entity-persistent-123";
      const pos = { x: 300, y: 400 };

      createEntityCard(doc1, cardId, entityId, pos);

      const base64 = encodeDoc(doc1);

      // Act: Decode into a new doc.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Entity card metadata (including entityRef) is preserved.
      const metadata = doc2.getMap("cards").get(cardId);
      expect(metadata).toEqual({ x: 300, y: 400, entityRef: entityId });
      expect(metadata.entityRef).toBe(entityId);
    });

    it("entity and regular cards can coexist without interference", () => {
      // Arrange
      const doc = new Y.Doc();
      const regularCardId = "regular-mixed";
      const entityCardId = "entity-mixed";
      const entityId = "entity-mixed-ref";

      createBoardCard(doc, regularCardId, { x: 0, y: 0 });
      createEntityCard(doc, entityCardId, entityId, { x: 100, y: 100 });

      // Act: Encode and decode.
      const base64 = encodeDoc(doc);
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Regular card has no entityRef; entity card has entityRef.
      const regularMeta = doc2.getMap("cards").get(regularCardId);
      const entityMeta = doc2.getMap("cards").get(entityCardId);

      expect(regularMeta).toEqual({ x: 0, y: 0 });
      expect(regularMeta.entityRef).toBeUndefined();

      expect(entityMeta).toEqual({ x: 100, y: 100, entityRef: entityId });
      expect(entityMeta.entityRef).toBe(entityId);
    });

    it("removeCard clears entity card's fragment (if touched)", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "entity-card-clear";
      const entityId = "entity-clear-test";
      createEntityCard(doc, cardId, entityId, { x: 0, y: 0 });

      // Verify fragment exists but is empty.
      const fragBefore = doc.getXmlFragment(`card-${cardId}`);
      expect(fragBefore.length).toBe(0);

      // Act
      removeCard(doc, cardId);

      // Assert: Fragment remains empty (or is still empty if it was touched).
      const fragAfter = doc.getXmlFragment(`card-${cardId}`);
      expect(fragAfter.length).toBe(0);
    });
  });

  describe("getCardText (Phase 6)", () => {
    it("returns empty string for card with no fragment content", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-empty-text";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Act
      const text = getCardText(doc, cardId);

      // Assert: Empty fragment yields empty string.
      expect(text).toBe("");
    });

    it("returns empty string for card with absent fragment", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-nonexistent-text";

      // Act: Do NOT create the card. Just call getCardText on a non-existent cardId.
      const text = getCardText(doc, cardId);

      // Assert: Absent fragment yields empty string (safe default).
      expect(text).toBe("");
    });

    it("returns single paragraph text as-is", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-single-para";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Add a single paragraph with text.
      const frag = getCardFragment(doc, cardId);
      const para = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "Single paragraph content");
      para.insert(0, [text]);
      frag.push([para]);

      // Act
      const result = getCardText(doc, cardId);

      // Assert: Single paragraph is returned as-is.
      expect(result).toBe("Single paragraph content");
    });

    it("joins multiple paragraphs with newline", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-multi-para";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Add three paragraphs.
      const frag = getCardFragment(doc, cardId);

      const para1 = new Y.XmlElement("paragraph");
      const text1 = new Y.XmlText();
      text1.insert(0, "First paragraph");
      para1.insert(0, [text1]);
      frag.push([para1]);

      const para2 = new Y.XmlElement("paragraph");
      const text2 = new Y.XmlText();
      text2.insert(0, "Second paragraph");
      para2.insert(0, [text2]);
      frag.push([para2]);

      const para3 = new Y.XmlElement("paragraph");
      const text3 = new Y.XmlText();
      text3.insert(0, "Third paragraph");
      para3.insert(0, [text3]);
      frag.push([para3]);

      // Act
      const result = getCardText(doc, cardId);

      // Assert: Paragraphs are joined with '\n'.
      expect(result).toBe("First paragraph\nSecond paragraph\nThird paragraph");
    });

    it("extracts text from XmlText nodes within paragraphs", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-xml-text";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Add a paragraph with text content.
      const frag = getCardFragment(doc, cardId);
      const para = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "Text inside XmlText");
      para.insert(0, [text]);
      frag.push([para]);

      // Act
      const result = getCardText(doc, cardId);

      // Assert: XmlText content is extracted.
      expect(result).toBe("Text inside XmlText");
    });

    it("handles paragraphs with multiple XmlText nodes", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-multi-text-nodes";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Add a paragraph with multiple text nodes.
      const frag = getCardFragment(doc, cardId);
      const para = new Y.XmlElement("paragraph");
      const text1 = new Y.XmlText();
      text1.insert(0, "Part one");
      const text2 = new Y.XmlText();
      text2.insert(0, " Part two");
      para.insert(0, [text1, text2]);
      frag.push([para]);

      // Act
      const result = getCardText(doc, cardId);

      // Assert: Multiple text nodes are concatenated.
      expect(result).toBe("Part one Part two");
    });
  });

  describe("markCardGraduated (Phase 6)", () => {
    it("marks a regular card as graduated with destination (scene)", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-grad-1";
      createBoardCard(doc, cardId, { x: 100, y: 200 });

      const destination = { kind: "scene" as const, id: "scene-123" };

      // Act
      markCardGraduated(doc, cardId, destination);

      // Assert: Metadata now contains graduated flag and destination.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({
        x: 100,
        y: 200,
        graduated: true,
        destinationKind: "scene",
        destinationId: "scene-123",
      });
    });

    it("marks an entity card as graduated while preserving entityRef", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "entity-card-grad";
      const entityId = "entity-linked";
      createEntityCard(doc, cardId, entityId, { x: 50, y: 75 });

      const destination = { kind: "entity" as const, id: "entity-target" };

      // Act
      markCardGraduated(doc, cardId, destination);

      // Assert: Metadata preserves entityRef and adds graduated + destination.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({
        x: 50,
        y: 75,
        entityRef: entityId,
        graduated: true,
        destinationKind: "entity",
        destinationId: "entity-target",
      });
    });

    it("stores graduated metadata as plain JSON, not a Y.Map", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-plain-grad";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      const destination = { kind: "scene" as const, id: "scene-abc" };

      // Act
      markCardGraduated(doc, cardId, destination);

      // Assert: Metadata is plain JSON, not a Y type.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).not.toBeInstanceOf(Y.Map);
      expect(metadata).not.toBeInstanceOf(Y.XmlFragment);
      expect(typeof metadata).toBe("object");
      expect(metadata.graduated).toBe(true);
    });

    it("calling markCardGraduated again overwrites destination (last write wins)", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-idempotent";
      createBoardCard(doc, cardId, { x: 100, y: 200 });

      const dest1 = { kind: "scene" as const, id: "scene-first" };
      const dest2 = { kind: "entity" as const, id: "entity-second" };

      // Act: Mark graduated twice with different destinations.
      markCardGraduated(doc, cardId, dest1);
      markCardGraduated(doc, cardId, dest2);

      // Assert: Second destination wins; position is preserved; only one entry.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata).toEqual({
        x: 100,
        y: 200,
        graduated: true,
        destinationKind: "entity",
        destinationId: "entity-second",
      });

      // Assert: Still only one card entry (not duplicated).
      const cardCount = doc.getMap("cards").size;
      expect(cardCount).toBe(1);
    });

    it("preserves card text fragment after graduation", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-text-preserved";
      createBoardCard(doc, cardId, { x: 0, y: 0 });

      // Add text to the card.
      const frag = getCardFragment(doc, cardId);
      const para = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "Original card text");
      para.insert(0, [text]);
      frag.push([para]);

      const textBefore = getCardText(doc, cardId);

      // Act
      markCardGraduated(doc, cardId, { kind: "scene" as const, id: "scene-xyz" });

      // Assert: Text content is unchanged.
      const textAfter = getCardText(doc, cardId);
      expect(textAfter).toBe(textBefore);
      expect(textAfter).toBe("Original card text");
    });

    it("preserves position metadata after graduation", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardId = "card-pos-preserved";
      const pos = { x: 250, y: 350 };
      createBoardCard(doc, cardId, pos);

      // Act
      markCardGraduated(doc, cardId, { kind: "scene" as const, id: "scene-new" });

      // Assert: Position x, y are unchanged.
      const metadata = doc.getMap("cards").get(cardId);
      expect(metadata.x).toBe(250);
      expect(metadata.y).toBe(350);
    });

    it("does not affect other cards when marking one as graduated", () => {
      // Arrange
      const doc = new Y.Doc();
      createBoardCard(doc, "card-a", { x: 0, y: 0 });
      createBoardCard(doc, "card-b", { x: 100, y: 100 });

      // Act: Mark only card-a as graduated.
      markCardGraduated(doc, "card-a", {
        kind: "scene" as const,
        id: "scene-target",
      });

      // Assert: card-a is graduated; card-b is untouched.
      const metaA = doc.getMap("cards").get("card-a");
      const metaB = doc.getMap("cards").get("card-b");

      expect(metaA.graduated).toBe(true);
      expect(metaB.graduated).toBeUndefined();
      expect(metaB).toEqual({ x: 100, y: 100 });
    });

    it("preserves graduated state through encode-decode round-trip", () => {
      // Arrange: Create a card, mark it graduated, encode it.
      const doc1 = new Y.Doc();
      const cardId = "card-grad-persist";
      createBoardCard(doc1, cardId, { x: 200, y: 300 });

      markCardGraduated(doc1, cardId, {
        kind: "entity" as const,
        id: "entity-target",
      });

      const base64 = encodeDoc(doc1);

      // Act: Decode into a new doc.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Graduated state and destination are preserved.
      const metadata = doc2.getMap("cards").get(cardId);
      expect(metadata).toEqual({
        x: 200,
        y: 300,
        graduated: true,
        destinationKind: "entity",
        destinationId: "entity-target",
      });
    });

    it("preserves graduated entity cards through encode-decode", () => {
      // Arrange: Create an entity card, mark it graduated, encode it.
      const doc1 = new Y.Doc();
      const cardId = "entity-grad-persist";
      const entityId = "entity-source";
      createEntityCard(doc1, cardId, entityId, { x: 75, y: 125 });

      markCardGraduated(doc1, cardId, {
        kind: "scene" as const,
        id: "scene-target",
      });

      const base64 = encodeDoc(doc1);

      // Act: Decode.
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Entity card with graduation is fully preserved.
      const metadata = doc2.getMap("cards").get(cardId);
      expect(metadata).toEqual({
        x: 75,
        y: 125,
        entityRef: entityId,
        graduated: true,
        destinationKind: "scene",
        destinationId: "scene-target",
      });
    });

    it("graduated and regular cards coexist without interference", () => {
      // Arrange
      const doc = new Y.Doc();
      const cardGrad = "card-graduated";
      const cardRegular = "card-regular";

      createBoardCard(doc, cardGrad, { x: 0, y: 0 });
      createBoardCard(doc, cardRegular, { x: 50, y: 50 });

      // Act
      markCardGraduated(doc, cardGrad, {
        kind: "scene" as const,
        id: "scene-target",
      });

      // Encode and decode.
      const base64 = encodeDoc(doc);
      const doc2 = new Y.Doc();
      applyEncoded(doc2, base64);

      // Assert: Graduated card has graduation flag; regular card does not.
      const metaGrad = doc2.getMap("cards").get(cardGrad);
      const metaReg = doc2.getMap("cards").get(cardRegular);

      expect(metaGrad.graduated).toBe(true);
      expect(metaGrad.destinationKind).toBe("scene");

      expect(metaReg.graduated).toBeUndefined();
      expect(metaReg).toEqual({ x: 50, y: 50 });
    });
  });
});
