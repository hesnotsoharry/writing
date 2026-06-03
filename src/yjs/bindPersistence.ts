import * as Y from "yjs";

import type { SceneDocStore } from "../db/sceneDocStore";
import { encodeDoc, extractPlainText } from "./serialize";

/**
 * Subscribe to a Y.Doc and persist its full state to `store`, debounced.
 * Returns an unbind function that detaches the listener and cancels any
 * pending save.
 */
export function bindPersistence(
  doc: Y.Doc,
  sceneId: string,
  store: SceneDocStore,
  debounceMs = 500
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const text = extractPlainText(doc);
      void store.save(sceneId, encodeDoc(doc), text.length > 0 ? text : null);
    }, debounceMs);
  };

  const onUpdate = () => scheduleSave();

  // Schedule an initial save so that content built before binding is persisted.
  // Any real update that fires will cancel and reschedule this timer.
  scheduleSave();

  doc.on("update", onUpdate);

  return () => {
    doc.off("update", onUpdate);
    if (timer) clearTimeout(timer);
  };
}
