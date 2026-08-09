import { describe, expect, it } from "vitest";

import { placeAutoLinkPeek } from "./autolinkPlacement";

const popover = { width: 314, height: 126 };
const viewport = { width: 390, height: 844 };

describe("placeAutoLinkPeek", () => {
  it("flips above near the bottom edge", () => {
    const result = placeAutoLinkPeek({ x: 150, y: 760, width: 60, height: 24 }, popover, viewport);
    expect(result.above).toBe(true);
    expect(result.top).toBeLessThan(760);
  });

  it("stays on screen at both horizontal extremes", () => {
    const left = placeAutoLinkPeek({ x: -20, y: 100, width: 20, height: 20 }, popover, viewport);
    const right = placeAutoLinkPeek({ x: 382, y: 100, width: 20, height: 20 }, popover, viewport);
    expect(left.left).toBe(10);
    expect(right.left + popover.width).toBeLessThanOrEqual(viewport.width - 10);
    expect(left.caretX).toBeGreaterThanOrEqual(16);
    expect(right.caretX).toBeLessThanOrEqual(popover.width - 16);
  });
});
