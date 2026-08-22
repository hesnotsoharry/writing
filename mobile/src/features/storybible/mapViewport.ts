import type { Vec2 } from "../../shared/frLayout";

export interface Viewport { width: number; height: number }
export interface Transform { scale: number; x: number; y: number }
export interface WorldBox { x: number; y: number; width: number; height: number }

export const MIN_MAP_ZOOM = 0.5;
export const MAX_MAP_ZOOM = 2.5;

export function clampZoom(value: number): number {
  return Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, value));
}

export function fitToContent(points: Vec2[], viewport: Viewport, padding = 32): Transform {
  if (points.length === 0) return { scale: 1, x: 0, y: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const scale = clampZoom(Math.min((viewport.width - padding * 2) / contentWidth,
    (viewport.height - padding * 2) / contentHeight));
  return {
    scale,
    x: viewport.width / 2 - ((minX + maxX) / 2) * scale,
    y: viewport.height / 2 - ((minY + maxY) / 2) * scale,
  };
}

/**
 * Padded bounding box around a set of world-space points — the SVG frame for
 * an edge/connector layer that lives inside a 1x1-anchored world view (see
 * BoardCanvas's `styles.world`). Shared by the relationship map (node
 * centres) and the brainstorm board (card top-left corners).
 */
export function boundingBox(points: readonly Vec2[], padding: number): WorldBox {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs) - padding;
  const y = Math.min(...ys) - padding;
  return { x, y, width: Math.max(...xs) + padding * 2 - x, height: Math.max(...ys) + padding * 2 - y };
}
