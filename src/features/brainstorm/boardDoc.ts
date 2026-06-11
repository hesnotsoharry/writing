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

/**
 * Update a card's position metadata (Phase 2).
 *
 * Overwrites the card's entry in doc.getMap('cards') with new x, y coordinates.
 * The position is stored as plain JSON, never a Y type. Exactly one Y.Map.set()
 * call is made per invocation — tombs are managed on drag end only (Decision 5).
 */
export function updateCardPosition(
  doc: Y.Doc,
  cardId: string,
  pos: { x: number; y: number }
): void {
  doc.getMap("cards").set(cardId, { x: pos.x, y: pos.y });
}

/**
 * Remove a card from the board (Phase 2).
 *
 * Deletes the card's metadata entry from doc.getMap('cards') and clears
 * the card's top-level XmlFragment (doc.getXmlFragment('card-<cardId>')).
 * Other cards are unaffected. Note: Yjs has no fragment delete — the key
 * is retained in the doc's intrinsics but its content is cleared (empty length).
 */
export function removeCard(doc: Y.Doc, cardId: string): void {
  doc.getMap("cards").delete(cardId);
  const frag = doc.getXmlFragment(`card-${cardId}`);
  if (frag.length > 0) {
    frag.delete(0, frag.length);
  }
}

/**
 * Add a connection between two cards (Phase 3).
 *
 * Schema (Decision 2 — wave 32):
 *   - connection metadata (from/to) is a plain JSON value in doc.getMap('connections')[connectionId]
 *   - each connection stores { from: cardId, to: cardId } as plain JSON
 *
 * Plain JSON in Y.Map (not a Y type) ensures CRDT safety and matches card metadata pattern.
 */
export function addConnection(
  doc: Y.Doc,
  connectionId: string,
  from: string,
  to: string
): void {
  doc.getMap("connections").set(connectionId, { from, to });
}

/**
 * Remove a connection between two cards (Phase 3).
 *
 * Deletes the connection's entry from doc.getMap('connections').
 * Other connections are unaffected.
 */
export function removeConnection(doc: Y.Doc, connectionId: string): void {
  doc.getMap("connections").delete(connectionId);
}

/**
 * Remove all connections whose from or to matches a given card (Phase 3 cascade).
 *
 * Called by the canvas layer before removeCard so deleting a card does not
 * leave dangling edges. Collects IDs first to avoid mutating the map mid-iteration.
 */
export function removeConnectionsForCard(doc: Y.Doc, cardId: string): void {
  const connections = doc.getMap<{ from: string; to: string }>("connections");
  const toRemove: string[] = [];
  for (const [connId, meta] of connections.entries()) {
    if (meta.from === cardId || meta.to === cardId) {
      toRemove.push(connId);
    }
  }
  for (const connId of toRemove) {
    removeConnection(doc, connId);
  }
}

/**
 * Add an entity card to the board doc (Phase 4).
 *
 * Schema (Decision 2/4):
 *   - entity card metadata is a plain JSON value in doc.getMap('cards')[cardId]
 *     with fields { x, y, entityRef } — entityRef stores the entity ID only,
 *     never copied name/type/title
 *   - the top-level fragment at doc.getXmlFragment('card-<cardId>') is created
 *     but remains empty (entity cards have no free text in v1)
 *
 * Regular cards (from createBoardCard) do NOT have an entityRef key.
 */
export function createEntityCard(
  _doc: Y.Doc,
  _cardId: string,
  _entityId: string,
  _pos: { x: number; y: number }
): void {
  throw new Error("not implemented");
}
