import { useEffect, useState } from "react";

import { getMobileDb } from "../../db/database";
import type { OutlinerColumn, OutlinerColumnVisibility } from "./outlinerColumns";
import { OUTLINER_COLUMN_DEFAULTS, OutlinerColumnsStore, toggleOutlinerColumn } from "./outlinerColumns";

let cached: Promise<OutlinerColumnsStore> | null = null;

/** Same memoized-accessor shape as `db/stores.ts`, kept local because this
 *  preference belongs to the outliner and nothing else reads it. */
function getStore(): Promise<OutlinerColumnsStore> {
  cached ??= getMobileDb().then((db) => new OutlinerColumnsStore(db));
  return cached;
}

export interface OutlinerColumnsState {
  columns: OutlinerColumnVisibility;
  toggle: (key: OutlinerColumn) => void;
}

/**
 * Reads the writer's column choice once on mount and writes it back on every
 * toggle. The write is fire-and-forget: the row list must re-render the instant
 * the switch flips, not after SQLite answers.
 */
export function useOutlinerColumns(): OutlinerColumnsState {
  const [columns, setColumns] = useState<OutlinerColumnVisibility>(OUTLINER_COLUMN_DEFAULTS);
  useEffect(() => { void getStore().then((store) => store.read()).then(setColumns); }, []);
  const toggle = (key: OutlinerColumn) => {
    const next = toggleOutlinerColumn(columns, key);
    setColumns(next);
    void getStore().then((store) => store.write(next));
  };
  return { columns, toggle };
}
