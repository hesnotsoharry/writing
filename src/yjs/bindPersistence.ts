import * as Y from "yjs";

import type { SceneDocStore } from "../db/sceneDocStore";
import { encodeDoc, extractPlainText } from "./serialize";

export interface BindPersistenceOpts {
  debounceMs?: number;
  /**
   * Called after a debounced save completes.
   * `wordCount` is the word count computed from the saved plaintext
   * (split on whitespace; 0 for an empty doc).
   */
  onSaved?: (sceneId: string, wordCount: number) => void;
}

/**
 * Subscribe to a Y.Doc and persist its full state to `store`, debounced.
 * Returns an unbind function that detaches the listener and cancels any
 * pending save.
 */
export function bindPersistence(
  doc: Y.Doc,
  sceneId: string,
  store: SceneDocStore,
  opts: BindPersistenceOpts = {}
): () => void {
  const { debounceMs = 500, onSaved } = opts;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const text = extractPlainText(doc);
      const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      void store.save(sceneId, encodeDoc(doc), text.length > 0 ? text : null)
        .then(() => { onSaved?.(sceneId, wordCount); });
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
