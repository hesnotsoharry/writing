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

import { createBoardCard, plainTextToCardFragment, removeCard, removeConnectionsForCard } from "../../shared/boardDoc";
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
