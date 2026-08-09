import { describe, expect, it } from "vitest";

import { resolveSheetFraction, resolveSheetHeight, resolveSheetLayout } from "./Sheet.logic";

describe("sheet sizing", () => {
  it("preserves the design height as a screen fraction", () => {
    expect(resolveSheetFraction(648)).toBeCloseTo(648 / 844);
    expect(resolveSheetHeight(648, 1000)).toBeCloseTo((648 / 844) * 1000);
  });

  it("clamps invalid design heights", () => {
    expect(resolveSheetFraction(-10)).toBe(0);
    expect(resolveSheetFraction(900)).toBe(1);
  });

  it("bounds fixed-height content while leaving dynamic content measurable", () => {
    expect(resolveSheetLayout(648, 1000)).toEqual({
      contentFillsAvailableHeight: true,
      fixedHeight: (648 / 844) * 1000,
    });
    expect(resolveSheetLayout(undefined, 1000)).toEqual({
      contentFillsAvailableHeight: false,
      fixedHeight: undefined,
    });
  });
});
