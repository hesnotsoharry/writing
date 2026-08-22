/**
 * Pan + pinch for the brainstorm board's world layer.
 *
 * WHY THIS IS NOT A PanResponder ANY MORE. The previous implementation rebuilt
 * `PanResponder.create(...)` inside a `useMemo` whose deps included the very
 * transform its own `onPanResponderMove` was setting. `PanResponder` keeps its
 * `gestureState` — including the accumulating `dx`/`dy` — in the closure of a
 * single `create()` call (react-native/Libraries/Interaction/PanResponder.js:404-417,
 * accumulated at :363). A fresh instance every frame meant a fresh
 * `gestureState` with `dx: 0` and `_accountsForMovesUpTo: 0`, so each move
 * reported one frame's delta instead of the drag so far, and the board sat a
 * few pixels from where it started for the whole gesture: "locked in place".
 *
 * The replacement follows the corkboard's house pattern (`features/corkboard/useCorkDrag.ts`):
 * gesture-handler drives Reanimated shared values, so the pan runs on the UI
 * thread and never re-renders React mid-gesture. As there, nothing is memoized
 * — a memoized callback may not write to a shared value — and the animated
 * style is built by the consumer, not here, so these values stay writable.
 */
import { Gesture } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { MAX_MAP_ZOOM, MIN_MAP_ZOOM, type Transform, type Viewport } from "./mapViewport";

export interface BoardTransform {
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  gesture: ReturnType<typeof Gesture.Simultaneous>;
  /** Jump the viewport — fit-to-content once the board's cards have loaded. */
  apply: (next: Transform) => void;
  /** Zoom about the centre of the canvas — the +/- buttons. */
  zoomBy: (factor: number) => void;
}

export function useBoardTransform(viewport: Viewport): BoardTransform {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  // Captured by value into the worklet closures below — a worklet must not
  // reach for an imported helper at call time.
  const min = MIN_MAP_ZOOM;
  const max = MAX_MAP_ZOOM;

  // One finger pans. `maxPointers(1)` hands a second finger to the pinch
  // rather than letting both gestures write x/y in the same frame.
  const pan = Gesture.Pan().maxPointers(1)
    .onStart(() => { startX.value = x.value; startY.value = y.value; })
    .onUpdate((event) => {
      x.value = startX.value + event.translationX;
      y.value = startY.value + event.translationY;
    });
  // Two fingers zoom about the focal point, which stays pinned under them.
  const pinch = Gesture.Pinch()
    .onStart(() => { startX.value = x.value; startY.value = y.value; startScale.value = scale.value; })
    .onUpdate((event) => {
      const next = Math.min(max, Math.max(min, startScale.value * event.scale));
      const ratio = next / startScale.value;
      scale.value = next;
      x.value = event.focalX - (event.focalX - startX.value) * ratio;
      y.value = event.focalY - (event.focalY - startY.value) * ratio;
    });

  const apply = (next: Transform) => {
    x.value = next.x; y.value = next.y; scale.value = next.scale;
  };
  const zoomBy = (factor: number) => {
    const next = Math.min(max, Math.max(min, scale.value * factor));
    const ratio = next / scale.value;
    x.value = viewport.width / 2 - (viewport.width / 2 - x.value) * ratio;
    y.value = viewport.height / 2 - (viewport.height / 2 - y.value) * ratio;
    scale.value = next;
  };

  return { apply, gesture: Gesture.Simultaneous(pan, pinch), scale, x, y, zoomBy };
}

/**
 * The animated style for a transform's world layer. Built by the consumer,
 * not folded into `useBoardTransform` itself, so the shared values it reads
 * stay writable — see the file-header note on memoized callbacks. Shared by
 * the brainstorm board and the relationship map, whose world layers are
 * styled identically (translate + scale from a 1x1-anchored origin).
 */
export function useWorldStyle({ scale, x, y }: BoardTransform) {
  return useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));
}
