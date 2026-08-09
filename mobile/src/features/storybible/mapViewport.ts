import type { Vec2 } from "../../shared/frLayout";

export interface Viewport { width: number; height: number }
export interface Transform { scale: number; x: number; y: number }
export interface MapNodeBox { id: string; x: number; y: number; width: number; height: number }

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

export function screenToWorld(point: Vec2, transform: Transform): Vec2 {
  return { x: (point.x - transform.x) / transform.scale, y: (point.y - transform.y) / transform.scale };
}

export function hitTestNode(point: Vec2, nodes: MapNodeBox[], transform: Transform): string | null {
  const world = screenToWorld(point, transform);
  const hit = [...nodes].reverse().find((node) =>
    world.x >= node.x - node.width / 2 && world.x <= node.x + node.width / 2
    && world.y >= node.y - node.height / 2 && world.y <= node.y + node.height / 2);
  return hit?.id ?? null;
}
