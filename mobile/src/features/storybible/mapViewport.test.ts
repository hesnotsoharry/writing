import { describe, expect, it } from "vitest";

import { clampZoom, fitToContent, hitTestNode } from "./mapViewport";

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

  it("hit-tests a transformed node from a tap point", () => {
    const id = hitTestNode({ x: 220, y: 130 }, [{ id: "maren", x: 100, y: 50, width: 80, height: 60 }],
      { scale: 2, x: 20, y: 30 });
    expect(id).toBe("maren");
    expect(hitTestNode({ x: 20, y: 20 }, [{ id: "maren", x: 100, y: 50, width: 80, height: 60 }],
      { scale: 2, x: 20, y: 30 })).toBeNull();
  });
});
