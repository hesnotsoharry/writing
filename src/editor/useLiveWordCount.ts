import { useEffect, useState } from "react";
import * as Y from "yjs";

import { extractPlainText } from "../yjs/serialize";

/**
 * Returns the current prose word count of a Y.Doc, recomputed live on every
 * Yjs update (keystroke → Yjs transaction → "update" event → setState).
 *
 * Word count = extracted plaintext trimmed and split on whitespace runs.
 * Returns 0 when `doc` is null (no scene selected).
 *
 * The observer is re-subscribed whenever the `doc` identity changes (new scene
 * opened); the previous observer is cleaned up in the useEffect return.
 *
 * State reset pattern: React-recommended synchronous derived-state reset — the
 * { doc, count } state tuple is updated during the render when the doc identity
 * changes, so the count reflects the new scene without a synchronous setState
 * call inside useEffect (which would cause cascading renders).
 */
export function useLiveWordCount(doc: Y.Doc | null): number {
  const [state, setState] = useState<{ doc: Y.Doc | null; count: number }>(() => ({
    doc,
    count: computeCount(doc),
  }));

  // Synchronous derived-state reset: when doc identity changes, update state
  // during the current render (React processes this as a bail-out re-render
  // before painting, giving the semantics of "reset on doc change").
  if (state.doc !== doc) {
    setState({ doc, count: computeCount(doc) });
  }

  useEffect(() => {
    if (!doc) return;

    function handleUpdate() {
      setState((prev) => ({ ...prev, count: computeCount(doc) }));
    }

    doc.on("update", handleUpdate);
    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc]);

  return state.count;
}

function computeCount(doc: Y.Doc | null): number {
  if (!doc) return 0;
  const text = extractPlainText(doc).trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
