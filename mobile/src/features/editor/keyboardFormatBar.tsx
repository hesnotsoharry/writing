import type { ReactNode } from "react";
import { Platform } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * `keyboard.height` is the raw controller height, which under edge-to-edge
 * INCLUDES the nav-bar band — but the app root (App.tsx's bottom spacer)
 * already reserves that same band via `insets.bottom`. Left alone, every bar
 * here floats `insets.bottom` too high above the keyboard. `progress` scales
 * from 0 (closed) to 1 (open), so the correction must scale with it too —
 * `insets.bottom` is 0 while `height` is 0, but a bare `+ insets.bottom` is
 * not, and would displace the bar by that amount with the keyboard closed.
 */
function IosAnimatedKeyboardBar({ children }: { children: ReactNode }) {
  const keyboard = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboard.height.value + keyboard.progress.value * bottomInset }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function AndroidKeyboardSpacerBar({ children }: { children: ReactNode }) {
  const keyboard = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const style = useAnimatedStyle(() => ({
    height: Math.max(0, -keyboard.height.value - keyboard.progress.value * bottomInset),
  }));
  return <>
    {children}
    <Animated.View style={style} />
  </>;
}

/**
 * Android 15+ enforces edge-to-edge, which voids `adjustResize`
 * (softwareKeyboardLayoutMode: "resize" in app.json): the window no longer
 * shrinks, the keyboard overlays the WebView, and ProseMirror believes the
 * caret is still visible. Verified on the API 36 emulator 2026-08-09 — the
 * caret line sat clipped behind the keyboard and the format bar was hidden.
 * The spacer takes real layout height in the editor column instead, which
 * shrinks the WebView (restoring PM's own scroll-into-view) and floats the
 * bar above the keyboard. iOS keeps the translate path; only the spacer
 * participates in layout.
 */
export const KeyboardTrackedFormatBar = Platform.OS === "ios"
  ? IosAnimatedKeyboardBar
  : AndroidKeyboardSpacerBar;
