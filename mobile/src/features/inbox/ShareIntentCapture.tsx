import { useShareIntentContext } from "expo-share-intent";
import { useEffect, useRef } from "react";

import { getBinderStore, getQuickNoteStore } from "../../db/stores";
import { captureShareIntent, shareIntentBody } from "./shareCapture";

export function ShareIntentCapture() {
  const { hasShareIntent, resetShareIntent, shareIntent } = useShareIntentContext();
  const body = shareIntentBody(shareIntent);
  const processing = useRef<string | null>(null);
  useEffect(() => {
    if (!hasShareIntent || !body || processing.current === body) return;
    processing.current = body;
    void captureShareIntent({
      latestProjectId: async () => (await (await getBinderStore()).listProjects())[0]?.id ?? null,
      createQuickNote: async (projectId, noteBody, source) =>
        (await getQuickNoteStore()).create(projectId, noteBody, source),
    }, shareIntent).then((id) => {
      if (id) resetShareIntent();
      processing.current = null;
    }).catch((error: unknown) => {
      processing.current = null;
      console.error("[share-intent] capture failed", error);
    });
  }, [body, hasShareIntent, resetShareIntent, shareIntent]);
  return null;
}
