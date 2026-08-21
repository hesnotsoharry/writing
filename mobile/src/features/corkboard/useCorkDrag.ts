import { useRef } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";

import type { Scene } from "../../shared/binderStore";
import type { DragOffset } from "./corkboardModel";
import { dragPreviewOffsets, dragTargetIndex } from "./corkboardModel";

const NO_OFFSET: DragOffset = { dx: 0, dy: 0 };

export interface CorkDragGeometry {
  columns: 1 | 2;
  cardWidth: number;
  gutter: number;
  rowHeight: number;
}

export interface CorkDragInput {
  scenes: readonly Scene[];
  geometry: CorkDragGeometry;
  onReorder: (sceneId: string, toIndex: number) => void;
}

/**
 * Live drag state for one corkboard group.
 *
 * `activeIndex` and `offsets` are Reanimated shared values so the cards restyle
 * on the UI thread. The gesture itself still runs on JS (`runOnJS(true)`, as it
 * always has), so every callback here is plain JS — and none of them are
 * memoized, because a memoized callback may not write to a shared value.
 */
export interface CorkDrag {
  activeIndex: SharedValue<number>;
  offsets: SharedValue<DragOffset[]>;
  snap: SharedValue<boolean>;
  measure: (index: number, height: number) => void;
  start: (index: number) => void;
  move: (index: number, translationX: number, translationY: number) => void;
  /** Settles the drag and returns the offset the dragged card should land on. */
  end: (index: number, translationX: number, translationY: number) => DragOffset;
  commit: (index: number) => void;
  cancel: () => void;
}

/** Measured card heights plus the two index/offset calculations that read them. */
function useCorkGeometry({ geometry, scenes }: Omit<CorkDragInput, "onReorder">) {
  const heights = useRef<number[]>([]);
  const measured = () => scenes.map((_, index) => heights.current[index] ?? geometry.rowHeight);
  return {
    measure: (index: number, height: number) => { heights.current[index] = height; },
    resolve: (fromIndex: number, translationX: number, translationY: number) => dragTargetIndex({
      fromIndex, translationX, translationY, count: scenes.length, columns: geometry.columns,
      cardWidth: geometry.cardWidth, rowHeight: geometry.rowHeight, gutter: geometry.gutter,
    }),
    preview: (from: number, to: number) => dragPreviewOffsets({
      heights: measured(), columns: geometry.columns, cardWidth: geometry.cardWidth,
      gutter: geometry.gutter, from, to,
    }),
  };
}

export function useCorkDrag({ geometry, onReorder, scenes }: CorkDragInput): CorkDrag {
  const activeIndex = useSharedValue(-1);
  const offsets = useSharedValue<DragOffset[]>([]);
  const snap = useSharedValue(true);
  const target = useRef(-1);
  const { measure, preview, resolve } = useCorkGeometry({ geometry, scenes });

  const cancel = () => {
    snap.value = true;
    offsets.value = [];
    activeIndex.value = -1;
    target.current = -1;
  };
  const start = (index: number) => {
    target.current = index;
    snap.value = false;
    offsets.value = scenes.map(() => NO_OFFSET);
    activeIndex.value = index;
  };
  const move = (index: number, translationX: number, translationY: number) => {
    const to = resolve(index, translationX, translationY);
    if (to === target.current) return;
    target.current = to;
    offsets.value = preview(index, to);
  };
  const end = (index: number, translationX: number, translationY: number) => {
    const to = resolve(index, translationX, translationY);
    target.current = to;
    const settled = preview(index, to);
    offsets.value = settled;
    return settled[index] ?? NO_OFFSET;
  };
  const commit = (index: number) => {
    const to = target.current;
    const scene = scenes[index];
    if (scene && to >= 0 && to !== index) onReorder(scene.id, to);
    cancel();
  };

  return { activeIndex, cancel, commit, end, measure, move, offsets, snap, start };
}
