/**
 * FloatingEdge — custom React Flow edge with continuous border attachment.
 *
 * Each end attaches at the exact point where the center-to-center line exits
 * the card's border (_borderPoint), connected by a cubic bezier whose control
 * points follow the exit-side normal (_sideBezier). This gives the "floating"
 * look where lines slide along card edges as cards are moved.
 *
 * Math ported verbatim from:
 *   design-reference/brainstorm/Brainstorm Boards - interactive.html
 *   functions: _borderPoint (line ~210) and _sideBezier (line ~221)
 *
 * Excluded from port (harness-only): routeAround, roundedPath, planEdges,
 * _segSeg/_segRect/_markLine/_sampleLine/_countUsed/_clearOfCards, toggles,
 * ResizeObserver/rAF shims.
 */
import type { EdgeProps, InternalNode } from "@xyflow/react";
import { BaseEdge, getBezierPath, useInternalNode } from "@xyflow/react";
import { memo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BorderPt { x: number; y: number; side: string; }
interface NodeRect { x: number; y: number; w: number; h: number; }
interface NodeMeasure { x: number; y: number; w: number | undefined; h: number | undefined; }

// ── Port of _borderPoint ──────────────────────────────────────────────────────

function borderPoint(rect: NodeRect, toward: { x: number; y: number }): BorderPt {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  let dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) dx = 1;
  const hw = rect.w / 2, hh = rect.h / 2;
  const tx = Math.abs(dx) < 1e-6 ? Infinity : hw / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-6 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty);
  const side = tx < ty ? (dx > 0 ? "right" : "left") : (dy > 0 ? "bottom" : "top");
  return { x: cx + dx * t, y: cy + dy * t, side };
}

// ── Port of _sideBezier ───────────────────────────────────────────────────────

function sideNorm(s: string): [number, number] {
  if (s === "top") return [0, -1];
  if (s === "bottom") return [0, 1];
  if (s === "left") return [-1, 0];
  return [1, 0];
}

function sideBezier(sp: BorderPt, tp: BorderPt): string {
  const k = Math.min(90, Math.max(36, Math.hypot(tp.x - sp.x, tp.y - sp.y) * 0.4));
  const [ax, ay] = sideNorm(sp.side);
  const [bx, by] = sideNorm(tp.side);
  return `M ${sp.x} ${sp.y} C ${sp.x + ax * k} ${sp.y + ay * k}, ${tp.x + bx * k} ${tp.y + by * k}, ${tp.x} ${tp.y}`;
}

// ── Path helpers ──────────────────────────────────────────────────────────────

function computePath(src: NodeRect, tgt: NodeRect): string {
  const tc = { x: tgt.x + tgt.w / 2, y: tgt.y + tgt.h / 2 };
  const sc = { x: src.x + src.w / 2, y: src.y + src.h / 2 };
  return sideBezier(borderPoint(src, tc), borderPoint(tgt, sc));
}

function nodeRect(node: InternalNode): NodeMeasure {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, w: node.measured?.width, h: node.measured?.height };
}

function resolveEdgePath(sNode: InternalNode, tNode: InternalNode): string {
  const { x: sx, y: sy, w: sw, h: sh } = nodeRect(sNode);
  const { x: tx, y: ty, w: tw, h: th } = nodeRect(tNode);
  if (!sw || !sh || !tw || !th) {
    const [path] = getBezierPath({
      sourceX: sx + (sw ?? 0) / 2, sourceY: sy + (sh ?? 0) / 2,
      targetX: tx + (tw ?? 0) / 2, targetY: ty + (th ?? 0) / 2,
    });
    return path;
  }
  return computePath({ x: sx, y: sy, w: sw, h: sh }, { x: tx, y: ty, w: tw, h: th });
}

// ── FloatingEdge ──────────────────────────────────────────────────────────────

function FloatingEdgeInner({ id, source, target }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;
  return <BaseEdge id={id} path={resolveEdgePath(sourceNode, targetNode)} />;
}

export const FloatingEdge = memo(FloatingEdgeInner);
