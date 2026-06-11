import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  createBoardCard,
  getCardFragment,
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
});
