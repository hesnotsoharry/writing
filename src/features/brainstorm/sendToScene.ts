/**
 * sendToScene — append a brainstorm card's text to a scene.
 *
 * HOT path (liveDoc provided and truthy): appends paragraph nodes directly to
 * the live Y.Doc's 'content' fragment. Does NOT call store.save — bindPersistence
 * is already watching the live doc and will persist on the next debounced write.
 * This avoids the data-loss race (Decision 3, Wave 32): a cold store.save would
 * be overwritten on the next keystroke when bindPersistence flushes the live doc.
 *
 * COLD path (liveDoc null or undefined): load from store → apply → append → save.
 * Mirrors promoteNoteToScene.ts: each paragraph becomes Y.XmlElement('paragraph')
 * + Y.XmlText — ProseMirror-compatible per CLAUDE.md.
 *
 * Returns { sceneId } for Phase 6 graduation hooks to consume.
 */
import * as Y from "yjs";

import type { SceneDocStore } from "../../db/sceneDocStore";
import { applyEncoded, encodeDoc, extractPlainText } from "../../yjs/serialize";

export interface SendCardToSceneOpts {
  boardDoc: Y.Doc;
  cardId: string;
  sceneId: string;
  store: SceneDocStore;
  liveDoc?: Y.Doc | null;
}

/** Extract plain text from a Y.XmlText node's delta (strips mark attributes). */
function xmlTextToPlain(node: Y.XmlText): string {
  return (node.toDelta() as { insert?: unknown }[])
    .reduce((s, op) => s + (typeof op.insert === "string" ? op.insert : ""), "");
}

/**
 * Copy the card's XmlFragment paragraphs into targetFrag.
 * Creates fresh Y types for each paragraph — safe to use across docs because
 * Yjs Y types cannot be shared between documents.
 */
function appendCardParagraphs(
  boardDoc: Y.Doc,
  cardId: string,
  targetFrag: Y.XmlFragment,
): void {
  const cardFrag = boardDoc.getXmlFragment(`card-${cardId}`);
  for (let i = 0; i < cardFrag.length; i++) {
    const srcPara = cardFrag.get(i);
    if (!(srcPara instanceof Y.XmlElement)) continue;
    const newPara = new Y.XmlElement("paragraph");
    for (let j = 0; j < srcPara.length; j++) {
      const child = srcPara.get(j);
      if (child instanceof Y.XmlText) {
        const newText = new Y.XmlText();
        newText.insert(0, xmlTextToPlain(child));
        newPara.insert(newPara.length, [newText]);
      }
    }
    targetFrag.push([newPara]);
  }
}

export async function sendCardToScene({
  boardDoc,
  cardId,
  sceneId,
  store,
  liveDoc,
}: SendCardToSceneOpts): Promise<{ sceneId: string }> {
  const cardFrag = boardDoc.getXmlFragment(`card-${cardId}`);
  // No-op when the card fragment is empty (no paragraphs).
  if (cardFrag.length === 0) return { sceneId };

  if (liveDoc) {
    // HOT path: mutate the live doc — bindPersistence owns the subsequent save.
    appendCardParagraphs(boardDoc, cardId, liveDoc.getXmlFragment("content"));
  } else {
    // COLD path: load → append → save (mirrors promoteNoteToScene.ts).
    const stored = await store.load(sceneId);
    const tmpDoc = new Y.Doc();
    applyEncoded(tmpDoc, stored ?? "");
    appendCardParagraphs(boardDoc, cardId, tmpDoc.getXmlFragment("content"));
    await store.save(sceneId, encodeDoc(tmpDoc), extractPlainText(tmpDoc));
  }

  return { sceneId };
}
