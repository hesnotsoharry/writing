import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import { QUICK_NOTES_CHANGED_EVENT } from "../../lib/settings";
import { SqliteQuickNoteStore } from "./SqliteQuickNoteStore";

const defaultStore = new SqliteQuickNoteStore();

export function useQuickItemsBadge(
  activeProjectId: string | null,
  setHasQuickItems: Dispatch<SetStateAction<boolean>>,
  store: Pick<SqliteQuickNoteStore, "countUnfiled"> = defaultStore,
): void {
  const [version, setVersion] = useState(0);

  // Re-fetch whenever a quick-note mutation fires (create / delete / promote).
  useEffect(() => {
    const h = () => { setVersion((v) => v + 1); };
    window.addEventListener(QUICK_NOTES_CHANGED_EVENT, h);
    return () => { window.removeEventListener(QUICK_NOTES_CHANGED_EVENT, h); };
  }, []);

  useEffect(() => {
    if (activeProjectId === null) {
      setHasQuickItems(false);
      return;
    }
    let cancelled = false;
    store
      .countUnfiled(activeProjectId)
      .then((n) => {
        if (!cancelled) setHasQuickItems(n > 0);
      })
      .catch(() => {
        // leave badge as-is on error
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, setHasQuickItems, store, version]);
}
