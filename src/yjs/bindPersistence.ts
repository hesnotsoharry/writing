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

  const saveNow = () => {
    const text = extractPlainText(doc);
    const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    void store.save(sceneId, encodeDoc(doc), text.length > 0 ? text : null)
      .then(() => { onSaved?.(sceneId, wordCount); });
  };

  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveNow();
    }, debounceMs);
  };

  const onUpdate = () => scheduleSave();

  // Schedule an initial save so that content built before binding is persisted.
  // Any real update that fires will cancel and reschedule this timer.
  scheduleSave();

  doc.on("update", onUpdate);

  return () => {
    doc.off("update", onUpdate);
    // Flush (not cancel) a pending save: writes made within debounceMs of
    // unbind would otherwise be silently dropped — e.g. graduating a board
    // card right before navigating away, or final keystrokes before a view
    // switch (wave-32 Phase 6 finding).
    if (timer) {
      clearTimeout(timer);
      timer = null;
      saveNow();
    }
  };
}
