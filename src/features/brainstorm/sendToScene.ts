import type * as Y from "yjs";

import type { SceneDocStore } from "../../db/sceneDocStore";

export interface SendCardToSceneOpts {
  boardDoc: Y.Doc;
  cardId: string;
  sceneId: string;
  store: SceneDocStore;
  liveDoc?: Y.Doc | null;
}

/**
 * Append a card's text to a scene.
 *
 * HOT path (liveDoc provided): appends to the live in-memory Y.Doc.
 * The doc's bindPersistence handler saves it; this function does NOT call store.save.
 *
 * COLD path (liveDoc null/undefined): loads the scene from store, appends card text,
 * and persists via store.save.
 *
 * Semantics (Decision 3, Wave 32 Phase 5):
 * - Extracts card text from boardDoc.getXmlFragment('card-<cardId>')
 * - Appends paragraph-by-paragraph to scene content
 * - Empty card (no text): no-op (no save call, no modification)
 * - Multi-paragraph cards: structure preserved (multiple Y.XmlElement('paragraph') nodes appended)
 */
export async function sendCardToScene(_opts: SendCardToSceneOpts): Promise<void> {
  throw new Error("not implemented");
}
