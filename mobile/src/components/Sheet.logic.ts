export const DESIGN_FRAME_HEIGHT = 844;

export function resolveSheetFraction(
  designHeight: number,
  designFrameHeight = DESIGN_FRAME_HEIGHT,
): number {
  if (designFrameHeight <= 0) return 0;
  return Math.min(1, Math.max(0, designHeight / designFrameHeight));
}

export function resolveSheetHeight(
  designHeight: number,
  screenHeight: number,
  designFrameHeight = DESIGN_FRAME_HEIGHT,
): number {
  return screenHeight * resolveSheetFraction(designHeight, designFrameHeight);
}

export interface SheetLayout {
  contentFillsAvailableHeight: boolean;
  fixedHeight: number | undefined;
}

export function resolveSheetLayout(
  designHeight: number | undefined,
  screenHeight: number,
): SheetLayout {
  if (designHeight === undefined) {
    return { contentFillsAvailableHeight: false, fixedHeight: undefined };
  }
  return {
    contentFillsAvailableHeight: true,
    fixedHeight: resolveSheetHeight(designHeight, screenHeight),
  };
}
