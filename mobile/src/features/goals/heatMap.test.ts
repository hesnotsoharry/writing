import { describe, expect, it } from "vitest";

import { buildHeatMapGrid } from "../../components/HeatMap.logic";

describe("three-week goal heat map", () => {
  it("renders 21 cells with weekday alignment, today, and a gap", () => {
    const today = new Date("2026-08-09T12:00:00");
    const days = [
      { date: "2026-07-20", value: 1 },
      { date: "2026-07-21", value: 1 },
      { date: "2026-08-09", value: 0 },
    ];
    const cells = buildHeatMapGrid(days, today);

    expect(cells).toHaveLength(21);
    expect(new Date(`${cells[0].date}T12:00:00`).getDay()).toBe(1);
    expect(cells.filter(({ isToday }) => isToday)).toEqual([
      { date: "2026-08-09", value: 0, isToday: true },
    ]);
    expect(cells.find(({ date }) => date === "2026-07-22")?.value).toBe(0);
  });
});
