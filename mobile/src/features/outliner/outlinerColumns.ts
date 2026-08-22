import type { DbClient } from "../../shared/dbClient";

/**
 * The fields an outliner row may show alongside its title.
 *
 * Title is deliberately not one of them — a row with no title has nothing left
 * to identify the scene by. The set mirrors the desktop outliner's table
 * columns (design-reference/OUTLINER-SPEC.md: status dot · title · synopsis ·
 * words · labels), which is where the phone's "Columns" pill borrows its name.
 */
export type OutlinerColumn = "status" | "synopsis" | "words" | "labels";

export type OutlinerColumnVisibility = Record<OutlinerColumn, boolean>;

export interface OutlinerColumnOption {
  key: OutlinerColumn;
  label: string;
  description: string;
}

/** Listed in the order the fields read down a row, so the sheet matches the row. */
export const OUTLINER_COLUMN_OPTIONS: readonly OutlinerColumnOption[] = [
  { key: "status", label: "Status dot", description: "Tap it to cycle a scene through blank, outline, draft, revise, final." },
  { key: "words", label: "Word count", description: "The scene's length, right of its title." },
  { key: "synopsis", label: "Synopsis", description: "The editable summary line under the title." },
  { key: "labels", label: "Labels", description: "Colour label pills and the button that assigns them." },
];

export const OUTLINER_COLUMN_DEFAULTS: OutlinerColumnVisibility = {
  status: true, synopsis: true, words: true, labels: true,
};

/** Device-local, like every other `app_meta` preference — a phone kept dense
 *  should not force the same choice onto the desktop app or another handset. */
export const OUTLINER_COLUMNS_KEY = "mobile_outliner_columns";

function readFlags(value: Record<string, unknown>): OutlinerColumnVisibility {
  const result = { ...OUTLINER_COLUMN_DEFAULTS };
  for (const { key } of OUTLINER_COLUMN_OPTIONS) {
    const flag = value[key];
    if (typeof flag === "boolean") result[key] = flag;
  }
  return result;
}

/** Anything unreadable falls back to "show everything", which is the state the
 *  screen shipped in — a corrupt row must never hide a writer's synopses. */
export function parseOutlinerColumns(raw: string | null): OutlinerColumnVisibility {
  if (!raw) return { ...OUTLINER_COLUMN_DEFAULTS };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ...OUTLINER_COLUMN_DEFAULTS };
    }
    return readFlags(value as Record<string, unknown>);
  } catch {
    return { ...OUTLINER_COLUMN_DEFAULTS };
  }
}

export function toggleOutlinerColumn(
  columns: OutlinerColumnVisibility, key: OutlinerColumn,
): OutlinerColumnVisibility {
  return { ...columns, [key]: !columns[key] };
}

export function countVisibleOutlinerColumns(columns: OutlinerColumnVisibility): number {
  return OUTLINER_COLUMN_OPTIONS.filter(({ key }) => columns[key]).length;
}

/** Pill label. Plain "Columns" while everything is on; once the writer has
 *  hidden something the pill carries the surviving count, so a trimmed row is
 *  never a mystery. */
export function describeOutlinerColumns(columns: OutlinerColumnVisibility): string {
  const shown = countVisibleOutlinerColumns(columns);
  return shown === OUTLINER_COLUMN_OPTIONS.length ? "Columns" : `Columns · ${shown}`;
}

export class OutlinerColumnsStore {
  constructor(private readonly db: DbClient) {}

  async read(): Promise<OutlinerColumnVisibility> {
    const rows = await this.db.select<Array<{ value: string }>>(
      "SELECT value FROM app_meta WHERE key = ?", [OUTLINER_COLUMNS_KEY],
    );
    return parseOutlinerColumns(rows[0]?.value ?? null);
  }

  async write(columns: OutlinerColumnVisibility): Promise<void> {
    await this.db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
      OUTLINER_COLUMNS_KEY, JSON.stringify(columns),
    ]);
  }
}
