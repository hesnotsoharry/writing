import { describe, expect, it } from "vitest";

import { buildHeatMapGrid } from "./HeatMap.logic";

describe("buildHeatMapGrid", () => {
  it("builds 21 chronological cells ending today", () => {
    const today = new Date("2026-08-08T12:00:00.000Z");
    const cells = buildHeatMapGrid([{ date: "2026-08-08", value: 1 }], today);
    expect(cells).toHaveLength(21);
    expect(cells[0]?.date).toBe("2026-07-19");
    expect(cells.at(-1)).toEqual({ date: "2026-08-08", value: 1, isToday: true });
    expect(cells.filter((cell) => cell.isToday)).toHaveLength(1);
  });
});
