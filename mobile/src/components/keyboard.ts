import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Breathing room between the focused input's bottom edge and the top of the
 * keyboard. Without it an input can sit flush against the keyboard, which reads
 * as "still covered" even though it technically is not.
 *
 * One constant, not one per screen: it was copied into three files and would
 * have drifted the moment anyone tuned it.
 */
export const KEYBOARD_BOTTOM_OFFSET = 24;

/**
 * The shared prop pair every `KeyboardAwareScrollView` call site spreads in.
 *
 * `bottomOffset` is the caret-to-keyboard gap above (`KEYBOARD_BOTTOM_OFFSET`).
 * `extraKeyboardSpace` corrects a second, unrelated problem: under edge-to-edge,
 * react-native-keyboard-controller's reported keyboard height INCLUDES the
 * nav-bar band, and the library reserves bottom padding/inset equal to that
 * full height. The app root's spacer (App.tsx) already reserves that same
 * band via `insets.bottom`, so left alone every keyboard-aware scroller
 * over-reserves by `insets.bottom` on top of the root's own padding.
 * `extraKeyboardSpace` is negative to give that back — and it is naturally
 * progress-scaled by the library (interpolated against the live keyboard
 * height, not a flat subtraction), so it does nothing while the keyboard is
 * closed. Insets are static per device/orientation, so reading them once per
 * mount (not per frame) is fine — this is a plain number prop, not a worklet.
 */
export function useKeyboardAwareScrollProps(): { bottomOffset: number; extraKeyboardSpace: number } {
  const insets = useSafeAreaInsets();
  return { bottomOffset: KEYBOARD_BOTTOM_OFFSET, extraKeyboardSpace: -insets.bottom };
}
