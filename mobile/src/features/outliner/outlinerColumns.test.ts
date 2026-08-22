import { describe, expect, it } from "vitest";

import {
  countVisibleOutlinerColumns,
  describeOutlinerColumns,
  OUTLINER_COLUMN_DEFAULTS,
  OUTLINER_COLUMN_OPTIONS,
  parseOutlinerColumns,
  toggleOutlinerColumn,
} from "./outlinerColumns";

describe("outliner column visibility", () => {
  it("shows every column until the writer says otherwise", () => {
    expect(OUTLINER_COLUMN_DEFAULTS).toEqual({ status: true, synopsis: true, words: true, labels: true });
    expect(countVisibleOutlinerColumns(OUTLINER_COLUMN_DEFAULTS)).toBe(OUTLINER_COLUMN_OPTIONS.length);
  });

  it("offers exactly the fields a row can draw, and never the title", () => {
    expect(OUTLINER_COLUMN_OPTIONS.map(({ key }) => key)).toEqual(["status", "words", "synopsis", "labels"]);
  });

  it("toggles one column without disturbing the others", () => {
    const hidden = toggleOutlinerColumn(OUTLINER_COLUMN_DEFAULTS, "synopsis");
    expect(hidden).toEqual({ status: true, synopsis: false, words: true, labels: true });
    expect(toggleOutlinerColumn(hidden, "synopsis")).toEqual(OUTLINER_COLUMN_DEFAULTS);
    expect(OUTLINER_COLUMN_DEFAULTS.synopsis).toBe(true);
  });

  it("labels the pill plainly while everything shows, and counts once something is hidden", () => {
    expect(describeOutlinerColumns(OUTLINER_COLUMN_DEFAULTS)).toBe("Columns");
    expect(describeOutlinerColumns(toggleOutlinerColumn(OUTLINER_COLUMN_DEFAULTS, "labels"))).toBe("Columns · 3");
    expect(describeOutlinerColumns({ status: false, synopsis: false, words: false, labels: false })).toBe("Columns · 0");
  });
});

describe("outliner column persistence", () => {
  it("round-trips a stored choice", () => {
    const stored = { status: false, synopsis: true, words: false, labels: true };
    expect(parseOutlinerColumns(JSON.stringify(stored))).toEqual(stored);
  });

  it("fills gaps from the defaults rather than hiding a field it was not told about", () => {
    expect(parseOutlinerColumns(JSON.stringify({ synopsis: false }))).toEqual({
      status: true, synopsis: false, words: true, labels: true,
    });
  });

  it("ignores non-boolean and unknown keys", () => {
    expect(parseOutlinerColumns(JSON.stringify({ synopsis: "no", chapters: false }))).toEqual(OUTLINER_COLUMN_DEFAULTS);
  });

  it("falls back to showing everything for missing, malformed, or non-object rows", () => {
    expect(parseOutlinerColumns(null)).toEqual(OUTLINER_COLUMN_DEFAULTS);
    expect(parseOutlinerColumns("")).toEqual(OUTLINER_COLUMN_DEFAULTS);
    expect(parseOutlinerColumns("{not json")).toEqual(OUTLINER_COLUMN_DEFAULTS);
    expect(parseOutlinerColumns("[]")).toEqual(OUTLINER_COLUMN_DEFAULTS);
    expect(parseOutlinerColumns("null")).toEqual(OUTLINER_COLUMN_DEFAULTS);
    expect(parseOutlinerColumns("7")).toEqual(OUTLINER_COLUMN_DEFAULTS);
  });
});
