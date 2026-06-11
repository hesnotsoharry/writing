import { describe, expect, it } from "vitest";

import { computeEdgeLabelAnchor, declashEdgeLabels } from "../storybible/frLayout";

// ── computeEdgeLabelAnchor ──────────────────────────────────────────────────────

describe("computeEdgeLabelAnchor", () => {
  it("returns the curve midpoint for a horizontal edge (bows perpendicular to the edge)", () => {
    // pa=(0,100) pb=(200,100): mx=100, my=100, dx=200, dy=0, len=200
    // cx = 100 + (-0/200)*200*0.12 = 100; cy = 100 + (200/200)*200*0.12 = 124
    // lx = 0.25*0 + 0.5*100 + 0.25*200 = 100; ly = 0.25*100 + 0.5*124 + 0.25*100 = 112
    const result = computeEdgeLabelAnchor({ x: 0, y: 100 }, { x: 200, y: 100 });
    expect(result.x).toBe(100);
    expect(result.y).toBe(112);
  });

  it("does not throw or produce NaN for a zero-length edge", () => {
    const result = computeEdgeLabelAnchor({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    // Zero-length edge: len clamps to 1, perpendicular is zero-vector → midpoint returned
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });
});

// ── declashEdgeLabels ───────────────────────────────────────────────────────────

describe("declashEdgeLabels", () => {
  it("returns an empty array for zero anchors", () => {
    expect(declashEdgeLabels([])).toEqual([]);
  });

  it("returns unchanged position for a single anchor (no overlap possible)", () => {
    const result = declashEdgeLabels([{ lx: 100, ly: 200, label: "friend" }]);
    expect(result).toEqual([{ lx: 100, ly: 200 }]);
  });

  it("does not move anchors that are vertically far apart", () => {
    const anchors = [
      { lx: 100, ly: 100, label: "a" },
      { lx: 100, ly: 300, label: "a" },
    ];
    const result = declashEdgeLabels(anchors);
    expect(result[0]).toEqual({ lx: 100, ly: 100 });
    expect(result[1]).toEqual({ lx: 100, ly: 300 });
  });

  it("does not move anchors that are horizontally far apart despite same y", () => {
    const anchors = [
      { lx: 0, ly: 100, label: "a" },
      { lx: 500, ly: 100, label: "a" },
    ];
    const result = declashEdgeLabels(anchors);
    expect(result[0]).toEqual({ lx: 0, ly: 100 });
    expect(result[1]).toEqual({ lx: 500, ly: 100 });
  });

  it("separates two co-located anchors by exactly EDGE_LABEL_H+2 (15 px) and preserves lx", () => {
    // Both at (100, 100), label "x" → halfW = (6.2+8)/2 = 7.1
    // overlapX = 14.2 > 0, overlapY = 15 > 0, push = 7.5
    // After one pass: lys become 92.5 and 107.5 — gap == 15 → converged
    const result = declashEdgeLabels([
      { lx: 100, ly: 100, label: "x" },
      { lx: 100, ly: 100, label: "x" },
    ]);
    expect(result[0].lx).toBe(100);
    expect(result[1].lx).toBe(100);
    expect(result[0].ly).toBeCloseTo(92.5, 5);
    expect(result[1].ly).toBeCloseTo(107.5, 5);
  });

  it("does not mutate the input array", () => {
    const anchors = [
      { lx: 100, ly: 100, label: "x" },
      { lx: 100, ly: 100, label: "x" },
    ];
    declashEdgeLabels(anchors);
    expect(anchors[0].ly).toBe(100);
    expect(anchors[1].ly).toBe(100);
  });

  it("clamps each anchor displacement to at most 28 px from its original position", () => {
    // 8 anchors packed at the same point — outer anchors would exceed 28 px without clamping
    const anchors = Array.from({ length: 8 }, () => ({ lx: 100, ly: 100, label: "hello" }));
    const result = declashEdgeLabels(anchors);
    result.forEach(pt => {
      expect(Math.abs(pt.ly - 100)).toBeLessThanOrEqual(28 + 1e-9);
    });
  });
});
