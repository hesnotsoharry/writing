import type { ReactNode } from "react";
import { Platform } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

function IosAnimatedKeyboardBar({ children }: { children: ReactNode }) {
  const keyboard = useReanimatedKeyboardAnimation();
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: keyboard.height.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function AndroidKeyboardSpacerBar({ children }: { children: ReactNode }) {
  const keyboard = useReanimatedKeyboardAnimation();
  const style = useAnimatedStyle(() => ({ height: -keyboard.height.value }));
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
