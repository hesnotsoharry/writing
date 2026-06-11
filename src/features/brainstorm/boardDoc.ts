import * as Y from "yjs";

/**
 * Add a card to the board doc.
 *
 * Schema (Decision 2):
 *   - card metadata (position) is a plain JSON value in doc.getMap('cards')[cardId]
 *   - card text lives in a top-level XmlFragment at doc.getXmlFragment('card-<cardId>')
 *     which TipTap Collaboration reaches via field: 'card-<cardId>'
 *
 * Plain JSON in Y.Map (not a nested Y.Map) is load-bearing: TipTap cannot reach
 * a Y.XmlFragment nested inside a Y.Map — it must be a top-level doc fragment.
 */
export function createBoardCard(
  doc: Y.Doc,
  cardId: string,
  pos: { x: number; y: number }
): void {
  // Store plain JSON metadata — never a Y.Map or Y.XmlFragment
  doc.getMap("cards").set(cardId, { x: pos.x, y: pos.y });
  // Touch the top-level fragment to register it in the doc's intrinsics
  doc.getXmlFragment(`card-${cardId}`);
}

/**
 * Return the top-level XmlFragment for a card by cardId.
 * TipTap Collaboration uses this via field: 'card-<cardId>'.
 */
export function getCardFragment(doc: Y.Doc, cardId: string): Y.XmlFragment {
  return doc.getXmlFragment(`card-${cardId}`);
}
