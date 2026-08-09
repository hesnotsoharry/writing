import { describe, expect, it } from "vitest";

import { buildHeatMapGrid } from "./HeatMap.logic";

describe("buildHeatMapGrid", () => {
  it("builds a Monday-aligned 21-cell grid with today at its weekday", () => {
    const today = new Date("2026-08-08T12:00:00.000Z");
    const cells = buildHeatMapGrid([{ date: "2026-08-08", value: 1 }], today);
    expect(cells).toHaveLength(21);
    expect(cells[0]?.date).toBe("2026-07-20");
    expect(cells[19]).toEqual({ date: "2026-08-08", value: 1, isToday: true });
    expect(cells.at(-1)?.date).toBe("2026-08-09");
    expect(cells.filter((cell) => cell.isToday)).toHaveLength(1);
  });
});
