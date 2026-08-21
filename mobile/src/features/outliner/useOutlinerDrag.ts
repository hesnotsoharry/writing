import { createContext, useRef } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useSharedValue } from "react-native-reanimated";

import type { OutlineGroup } from "./outlinerModel";
import { OUTLINER_ROW_HEIGHT, outlinerDropIndex, outlinerPreviewOffsets } from "./outlinerModel";

export interface OutlinerDrop {
  sceneId: string;
  groupId: string | null;
  fromIndex: number;
  count: number;
  translationY: number;
}

/**
 * Live drag state for the outliner list.
 *
 * `activeId` and `offsets` are Reanimated shared values so rows restyle on the
 * UI thread. The pan gesture itself still runs on JS (`runOnJS(true)`), so every
 * callback here is plain JS — and none of them are memoized, because a memoized
 * callback may not write to a shared value.
 */
export interface OutlinerDrag {
  activeId: SharedValue<string>;
  offsets: SharedValue<Record<string, number>>;
  snap: SharedValue<boolean>;
  measure: (sceneId: string, height: number) => void;
  start: (drop: OutlinerDrop) => void;
  move: (drop: OutlinerDrop) => void;
  /** Settles the drag and returns the offset the dragged row should land on. */
  end: (drop: OutlinerDrop) => number;
  commit: (sceneId: string) => void;
  cancel: () => void;
}

/** Lets the list's cell renderer see the live drag without re-creating the cell
 *  component on every render. */
export const OutlinerDragContext = createContext<OutlinerDrag | null>(null);

export type OutlinerReorder = (sceneId: string, groupId: string | null, toIndex: number) => void;

interface Pending {
  groupId: string | null;
  fromIndex: number;
  toIndex: number;
}

/** Measured row heights plus the offset calculation that reads them. */
function usePreview(groups: readonly OutlineGroup[]) {
  const heights = useRef<Record<string, number>>({});
  return {
    measure: (sceneId: string, height: number) => { heights.current[sceneId] = height; },
    preview: (drop: OutlinerDrop, toIndex: number) => {
      const ids = groups.find(({ id }) => id === drop.groupId)?.scenes.map(({ id }) => id) ?? [];
      const measured = ids.map((id) => heights.current[id] ?? OUTLINER_ROW_HEIGHT);
      const values = outlinerPreviewOffsets(measured, drop.fromIndex, toIndex);
      return Object.fromEntries(ids.map((id, index) => [id, values[index] ?? 0]));
    },
  };
}

export function useOutlinerDrag(groups: readonly OutlineGroup[], onReorder: OutlinerReorder): OutlinerDrag {
  const activeId = useSharedValue("");
  const offsets = useSharedValue<Record<string, number>>({});
  const snap = useSharedValue(true);
  const pending = useRef<Pending | null>(null);
  const { measure, preview } = usePreview(groups);

  const cancel = () => {
    snap.value = true;
    offsets.value = {};
    activeId.value = "";
    pending.current = null;
  };
  const start = (drop: OutlinerDrop) => {
    pending.current = { groupId: drop.groupId, fromIndex: drop.fromIndex, toIndex: drop.fromIndex };
    snap.value = false;
    offsets.value = {};
    activeId.value = drop.sceneId;
  };
  const move = (drop: OutlinerDrop) => {
    const toIndex = outlinerDropIndex(drop.fromIndex, drop.translationY, drop.count);
    if (!pending.current || pending.current.toIndex === toIndex) return;
    pending.current = { ...pending.current, toIndex };
    offsets.value = preview(drop, toIndex);
  };
  const end = (drop: OutlinerDrop) => {
    const toIndex = outlinerDropIndex(drop.fromIndex, drop.translationY, drop.count);
    pending.current = { groupId: drop.groupId, fromIndex: drop.fromIndex, toIndex };
    const settled = preview(drop, toIndex);
    offsets.value = settled;
    return settled[drop.sceneId] ?? 0;
  };
  // `onReorder` re-sorts the list optimistically in the same tick, so clearing
  // the preview here lands on the reordered rows rather than the old ones.
  const commit = (sceneId: string) => {
    const settled = pending.current;
    if (settled && settled.toIndex !== settled.fromIndex) {
      onReorder(sceneId, settled.groupId, settled.toIndex);
    }
    cancel();
  };

  return { activeId, cancel, commit, end, measure, move, offsets, snap, start };
}
