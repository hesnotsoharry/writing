import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";

import { SqliteQuickNoteStore } from "./SqliteQuickNoteStore";

const defaultStore = new SqliteQuickNoteStore();

export function useQuickItemsBadge(
  activeProjectId: string | null,
  setHasQuickItems: Dispatch<SetStateAction<boolean>>,
  store: Pick<SqliteQuickNoteStore, "countUnfiled"> = defaultStore,
): void {
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
  }, [activeProjectId, setHasQuickItems, store]);
}
