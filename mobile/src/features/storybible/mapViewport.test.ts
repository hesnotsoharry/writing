import { describe, expect, it } from "vitest";

import { boundingBox, clampZoom, fitToContent } from "./mapViewport";

describe("relationship map viewport math", () => {
  it("fits content into the viewport", () => {
    const fit = fitToContent([{ x: 0, y: 0 }, { x: 200, y: 100 }], { width: 400, height: 300 }, 40);
    expect(fit.scale).toBeCloseTo(1.6);
    expect(fit.x).toBeCloseTo(40);
    expect(fit.y).toBeCloseTo(70);
  });

  it("clamps zoom", () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(1.25)).toBe(1.25);
    expect(clampZoom(9)).toBe(2.5);
  });
});

describe("boundingBox", () => {
  it("pads a box out from the min/max extent of the given points", () => {
    // top-left is inset by one padding; width/height carry the padding on
    // both edges plus the outer edge's own second inset (matches the
    // pre-existing connectorBox formula this generalises).
    expect(boundingBox([{ x: 0, y: 0 }, { x: 200, y: 100 }], 40)).toEqual({
      x: -40, y: -40, width: 320, height: 220,
    });
  });

  it("collapses to a padded point for a single-node graph", () => {
    expect(boundingBox([{ x: 50, y: 50 }], 10)).toEqual({ x: 40, y: 40, width: 30, height: 30 });
  });

  it("is anchored on the points themselves, not the origin", () => {
    const box = boundingBox([{ x: 900, y: 640 }, { x: 1400, y: 900 }], 20);
    expect(box).toEqual({ x: 880, y: 620, width: 560, height: 320 });
  });
});
