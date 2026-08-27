import * as Y from "yjs";

import type { SceneDocStore } from "../db/sceneDocStore";
import { encodeDoc, extractPlainText } from "./serialize";

export const SYNC_ORIGIN = "sync-remote";

export interface SaveMeta {
  hadLocalEdits: boolean;
}

export interface BindPersistenceOpts {
  debounceMs?: number;
  /**
   * Called after a debounced save completes.
   * `wordCount` is the word count computed from the saved plaintext
   * (split on whitespace; 0 for an empty doc).
   */
  onSaved?: (sceneId: string, wordCount: number, meta: SaveMeta) => void;
}

export type UnbindFn = (() => void) & {
  flush: () => Promise<void>;
};

function createSaver(
  doc: Y.Doc,
  sceneId: string,
  store: SceneDocStore,
  onSaved?: BindPersistenceOpts["onSaved"],
) {
  let hadLocalEdits = true;
  let inFlight: Promise<void> | null = null;

  const save = (): Promise<void> => {
    const savedHadLocalEdits = hadLocalEdits;
    hadLocalEdits = false;
    const text = extractPlainText(doc);
    const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const p = store.save(sceneId, encodeDoc(doc), text.length > 0 ? text : null)
      .then(() => {
        onSaved?.(sceneId, wordCount, { hadLocalEdits: savedHadLocalEdits });
      })
      .finally(() => {
        if (inFlight === p) inFlight = null;
      });
    inFlight = p;
    return p;
  };

  return {
    save,
    markLocal: () => { hadLocalEdits = true; },
    inFlight: () => inFlight,
  };
}

/**
 * Subscribe to a Y.Doc and persist its full state to `store`, debounced.
 * Returns an unbind function (with .flush() method) that detaches the listener
 * and flushes any pending save.
 */
export function bindPersistence(
  doc: Y.Doc,
  sceneId: string,
  store: SceneDocStore,
  opts: BindPersistenceOpts = {}
): UnbindFn {
  const { debounceMs = 500, onSaved } = opts;
  const saver = createSaver(doc, sceneId, store, onSaved);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void saver.save(); }, debounceMs);
  };
  const onUpdate = (_update: Uint8Array, origin: unknown) => {
    if (origin !== SYNC_ORIGIN) saver.markLocal();
    scheduleSave();
  };
  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      await saver.save();
    } else if (saver.inFlight()) {
      await saver.inFlight();
    }
  };

  scheduleSave();
  doc.on("update", onUpdate);

  const unbind: UnbindFn = () => {
    doc.off("update", onUpdate);
    if (timer) { clearTimeout(timer); timer = null; void saver.save(); }
  };
  unbind.flush = flush;
  return unbind;
}
