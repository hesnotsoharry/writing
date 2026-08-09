export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }

export interface AutoLinkTapPayload {
  entityId: string;
  entityType: string;
  sceneId: string;
  anchor: Rect;
}

export interface PeekPlacement { left: number; top: number; above: boolean; caretX: number }
interface PlacementOptions { gap?: number; pad?: number }

export function placeAutoLinkPeek(anchor: Rect, popover: Size, viewport: Size,
  options: PlacementOptions = {}): PeekPlacement {
  const gap = options.gap ?? 7; const pad = options.pad ?? 10;
  const naturalLeft = anchor.x;
  const maxLeft = Math.max(pad, viewport.width - popover.width - pad);
  const left = Math.min(maxLeft, Math.max(pad, naturalLeft));
  const below = anchor.y + anchor.height + gap;
  const above = below + popover.height + pad > viewport.height;
  const top = above ? Math.max(pad, anchor.y - popover.height - gap) : below;
  const anchorCenter = anchor.x + anchor.width / 2;
  const caretX = Math.min(popover.width - 16, Math.max(16, anchorCenter - left));
  return { left, top, above, caretX };
}
