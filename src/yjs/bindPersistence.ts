import * as Y from "yjs";

import type { SceneDocStore } from "../db/sceneDocStore";
import { encodeDoc } from "./serialize";

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

  const onUpdate = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void store.save(sceneId, encodeDoc(doc));
    }, debounceMs);
  };

  doc.on("update", onUpdate);

  return () => {
    doc.off("update", onUpdate);
    if (timer) clearTimeout(timer);
  };
}
