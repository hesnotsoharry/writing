import { describe, expect, it } from "vitest";

import { getRingGeometry } from "./Ring.logic";

describe("getRingGeometry", () => {
  it.each([
    [0, 0],
    [0.5, Math.PI * 10],
    [1, Math.PI * 20],
    [1.5, Math.PI * 20],
  ])("maps progress %s to the expected dash", (progress, dash) => {
    const result = getRingGeometry(progress, 10);
    expect(result.dash).toBeCloseTo(dash);
    expect(result.dash + result.gap).toBeCloseTo(result.circumference);
  });
});
