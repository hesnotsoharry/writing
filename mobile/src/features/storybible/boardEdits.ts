/**
 * Mobile writes to a brainstorm board's Yjs doc.
 *
 * Every mutation delegates to desktop's own `src/features/brainstorm/boardDoc.ts`
 * (re-exported through `shared/boardDoc`) so the wire schema cannot drift:
 *
 *   - `doc.getMap("cards")[cardId]` is a PLAIN JSON object `{ x, y, … }` —
 *     never a nested Y.Map, because TipTap cannot bind to a fragment nested
 *     inside a map.
 *   - a card's text is a TOP-LEVEL `doc.getXmlFragment("card-<cardId>")`
 *     holding `<paragraph><text>…</text></paragraph>` nodes, which is exactly
 *     what desktop's `Collaboration.configure({ field: "card-<cardId>" })`
 *     mounts on.
 *   - deleting a card cascades through `removeConnectionsForCard` first, or
 *     desktop is left rendering edges to a node that no longer exists.
 *
 * Nothing here touches the database — persistence and the sync notification
 * live in the screen, which keeps this module importable from tests.
 */
import * as Y from "yjs";

import { addConnection, createBoardCard, plainTextToCardFragment, removeCard, removeConnection, removeConnectionsForCard } from "../../shared/boardDoc";
import { applyEncoded, encodeDoc } from "../../shared/serialize";
import type { CardPoint } from "./boardPlacement";
import { nextCardSlot } from "./boardPlacement";

interface StoredCardMeta { x?: unknown; y?: unknown }

function asCoordinate(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Rebuild a board doc from the base64 blob stored in `board_docs.state_base64`. */
export function decodeBoardDoc(base64: string | null): Y.Doc {
  const doc = new Y.Doc();
  applyEncoded(doc, base64 ?? "");
  return doc;
}

/** Re-encode a board doc for `board_docs.state_base64` (base64 TEXT, never a BLOB). */
export function encodeBoardDoc(doc: Y.Doc): string {
  return encodeDoc(doc);
}

/** Top-left positions of every card currently on the board. */
export function cardPositions(doc: Y.Doc): CardPoint[] {
  return [...doc.getMap<StoredCardMeta>("cards").values()]
    .map((meta) => ({ x: asCoordinate(meta.x), y: asCoordinate(meta.y) }));
}

/**
 * Add a card carrying `text`, placed in the next free grid slot.
 * Returns the new card id. One transaction, so peers see card + text together.
 */
export function addBoardCard(doc: Y.Doc, text: string, cardId: string = crypto.randomUUID()): string {
  const position = nextCardSlot(cardPositions(doc));
  doc.transact(() => {
    createBoardCard(doc, cardId, position);
    plainTextToCardFragment(doc, cardId, text);
  });
  return cardId;
}

/**
 * Replace a card's text, leaving its metadata — and therefore its position —
 * untouched. A card missing from the cards map is ignored rather than resurrected.
 */
export function setBoardCardText(doc: Y.Doc, cardId: string, text: string): void {
  if (!doc.getMap("cards").has(cardId)) return;
  const fragment = doc.getXmlFragment(`card-${cardId}`);
  doc.transact(() => {
    if (fragment.length > 0) fragment.delete(0, fragment.length);
    plainTextToCardFragment(doc, cardId, text);
  });
}

/** Delete a card and every connection that referenced it (desktop's cascade order). */
export function deleteBoardCard(doc: Y.Doc, cardId: string): void {
  doc.transact(() => {
    removeConnectionsForCard(doc, cardId);
    removeCard(doc, cardId);
  });
}

interface StoredConnection { from?: unknown; to?: unknown }

/**
 * Ids of every connection joining these two cards, in either direction.
 *
 * Direction is deliberately ignored. Desktop stores `{ from, to }` and draws an
 * edge between the two nodes; nothing in the renderer or the data model treats
 * A→B as different from B→A. Reading them as one link is what lets a phone
 * offer a single toggle instead of asking which way round the user meant.
 */
function connectionsBetween(doc: Y.Doc, a: string, b: string): string[] {
  return [...doc.getMap<StoredConnection>("connections").entries()]
    .filter(([, meta]) => (meta.from === a && meta.to === b) || (meta.from === b && meta.to === a))
    .map(([id]) => id);
}

export function areCardsConnected(doc: Y.Doc, a: string, b: string): boolean {
  return connectionsBetween(doc, a, b).length > 0;
}

/**
 * Link or unlink two cards, returning the state it left them in.
 *
 * Linking a card to itself is refused: desktop's renderer would be asked for an
 * edge from a node to itself, and it means nothing on a brainstorm board.
 * Unlinking removes EVERY matching connection rather than the first — a board
 * edited on two devices can hold a duplicate pair, and leaving one behind would
 * make the toggle look broken.
 */
export function toggleBoardConnection(doc: Y.Doc, a: string, b: string): boolean {
  if (a === b) return false;
  const existing = connectionsBetween(doc, a, b);
  if (existing.length > 0) {
    doc.transact(() => { for (const id of existing) removeConnection(doc, id); });
    return false;
  }
  doc.transact(() => { addConnection(doc, crypto.randomUUID(), a, b); });
  return true;
}
