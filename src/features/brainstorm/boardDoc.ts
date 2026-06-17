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
 * Merges the new x, y into the card's existing metadata so that extra fields
 * (e.g. entityRef on entity cards) are preserved across drag operations.
 * Exactly one Y.Map.set() call is made per invocation — tombs are managed on
 * drag end only (Decision 5).
 */
export function updateCardPosition(
  doc: Y.Doc,
  cardId: string,
  pos: { x: number; y: number }
): void {
  const cards = doc.getMap("cards");
  const existing = (cards.get(cardId) as Record<string, unknown> | undefined) ?? {};
  cards.set(cardId, { ...existing, x: pos.x, y: pos.y });
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
  doc: Y.Doc,
  cardId: string,
  entityId: string,
  pos: { x: number; y: number }
): void {
  doc.getMap("cards").set(cardId, { x: pos.x, y: pos.y, entityRef: entityId });
  doc.getXmlFragment(`card-${cardId}`);
}

/**
 * Write plain text into an existing card's top-level XmlFragment (P5 — WRITE direction).
 *
 * Splits on newlines, skips blank/whitespace-only lines, and inserts each non-empty
 * line as a <paragraph><text> node — the schema TipTap Collaboration expects on a
 * top-level fragment.  Must be called AFTER createBoardCard so the fragment exists.
 * Does NOT wrap in a transaction; callers combining with createBoardCard should transact.
 */
export function plainTextToCardFragment(doc: Y.Doc, cardId: string, text: string): void {
  const frag = doc.getXmlFragment(`card-${cardId}`);
  for (const line of text.split("\n").filter((l) => l.trim())) {
    const para = new Y.XmlElement("paragraph");
    const t = new Y.XmlText();
    t.insert(0, line);
    para.insert(0, [t]);
    frag.push([para]);
  }
}

// ── Phase 6 helpers for getCardText ──────────────────────────────────────────

function xmlTextContent(node: Y.XmlText): string {
  return (node.toDelta() as { insert?: unknown }[]).reduce(
    (s, op) => s + (typeof op.insert === "string" ? op.insert : ""),
    ""
  );
}

function paragraphPlainText(para: Y.XmlElement): string {
  let text = "";
  for (let i = 0; i < para.length; i++) {
    const child = para.get(i);
    if (child instanceof Y.XmlText) text += xmlTextContent(child);
  }
  return text;
}

/**
 * Return the plain text of a card by joining paragraph content with newlines (Phase 6).
 *
 * - If the card has no fragment or fragment is empty, returns empty string.
 * - Extracts text from XmlText nodes within each paragraph and joins with '\n'.
 *
 * Idempotent — multiple calls return the same result.
 */
export function getCardText(doc: Y.Doc, cardId: string): string {
  const frag = doc.getXmlFragment(`card-${cardId}`);
  if (frag.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < frag.length; i++) {
    const child = frag.get(i);
    if (child instanceof Y.XmlElement) parts.push(paragraphPlainText(child));
    else if (child instanceof Y.XmlText) parts.push(xmlTextContent(child));
  }
  return parts.join("\n");
}

/**
 * Restore a graduated card to editable state (F7 — un-promote).
 *
 * Removes `graduated`, `destinationKind`, and `destinationId` from the card's
 * metadata, preserving x, y, and entityRef. Does NOT delete the created
 * scene or entity. Safe to call on a non-graduated card (no-op).
 *
 * Idempotent: calling again on an already-restored card rewrites the same
 * plain metadata (still no graduation fields).
 */
export function clearCardGraduation(doc: Y.Doc, cardId: string): void {
  const cards = doc.getMap("cards");
  const existing = (cards.get(cardId) as Record<string, unknown> | undefined) ?? {};
  // Destructure out the three graduation fields; keep everything else.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { graduated: _g, destinationKind: _dk, destinationId: _di, ...rest } = existing;
  cards.set(cardId, rest);
}

/**
 * Mark a card as graduated and record its destination (Phase 6).
 *
 * MERGES the graduated flag and destination into the card's existing metadata
 * so that x, y, and (for entity cards) entityRef are preserved.
 *
 * Schema (Decision 2):
 *   - graduated: true (boolean flag)
 *   - destinationKind: 'scene' | 'entity' (string)
 *   - destinationId: string (the target scene or entity ID)
 *   - plain JSON in doc.getMap('cards')[cardId] (not a Y.Map or Y.XmlFragment)
 *
 * Idempotent-ish: calling again with a different destination overwrites the destination
 * fields (last write wins), but still produces one cards-map entry per cardId.
 * The card's text fragment is NOT cleared — provenance is preserved.
 */
export function markCardGraduated(
  doc: Y.Doc,
  cardId: string,
  destination: { kind: "scene" | "entity"; id: string }
): void {
  const cards = doc.getMap("cards");
  const existing = (cards.get(cardId) as Record<string, unknown> | undefined) ?? {};
  cards.set(cardId, {
    ...existing,
    graduated: true,
    destinationKind: destination.kind,
    destinationId: destination.id,
  });
}
