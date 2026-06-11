import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { InMemorySceneDocStore } from "../../../db/sceneDocStore";
import { createBoardCard } from "../../../features/brainstorm/boardDoc";
import { sendCardToScene } from "../../../features/brainstorm/sendToScene";
import { applyEncoded, encodeDoc } from "../../../yjs/serialize";

/**
 * Helper: populate a card fragment with one or more paragraphs.
 * Each text string becomes a paragraph node.
 */
function addParagraphsToCardFragment(
  boardDoc: Y.Doc,
  cardId: string,
  paragraphTexts: string[]
): void {
  const frag = boardDoc.getXmlFragment(`card-${cardId}`);
  for (const text of paragraphTexts) {
    const para = new Y.XmlElement("paragraph");
    const xmlText = new Y.XmlText();
    xmlText.insert(0, text);
    para.insert(0, [xmlText]);
    frag.push([para]);
  }
}

/**
 * Helper: populate a scene's content fragment with paragraphs.
 * Used to establish initial scene state in COLD path tests.
 */
function addParagraphsToSceneContent(
  sceneDoc: Y.Doc,
  paragraphTexts: string[]
): void {
  const frag = sceneDoc.getXmlFragment("content");
  for (const text of paragraphTexts) {
    const para = new Y.XmlElement("paragraph");
    const xmlText = new Y.XmlText();
    xmlText.insert(0, text);
    para.insert(0, [xmlText]);
    frag.push([para]);
  }
}

/**
 * Helper: extract text from a single Y.XmlElement (paragraph).
 * Concatenates all Y.XmlText children.
 */
function extractTextFromElement(element: Y.XmlElement): string {
  let text = "";
  for (let i = 0; i < element.length; i++) {
    const child = element.get(i);
    if (child instanceof Y.XmlText) {
      text += child.toString();
    }
  }
  return text;
}

/**
 * Helper: extract all paragraph text from a scene's content fragment.
 * Returns an array of paragraph texts (one per paragraph node).
 * Used to verify content in assertions.
 */
function extractParagraphTexts(sceneDoc: Y.Doc): string[] {
  const frag = sceneDoc.getXmlFragment("content");
  const texts: string[] = [];
  for (let i = 0; i < frag.length; i++) {
    const para = frag.get(i);
    if (para instanceof Y.XmlElement) {
      texts.push(extractTextFromElement(para));
    }
  }
  return texts;
}

describe("sendCardToScene", () => {
  describe("HOT path (liveDoc provided)", () => {
    it("appends card paragraph to the end of scene content", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const sceneDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-hot-1";
      const sceneId = "scene-hot-1";

      // Create card with one paragraph
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, ["Card paragraph text"]);

      // Create scene with initial paragraph
      addParagraphsToSceneContent(sceneDoc, ["Initial scene paragraph"]);

      // Act
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: sceneDoc,
      });

      // Assert: Scene now has 2 paragraphs (original + appended)
      const paragraphs = extractParagraphTexts(sceneDoc);
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toBe("Initial scene paragraph");
      expect(paragraphs[1]).toContain("Card paragraph text");

      // Assert: store.save NOT called (bindPersistence owns the save)
      expect(store.saveCount).toBe(0);
    });

    it("preserves appended card text + subsequent keystroke after encode/decode (data-loss check)", async () => {
      // This is the critical acceptance test for Decision 3:
      // sending a card to a live scene must not lose the appended content on the next keystroke.
      // Arrange
      const boardDoc = new Y.Doc();
      const sceneDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-data-loss-test";
      const sceneId = "scene-data-loss-test";

      // Create card with one paragraph
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, ["Appended card text"]);

      // Create scene with initial paragraph
      addParagraphsToSceneContent(sceneDoc, ["Original scene paragraph"]);

      // Act 1: Send card to scene
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: sceneDoc,
      });

      // Verify append succeeded
      const paragraphs = extractParagraphTexts(sceneDoc);
      expect(paragraphs).toHaveLength(2);

      // Act 2: Simulate a user keystroke by appending text to the last paragraph
      const contentFrag = sceneDoc.getXmlFragment("content");
      const lastPara = contentFrag.get(contentFrag.length - 1) as Y.XmlElement;
      expect(lastPara).toBeInstanceOf(Y.XmlElement);
      const lastText = lastPara.get(0) as Y.XmlText;
      expect(lastText).toBeInstanceOf(Y.XmlText);
      lastText.insert(lastText.length, " and user keystroke");

      // Act 3: Encode and decode the doc (simulates restart)
      const base64 = encodeDoc(sceneDoc);
      const freshDoc = new Y.Doc();
      applyEncoded(freshDoc, base64);

      // Assert: Both appended card AND keystroke text are present
      const finalParagraphs = extractParagraphTexts(freshDoc);
      expect(finalParagraphs).toHaveLength(2);
      expect(finalParagraphs[0]).toBe("Original scene paragraph");
      expect(finalParagraphs[1]).toContain("Appended card text");
      expect(finalParagraphs[1]).toContain("and user keystroke");
    });

    it("preserves multi-paragraph card structure", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const sceneDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-multi-para";
      const sceneId = "scene-multi-para";

      // Create card with 3 paragraphs
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, [
        "First paragraph of card",
        "Second paragraph of card",
        "Third paragraph of card",
      ]);

      // Create scene with one initial paragraph
      addParagraphsToSceneContent(sceneDoc, ["Original paragraph"]);

      // Act
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: sceneDoc,
      });

      // Assert: Scene now has 4 paragraphs (1 original + 3 from card), structure preserved
      const paragraphs = extractParagraphTexts(sceneDoc);
      expect(paragraphs).toHaveLength(4);
      expect(paragraphs[0]).toBe("Original paragraph");
      expect(paragraphs[1]).toBe("First paragraph of card");
      expect(paragraphs[2]).toBe("Second paragraph of card");
      expect(paragraphs[3]).toBe("Third paragraph of card");
    });

    it("appends to a scene with pre-existing paragraphs (order preserved)", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const sceneDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-order-test";
      const sceneId = "scene-order-test";

      // Create card
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, ["Card text"]);

      // Create scene with 2 existing paragraphs
      addParagraphsToSceneContent(sceneDoc, ["Scene paragraph 1", "Scene paragraph 2"]);

      // Act
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: sceneDoc,
      });

      // Assert: Original paragraphs come first, appended last
      const paragraphs = extractParagraphTexts(sceneDoc);
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toBe("Scene paragraph 1");
      expect(paragraphs[1]).toBe("Scene paragraph 2");
      expect(paragraphs[2]).toContain("Card text");
    });

    it("works with an initially empty scene", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const sceneDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-empty-scene";
      const sceneId = "scene-empty";

      // Create card
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, ["Card text to empty scene"]);

      // Scene has no content (fresh doc)

      // Act
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: sceneDoc,
      });

      // Assert: Scene now has 1 paragraph (the appended card)
      const paragraphs = extractParagraphTexts(sceneDoc);
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toContain("Card text to empty scene");
    });
  });

  describe("COLD path (liveDoc null or undefined)", () => {
    it("loads scene from store, appends card, and saves result", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-cold-1";
      const sceneId = "scene-cold-1";

      // Pre-populate store with an initial scene
      const initialSceneDoc = new Y.Doc();
      addParagraphsToSceneContent(initialSceneDoc, ["Initial scene paragraph"]);
      const initialBase64 = encodeDoc(initialSceneDoc);
      await store.save(sceneId, initialBase64, "Initial scene paragraph");

      // Create card
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, ["Appended card text"]);

      // Act: send with liveDoc = null (COLD path)
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: null,
      });

      // Assert: store.save was called exactly once
      expect(store.saveCount).toBe(2); // 1 for initial, 1 for append
      const saved = await store.load(sceneId);
      expect(saved).not.toBeNull();

      // Assert: saved content contains both original and appended
      const savedDoc = new Y.Doc();
      applyEncoded(savedDoc, saved!);
      const paragraphs = extractParagraphTexts(savedDoc);
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0]).toBe("Initial scene paragraph");
      expect(paragraphs[1]).toContain("Appended card text");
    });

    it("preserves multi-paragraph structure in COLD path", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-cold-multi";
      const sceneId = "scene-cold-multi";

      // Pre-populate store
      const initialSceneDoc = new Y.Doc();
      addParagraphsToSceneContent(initialSceneDoc, ["Initial paragraph"]);
      const initialBase64 = encodeDoc(initialSceneDoc);
      await store.save(sceneId, initialBase64, "Initial paragraph");

      // Create card with 2 paragraphs
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, [
        "Card paragraph 1",
        "Card paragraph 2",
      ]);

      // Act
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: undefined, // explicitly undefined
      });

      // Assert: saved content has 3 paragraphs (1 initial + 2 from card)
      const saved = await store.load(sceneId);
      const savedDoc = new Y.Doc();
      applyEncoded(savedDoc, saved!);
      const paragraphs = extractParagraphTexts(savedDoc);
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toBe("Initial paragraph");
      expect(paragraphs[1]).toBe("Card paragraph 1");
      expect(paragraphs[2]).toBe("Card paragraph 2");
    });

    it("loads a scene with no prior content and appends card", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-cold-to-empty";
      const sceneId = "scene-empty-store";

      // Store is empty for this sceneId (no prior save)

      // Create card
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });
      addParagraphsToCardFragment(boardDoc, cardId, ["Card text to empty"]);

      // Act
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: null,
      });

      // Assert: store.save was called once
      expect(store.saveCount).toBe(1);

      // Assert: saved content is just the card
      const saved = await store.load(sceneId);
      expect(saved).not.toBeNull();
      const savedDoc = new Y.Doc();
      applyEncoded(savedDoc, saved!);
      const paragraphs = extractParagraphTexts(savedDoc);
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toContain("Card text to empty");
    });
  });

  describe("Edge cases", () => {
    it("does nothing when card has no text (empty fragment)", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const sceneDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-empty";
      const sceneId = "scene-empty-card";

      // Create card but do NOT add any paragraphs (empty fragment)
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });

      // Create scene with initial content
      addParagraphsToSceneContent(sceneDoc, ["Original paragraph"]);

      // Act (HOT path)
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: sceneDoc,
      });

      // Assert: no modification (still 1 paragraph)
      const paragraphs = extractParagraphTexts(sceneDoc);
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe("Original paragraph");

      // Assert: store.save not called
      expect(store.saveCount).toBe(0);
    });

    it("does nothing (COLD path) when card is empty", async () => {
      // Arrange
      const boardDoc = new Y.Doc();
      const store = new InMemorySceneDocStore();

      const cardId = "card-empty-cold";
      const sceneId = "scene-empty-card-cold";

      // Pre-populate store
      const initialSceneDoc = new Y.Doc();
      addParagraphsToSceneContent(initialSceneDoc, ["Original paragraph"]);
      const initialBase64 = encodeDoc(initialSceneDoc);
      await store.save(sceneId, initialBase64, "Original paragraph");
      const countBefore = store.saveCount;

      // Create empty card (no paragraphs)
      createBoardCard(boardDoc, cardId, { x: 0, y: 0 });

      // Act
      await sendCardToScene({
        boardDoc,
        cardId,
        sceneId,
        store,
        liveDoc: null,
      });

      // Assert: No additional save (no-op)
      expect(store.saveCount).toBe(countBefore);

      // Assert: Stored content unchanged
      const saved = await store.load(sceneId);
      const savedDoc = new Y.Doc();
      applyEncoded(savedDoc, saved!);
      const paragraphs = extractParagraphTexts(savedDoc);
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0]).toBe("Original paragraph");
    });
  });
});
